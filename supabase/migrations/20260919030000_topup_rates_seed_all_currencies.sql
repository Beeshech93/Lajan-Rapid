-- Restricción única (para bases de datos que ya tenían la tabla topup_rates
-- creada antes de que se agregara UNIQUE(from_currency, to_currency) en la
-- migración original — no falla si ya existe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topup_rates_pair_unique'
  ) THEN
    ALTER TABLE public.topup_rates ADD CONSTRAINT topup_rates_pair_unique UNIQUE (from_currency, to_currency);
  END IF;
END $$;

-- Tasas iniciales para las 12 monedas de origen soportadas por la app, todas
-- hacia USD — confirmado con datos reales de DingConnect (GetProducts) que
-- los 8 países de recarga (HT, DO, MX, US, CU, JM, BR, CO) piden USD como
-- SendCurrencyIso para sus productos móviles reales. Valores de mercado al
-- momento de esta migración; el admin puede ajustarlos en cualquier momento
-- desde /admin → Tasas Ding.
INSERT INTO public.topup_rates (from_currency, to_currency, rate, is_active) VALUES
  ('ARS', 'USD', 0.00067, true),
  ('EUR', 'USD', 1.17000, true),
  ('BRL', 'USD', 0.19256, true),
  ('CAD', 'USD', 0.72754, true),
  ('CHF', 'USD', 1.25235, true),
  ('CLP', 'USD', 0.00108, true),
  ('COP', 'USD', 0.00033, true),
  ('CRC', 'USD', 0.00224, true),
  ('GBP', 'USD', 1.36710, true),
  ('GTQ', 'USD', 0.12900, true),
  ('MXN', 'USD', 0.05920, true),
  ('PEN', 'USD', 0.29847, true)
ON CONFLICT (from_currency, to_currency) DO NOTHING;
