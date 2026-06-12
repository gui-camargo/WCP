-- ============================================================
-- WCP – Migration 023
-- Controle manual de pagamentos por bolão
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 10000 CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'rejeitado')),
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_pool_status ON public.payments(pool_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

CREATE OR REPLACE FUNCTION public.set_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payments_updated_at ON public.payments;
CREATE TRIGGER trg_set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_payments_updated_at();

CREATE OR REPLACE FUNCTION public.is_pool_owner_or_admin(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pools p
    WHERE p.id = p_pool_id
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_pool_owner_or_admin(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_payment_row_for_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payments (pool_id, user_id, amount_cents, status)
  VALUES (NEW.pool_id, NEW.user_id, 10000, 'pendente')
  ON CONFLICT (pool_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pool_member_insert_payment ON public.pool_members;
CREATE TRIGGER trg_pool_member_insert_payment
AFTER INSERT ON public.pool_members
FOR EACH ROW EXECUTE FUNCTION public.ensure_payment_row_for_member();

-- Backfill para membros existentes
INSERT INTO public.payments (pool_id, user_id, amount_cents, status)
SELECT pm.pool_id, pm.user_id, 10000, 'pendente'
FROM public.pool_members pm
ON CONFLICT (pool_id, user_id) DO NOTHING;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.payments TO authenticated;
GRANT INSERT (pool_id, user_id, amount_cents, status, paid_at, confirmed_at, confirmed_by, notes) ON public.payments TO authenticated;
GRANT UPDATE (amount_cents, status, paid_at, confirmed_at, confirmed_by, notes) ON public.payments TO authenticated;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_pool_owner_or_admin(pool_id)
);

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
FOR INSERT
WITH CHECK (
  public.is_pool_owner_or_admin(pool_id)
);

DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments
FOR UPDATE
USING (
  public.is_pool_owner_or_admin(pool_id)
)
WITH CHECK (
  public.is_pool_owner_or_admin(pool_id)
);
