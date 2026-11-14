-- Habilitar República Dominicana (DO) como país de origen activo, pero NO de destino (solo recibe Haití)
INSERT INTO public.countries (code, name, currency, flag, is_origin, is_destination, is_active)
VALUES ('DO', 'Rep. Dominicana', 'DOP', '🇩🇴', true, false, true)
ON CONFLICT (code) DO UPDATE
SET is_origin = true,
    is_destination = false,
    is_active = true,
    currency = 'DOP',
    flag = '🇩🇴',
    updated_at = now();

-- Asegurar tipo de cambio activo para el corredor República Dominicana (DOP) -> Haití (HTG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.exchange_rates
    WHERE from_currency = 'DOP' AND to_currency = 'HTG' AND is_active = true
  ) THEN
    INSERT INTO public.exchange_rates (from_currency, to_currency, rate, fee_percent, fee_fixed, agent_commission_percent, is_active)
    VALUES ('DOP', 'HTG', 2.20, 2.5, 50.0, 1.0, true);
  END IF;
END $$;

