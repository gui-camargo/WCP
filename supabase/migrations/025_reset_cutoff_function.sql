-- Função para atualizar cutoff_at para 2 horas antes do kickoff_at em todos os jogos
CREATE OR REPLACE FUNCTION reset_cutoff_to_2h_before_kickoff()
RETURNS void AS $$
BEGIN
  UPDATE games
  SET cutoff_at = kickoff_at - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;