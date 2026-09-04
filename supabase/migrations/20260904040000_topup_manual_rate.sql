-- El monto que el pagador paga (en su moneda) y el monto que realmente se
-- envía al operador (en la moneda del operador, calculado con la tasa
-- manual configurada en /admin, la misma tabla exchange_rates que usan los
-- envíos de dinero) pueden ser distintos. Antes, create_topup usaba el mismo
-- valor para ambas cosas (descuento de billetera Y envío a DingConnect),
-- ignorando la moneda real que el operador espera.
CREATE OR REPLACE FUNCTION public.create_topup(
  _wallet_id uuid, _sku_code text, _operator text, _country_code text, _phone text, _amount numeric,
  _topup_amount numeric DEFAULT NULL, _topup_currency text DEFAULT NULL
) RETURNS public.topups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  t public.topups;
  _kyc public.kyc_status;
BEGIN
  SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = auth.uid();
  IF _kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de recargar' USING ERRCODE = 'P0001';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE id = _wallet_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billetera no encontrada';
  END IF;
  IF w.balance < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = w.id;

  INSERT INTO public.topups (user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency)
  VALUES (
    auth.uid(), w.id, _sku_code, coalesce(_operator,''), coalesce(_country_code,''), _phone,
    coalesce(_topup_amount, _amount), coalesce(nullif(_topup_currency, ''), w.currency)
  )
  RETURNING * INTO t;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (w.id, auth.uid(), 'topup_out', -_amount, w.currency, 'Recarga ' || coalesce(_operator,'') || ' ' || _phone);

  RETURN t;
END;
$$;
