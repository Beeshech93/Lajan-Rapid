ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'wallet';
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS origin_country text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.create_topup_pending(
  _sku_code text,
  _operator text,
  _country_code text,
  _phone text,
  _amount numeric,
  _currency text,
  _payment_method text,
  _origin_country text
) RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.topups;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;
  IF _payment_method NOT IN ('card', 'oxxo', 'spei', 'mercado_pago') THEN
    RAISE EXCEPTION 'Método de pago no soportado para recarga con pago externo';
  END IF;

  INSERT INTO public.topups (
    user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency,
    status, payment_method, origin_country
  )
  VALUES (
    _uid, NULL, _sku_code, coalesce(_operator, ''), coalesce(_country_code, ''), _phone,
    _amount, coalesce(nullif(_currency, ''), 'USD'),
    'pending', _payment_method, coalesce(_origin_country, '')
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_topup_pending(text, text, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_topup_pending(text, text, text, text, numeric, text, text, text) TO authenticated;
