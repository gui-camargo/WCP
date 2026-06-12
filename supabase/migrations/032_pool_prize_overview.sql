-- ============================================================
-- 032 - Resumo de participantes confirmados e premiacao do bolao
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pool_prize_overview(p_pool_id UUID)
RETURNS TABLE (
  confirmed_count INTEGER,
  stake_cents INTEGER,
  total_pot_cents INTEGER,
  first_prize_cents INTEGER,
  second_prize_cents INTEGER,
  third_prize_cents INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_count INTEGER := 0;
  v_stake_cents INTEGER := 10000;
  v_total_pot_cents INTEGER := 0;
BEGIN
  IF NOT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pool_members pm
      WHERE pm.pool_id = p_pool_id
        AND pm.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_confirmed_count
  FROM public.payments pay
  WHERE pay.pool_id = p_pool_id
    AND pay.status = 'confirmado';

  v_total_pot_cents := v_confirmed_count * v_stake_cents;

  RETURN QUERY
  SELECT
    v_confirmed_count,
    v_stake_cents,
    v_total_pot_cents,
    (v_total_pot_cents * 70 / 100)::INTEGER,
    (v_total_pot_cents * 20 / 100)::INTEGER,
    (v_total_pot_cents * 10 / 100)::INTEGER;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_prize_overview(UUID) TO authenticated;