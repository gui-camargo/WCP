-- Recalculate group prediction points for a specific group after real standings are updated.
CREATE OR REPLACE FUNCTION public.recalculate_group_predictions_for_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE group_predictions gp
  SET points = calculate_group_bonus_points(gp.id)
  WHERE gp.group_id = p_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_group_predictions_for_group(UUID) TO authenticated;
