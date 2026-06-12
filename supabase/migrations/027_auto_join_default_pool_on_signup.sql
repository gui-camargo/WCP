-- ============================================================
-- WCP – Migration 027
-- Auto-join no bolao padrao global ao criar profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_join_default_pool_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_pool_id UUID;
BEGIN
  SELECT p.id
  INTO v_default_pool_id
  FROM public.pools p
  WHERE p.is_default_global = true
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_default_pool_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pool_members (pool_id, user_id)
  VALUES (v_default_pool_id, NEW.id)
  ON CONFLICT (pool_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET active_pool_id = v_default_pool_id
  WHERE id = NEW.id
    AND active_pool_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_join_default_pool_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_auto_join_default_pool_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_default_pool_on_profile_insert();

-- Backfill de usuarios existentes sem active_pool_id
WITH default_pool AS (
  SELECT p.id
  FROM public.pools p
  WHERE p.is_default_global = true
  ORDER BY p.created_at ASC
  LIMIT 1
)
INSERT INTO public.pool_members (pool_id, user_id)
SELECT dp.id, pr.id
FROM default_pool dp
CROSS JOIN public.profiles pr
WHERE pr.active_pool_id IS NULL
ON CONFLICT (pool_id, user_id) DO NOTHING;

WITH default_pool AS (
  SELECT p.id
  FROM public.pools p
  WHERE p.is_default_global = true
  ORDER BY p.created_at ASC
  LIMIT 1
)
UPDATE public.profiles pr
SET active_pool_id = dp.id
FROM default_pool dp
WHERE pr.active_pool_id IS NULL;
