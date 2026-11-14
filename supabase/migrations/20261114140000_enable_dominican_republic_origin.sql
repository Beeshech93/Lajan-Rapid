-- Habilitar República Dominicana (DO) como país de origen activo, pero NO de destino (solo recibe Haití)
UPDATE public.countries
SET is_origin = true,
    is_destination = false,
    is_active = true,
    currency = 'DOP',
    flag = '🇩🇴',
    updated_at = now()
WHERE code = 'DO';

-- Asegurar que cualquier otro país que no sea Haití tenga is_destination = false
UPDATE public.countries
SET is_destination = false
WHERE code <> 'HT';

-- Asegurar que Haití sea el único país de destino
UPDATE public.countries
SET is_destination = true, is_active = true
WHERE code = 'HT';

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

