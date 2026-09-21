CREATE TABLE IF NOT EXISTS public.topup_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency)
);

ALTER TABLE public.topup_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY topup_rates_select_all ON public.topup_rates
  FOR SELECT TO authenticated USING (true);

-- Mismo criterio que exchange_rates: solo admin (no agentes) puede escribir.
CREATE POLICY topup_rates_admin_write ON public.topup_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
