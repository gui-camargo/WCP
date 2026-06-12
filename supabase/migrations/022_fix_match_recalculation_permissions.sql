-- ============================================================
-- WCP – Migration 022
-- Fix recalculation permissions when closing/reopening matches
-- ============================================================

-- The security hardening migration (019) restricts UPDATE on predictions
-- columns for authenticated users. Match result recalculation updates
-- predictions.points, so it must run with definer privileges.

CREATE OR REPLACE FUNCTION public.recalculate_match_predictions(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pred RECORD;
BEGIN
  FOR pred IN SELECT id FROM public.predictions WHERE match_id = p_match_id LOOP
    UPDATE public.predictions
    SET points = public.calculate_match_points(pred.id)
    WHERE id = pred.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_on_match_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.home_score IS DISTINCT FROM NEW.home_score
     OR OLD.away_score IS DISTINCT FROM NEW.away_score
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recalculate_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_match_predictions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_on_match_update() TO authenticated;
