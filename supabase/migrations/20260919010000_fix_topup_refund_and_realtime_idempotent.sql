-- Columnas para rastrear el monto/moneda real descontado de la billetera
-- (distinto de amount/currency, que desde la tasa manual de recargas
-- representa la moneda del OPERADOR, no la de la billetera).
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS pay_amount numeric;
ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS pay_currency text;

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

  INSERT INTO public.topups (
    user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency,
    pay_amount, pay_currency
  )
  VALUES (
    auth.uid(), w.id, _sku_code, coalesce(_operator,''), coalesce(_country_code,''), _phone,
    coalesce(_topup_amount, _amount), coalesce(nullif(_topup_currency, ''), w.currency),
    _amount, w.currency
  )
  RETURNING * INTO t;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (w.id, auth.uid(), 'topup_out', -_amount, w.currency, 'Recarga ' || coalesce(_operator,'') || ' ' || _phone);

  RETURN t;
END;
$$;

-- admin_set_topup_status marcaba refunded=true SIN devolver el dinero a la
-- billetera, y esa bandera bloqueaba que el reembolso automático real
-- (applyDingResult) lo hiciera después — el usuario perdía el saldo para
-- siempre. Ahora esta función SÍ acredita el monto real descontado
-- (pay_amount/pay_currency), con el mismo criterio de guardia que usa el
-- reembolso automático (no reembolsar dos veces, solo si vino de billetera).
CREATE OR REPLACE FUNCTION public.admin_set_topup_status(_topup_id uuid, _status text, _detail text DEFAULT NULL)
RETURNS topups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.topups;
  _wallet public.wallets;
  _did_refund boolean := false;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('pending','processing','completed','failed','refunded') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _row FROM public.topups WHERE id = _topup_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Recarga no encontrada'; END IF;

  IF _status IN ('failed', 'refunded') AND NOT coalesce(_row.refunded, false) AND _row.wallet_id IS NOT NULL THEN
    SELECT * INTO _wallet FROM public.wallets WHERE id = _row.wallet_id FOR UPDATE;
    IF _wallet.id IS NOT NULL THEN
      UPDATE public.wallets
         SET balance = balance + coalesce(_row.pay_amount, _row.amount), updated_at = now()
       WHERE id = _wallet.id;
      INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
      VALUES (
        _wallet.id, _row.user_id, 'topup_refund',
        coalesce(_row.pay_amount, _row.amount), coalesce(_row.pay_currency, _row.currency),
        'Devolución de recarga ' || _row.reference
      );
      _did_refund := true;
    END IF;
  END IF;

  UPDATE public.topups
     SET status = _status,
         status_detail = coalesce(_detail, status_detail),
         refunded = refunded OR _did_refund
   WHERE id = _topup_id
   RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_row.user_id, 'Recarga ' || _row.reference, 'Nuevo estado: ' || _status);

  RETURN _row;
END;
$$;
