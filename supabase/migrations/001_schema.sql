-- ============================================================
-- WCP – Bolão Copa do Mundo
-- Migration 001 – Schema base + RLS + Funções de pontuação
-- Execute no Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ==================== EXTENSÕES ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABELAS ====================

-- Perfis de usuário (espelha auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  is_admin   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bolões
CREATE TABLE IF NOT EXISTS pools (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS active_pool_id UUID REFERENCES pools(id) ON DELETE SET NULL;

-- Membros do bolão
CREATE TABLE IF NOT EXISTS pool_members (
  pool_id   UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);

-- Seleções (grupos A-L)
CREATE TABLE IF NOT EXISTS groups (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code CHAR(1) NOT NULL UNIQUE
);

-- Times
CREATE TABLE IF NOT EXISTS teams (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL UNIQUE,
  flag_code TEXT
);

-- Rodadas (vinculadas ao bolão)
CREATE TABLE IF NOT EXISTS rounds (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id    UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phase      TEXT NOT NULL CHECK (phase IN ('grupos','oitavas','quartas','semi','terceiro_lugar','final')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partidas
CREATE TABLE IF NOT EXISTS matches (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id       UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  group_id       UUID REFERENCES groups(id),
  home_team_id   UUID NOT NULL REFERENCES teams(id),
  away_team_id   UUID NOT NULL REFERENCES teams(id),
  kickoff_at     TIMESTAMPTZ NOT NULL,
  venue          TEXT NOT NULL DEFAULT '',
  cutoff_at      TIMESTAMPTZ,
  home_score     INT CHECK (home_score >= 0),
  away_score     INT CHECK (away_score >= 0),
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','encerrado'))
);

-- Palpites de jogos
CREATE TABLE IF NOT EXISTS predictions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id     UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  home_guess  INT NOT NULL CHECK (home_guess >= 0),
  away_guess  INT NOT NULL CHECK (away_guess >= 0),
  points      INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, match_id, user_id)
);

-- Palpites de classificação por grupo
CREATE TABLE IF NOT EXISTS group_predictions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id    UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  first_id   UUID NOT NULL REFERENCES teams(id),
  second_id  UUID NOT NULL REFERENCES teams(id),
  points     INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, user_id, group_id)
);

-- ==================== GRANTS ====================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
  profiles,
  pools,
  pool_members,
  groups,
  teams,
  rounds,
  matches,
  predictions,
  group_predictions,
  group_standings,
  leaderboard
TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  profiles,
  pools,
  pool_members,
  rounds,
  matches,
  predictions,
  group_predictions,
  group_standings
TO authenticated;

-- ==================== TRIGGER: auto-create profile ====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Helper para checar se usuário atual é admin sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Helper para checar se usuario atual e membro de um bolao sem recursao de RLS.
CREATE OR REPLACE FUNCTION public.is_current_user_pool_member(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = p_pool_id
      AND pm.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_pool_member(UUID) TO authenticated;

-- ==================== VIEW: leaderboard ====================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  pm.pool_id,
  p.id                                         AS user_id,
  p.name                                       AS user_name,
  COALESCE(SUM(pred.points), 0) +
  COALESCE(SUM(gp.points), 0)                  AS total_points,
  RANK() OVER (
    PARTITION BY pm.pool_id
    ORDER BY COALESCE(SUM(pred.points),0) + COALESCE(SUM(gp.points),0) DESC
  )                                            AS rank
FROM pool_members pm
JOIN profiles p ON p.id = pm.user_id
LEFT JOIN predictions pred
  ON pred.user_id = pm.user_id AND pred.pool_id = pm.pool_id
LEFT JOIN group_predictions gp
  ON gp.user_id = pm.user_id AND gp.pool_id = pm.pool_id
GROUP BY pm.pool_id, p.id, p.name;

-- ==================== FUNÇÃO: pontuar jogo ====================
-- Regras:
--   Placar exato                                    → 20 pts
--   Acerta vencedor + gols de apenas um time        → 15 pts
--   Acerta apenas vencedor (ou empate s/ gols)      → 10 pts
--   Acerta gols de apenas um time (errou vencedor)  → 5 pts
--   Nenhuma das anteriores                          → 0 pts
CREATE OR REPLACE FUNCTION calculate_match_points(p_prediction_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  pred        predictions%ROWTYPE;
  match       matches%ROWTYPE;
  pts         INT := 0;
  real_result INT; -- -1 visitante, 0 empate, 1 mandante
  pred_result INT;
  home_match  BOOL;
  away_match  BOOL;
BEGIN
  SELECT * INTO pred  FROM predictions WHERE id = p_prediction_id;
  SELECT * INTO match FROM matches    WHERE id = pred.match_id;

  IF match.status <> 'encerrado' OR match.home_score IS NULL THEN
    RETURN NULL;
  END IF;

  -- Placar exato
  IF pred.home_guess = match.home_score AND pred.away_guess = match.away_score THEN
    RETURN 20;
  END IF;

  -- Vencedor real e palpitado
  real_result := CASE
    WHEN match.home_score > match.away_score THEN 1
    WHEN match.home_score < match.away_score THEN -1
    ELSE 0
  END;
  pred_result := CASE
    WHEN pred.home_guess > pred.away_guess THEN 1
    WHEN pred.home_guess < pred.away_guess THEN -1
    ELSE 0
  END;

  home_match := pred.home_guess = match.home_score;
  away_match := pred.away_guess = match.away_score;

  -- Acerta vencedor + gols de um time (15 pts)
  IF real_result = pred_result AND (home_match OR away_match) THEN
    RETURN 15;
  END IF;

  -- Acerta só vencedor (10 pts)
  IF real_result = pred_result THEN
    RETURN 10;
  END IF;

  -- Acerta gols de um time sem acertar vencedor (5 pts)
  IF home_match OR away_match THEN
    RETURN 5;
  END IF;

  RETURN 0;
END;
$$;

-- ==================== FUNÇÃO: pontuar bônus de grupo ====================
-- Regras:
--   1º e 2º exatos (posição certa)                    → 20 pts
--   Os dois classificados mas posições invertidas      → 15 pts
--   Um classificado na posição correta                 → 10 pts
--   Um classificado na posição errada                  → 5 pts
--   Nenhum                                             → 0 pts
-- Requer tabela group_standings com (group_id, first_id, second_id) preenchida
CREATE TABLE IF NOT EXISTS group_standings (
  group_id  UUID PRIMARY KEY REFERENCES groups(id),
  first_id  UUID REFERENCES teams(id),
  second_id UUID REFERENCES teams(id)
);

CREATE OR REPLACE FUNCTION calculate_group_bonus_points(p_group_prediction_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  gp         group_predictions%ROWTYPE;
  real_s     group_standings%ROWTYPE;
  first_ok   BOOL;
  second_ok  BOOL;
BEGIN
  SELECT * INTO gp   FROM group_predictions WHERE id = p_group_prediction_id;
  SELECT * INTO real_s FROM group_standings   WHERE group_id = gp.group_id;

  IF real_s.first_id IS NULL THEN RETURN NULL; END IF;

  first_ok  := gp.first_id  = real_s.first_id;
  second_ok := gp.second_id = real_s.second_id;

  -- Exato
  IF first_ok AND second_ok THEN RETURN 20; END IF;

  -- Dois classificados invertidos
  IF gp.first_id = real_s.second_id AND gp.second_id = real_s.first_id THEN RETURN 15; END IF;

  -- Um na posição certa
  IF first_ok OR second_ok THEN RETURN 10; END IF;

  -- Um classificado mas na posição errada
  IF gp.first_id = real_s.second_id OR gp.second_id = real_s.first_id THEN RETURN 5; END IF;

  RETURN 0;
END;
$$;

-- ==================== FUNÇÃO: recalcular pontos de uma partida ====================
CREATE OR REPLACE FUNCTION recalculate_match_predictions(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  pred RECORD;
BEGIN
  FOR pred IN SELECT id FROM predictions WHERE match_id = p_match_id LOOP
    UPDATE predictions
    SET points = calculate_match_points(pred.id)
    WHERE id = pred.id;
  END LOOP;
END;
$$;

-- Define cutoff padrao por jogo: 2h antes do kickoff.
CREATE OR REPLACE FUNCTION set_match_cutoff_on_write()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cutoff_at IS NULL THEN
    NEW.cutoff_at := NEW.kickoff_at - INTERVAL '2 hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_match_set_cutoff ON matches;
CREATE TRIGGER before_match_set_cutoff
  BEFORE INSERT OR UPDATE OF kickoff_at, cutoff_at ON matches
  FOR EACH ROW EXECUTE PROCEDURE set_match_cutoff_on_write();

-- Trigger: ao encerrar partida, recalcula pontos automaticamente
CREATE OR REPLACE FUNCTION trigger_recalculate_on_match_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.home_score IS DISTINCT FROM NEW.home_score
     OR OLD.away_score IS DISTINCT FROM NEW.away_score
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM recalculate_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_result_updated ON matches;
CREATE TRIGGER on_match_result_updated
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE PROCEDURE trigger_recalculate_on_match_update();

-- ==================== RLS ====================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_standings  ENABLE ROW LEVEL SECURITY;

-- profiles: usuário vê e edita o próprio; admin vê todos
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id
  OR public.is_current_user_admin()
  OR EXISTS (
    SELECT 1
    FROM pool_members pm_viewer
    JOIN pool_members pm_target ON pm_target.pool_id = pm_viewer.pool_id
    WHERE pm_viewer.user_id = auth.uid()
      AND pm_target.user_id = profiles.id
  )
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- pools: vê pools em que é membro
CREATE POLICY "pools_select" ON pools FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_current_user_pool_member(pools.id)
  OR public.is_current_user_admin()
);
CREATE POLICY "pools_insert" ON pools FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "pools_update" ON pools FOR UPDATE USING (owner_id = auth.uid());

-- pool_members: vê membros dos seus bolões
CREATE POLICY "pool_members_select" ON pool_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM pools p
    WHERE p.id = pool_members.pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin()
);
CREATE POLICY "pool_members_insert" ON pool_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM pools WHERE id = pool_id AND owner_id = auth.uid())
  OR user_id = auth.uid()
);

-- rounds: membros do bolão veem as rodadas
CREATE POLICY "rounds_select" ON rounds FOR SELECT USING (
  EXISTS (SELECT 1 FROM pool_members WHERE pool_id = rounds.pool_id AND user_id = auth.uid())
);
CREATE POLICY "rounds_insert" ON rounds FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM pools WHERE id = pool_id AND owner_id = auth.uid())
);

-- teams e groups: leitura pública para autenticados
CREATE POLICY "teams_select"  ON teams  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "groups_select" ON groups FOR SELECT USING (auth.role() = 'authenticated');

-- matches: membros do bolão da rodada podem ver
CREATE POLICY "matches_select" ON matches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM rounds r
    JOIN pool_members pm ON pm.pool_id = r.pool_id
    WHERE r.id = matches.round_id AND pm.user_id = auth.uid()
  )
);
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM rounds r
    JOIN pools p ON p.id = r.pool_id
    WHERE r.id = matches.round_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

-- predictions: usuário gerencia as próprias; após cutoff do jogo vê as dos outros do mesmo bolão
CREATE POLICY "predictions_own_select" ON predictions FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "predictions_others_select" ON predictions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN rounds r ON r.id = m.round_id
    JOIN pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = predictions.match_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at < now()
  )
);
CREATE POLICY "predictions_insert" ON predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM matches m
    JOIN rounds r ON r.id = m.round_id
    JOIN pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = match_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at > now()
  )
);
CREATE POLICY "predictions_update" ON predictions FOR UPDATE USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_id
      AND m.cutoff_at > now()
  )
);

-- group_predictions: mesmas regras que predictions
CREATE POLICY "gp_select_own"    ON group_predictions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "gp_others_select" ON group_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pool_members pm
    WHERE pm.pool_id = group_predictions.pool_id
      AND pm.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM matches m
        JOIN rounds r ON r.id = m.round_id
        WHERE r.pool_id = group_predictions.pool_id
          AND m.cutoff_at < now()
        LIMIT 1
      )
  )
);
CREATE POLICY "gp_insert"        ON group_predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM pool_members
    WHERE pool_id = group_predictions.pool_id AND user_id = auth.uid()
  )
);
CREATE POLICY "gp_update"        ON group_predictions FOR UPDATE USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM matches m
    JOIN rounds r ON r.id = m.round_id
    WHERE r.pool_id = group_predictions.pool_id
      AND m.cutoff_at > now()
    LIMIT 1
  )
);

-- group_standings: leitura para autenticados; escrita para admin
CREATE POLICY "gs_select" ON group_standings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "gs_upsert" ON group_standings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);
