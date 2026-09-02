ALTER TABLE public.topups ALTER COLUMN wallet_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_topup_direct(
  _sku_code text,
  _operator text,
  _country_code text,
  _phone text,
  _amount numeric,
  _currency text
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

  INSERT INTO public.topups (user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency, status)
  VALUES (_uid, NULL, _sku_code, coalesce(_operator, ''), coalesce(_country_code, ''), _phone, _amount, coalesce(nullif(_currency, ''), 'USD'), 'pending')
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_topup_direct(text, text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_topup_direct(text, text, text, text, numeric, text) TO authenticated;