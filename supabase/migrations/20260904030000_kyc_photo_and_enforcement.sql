-- Storage privado para las fotos de documento de KYC.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

CREATE POLICY "kyc_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kyc_docs_select_own_or_staff" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())
    )
  );

-- Fotos del documento (frente obligatorio, reverso opcional).
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS document_photo_path text;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS document_back_path text;

-- Un envío no puede crearse si el usuario (NEW.user_id) no tiene el KYC
-- aprobado. Antes solo se mostraba una advertencia visual; ahora se
-- bloquea también a nivel de base de datos (no se puede evadir insertando
-- directo en la tabla).
CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.exchange_rates%ROWTYPE;
  oc public.countries%ROWTYPE;
  dc public.countries%ROWTYPE;
  _kyc public.kyc_status;
BEGIN
  SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = NEW.user_id;
  IF _kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de enviar dinero' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO oc FROM public.countries WHERE code = NEW.origin_country AND is_origin AND is_active;
  IF oc.code IS NULL THEN RAISE EXCEPTION 'País de origen no disponible'; END IF;

  SELECT * INTO dc FROM public.countries WHERE code = NEW.destination_country AND is_destination AND is_active;
  IF dc.code IS NULL THEN RAISE EXCEPTION 'País de destino no disponible'; END IF;

  NEW.send_currency := oc.currency;
  NEW.receive_currency := dc.currency;

  SELECT * INTO r FROM public.exchange_rates
   WHERE is_active AND from_currency = NEW.send_currency AND to_currency = NEW.receive_currency
   ORDER BY created_at DESC LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Sin tipo de cambio disponible para ese corredor'; END IF;
  IF NEW.amount_send <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  NEW.rate := r.rate;
  NEW.fee_send := round(NEW.amount_send * r.fee_percent / 100 + r.fee_fixed, 2);
  NEW.total_send := round(NEW.amount_send + NEW.fee_send, 2);
  NEW.amount_receive := round(NEW.amount_send * r.rate, 2);
  NEW.agent_commission_send := round(NEW.amount_send * r.agent_commission_percent / 100, 2);
  IF NOT public.is_staff(auth.uid()) THEN NEW.status := 'awaiting_payment'; NEW.agent_id := NULL; END IF;
  RETURN NEW;
END; $$;

-- Mismo bloqueo para retiros cripto (moncash/natcash/crypto).
CREATE OR REPLACE FUNCTION public.request_crypto_withdrawal(_kind text, _destination text, _amount_htg numeric, _asset_id uuid DEFAULT NULL)
RETURNS public.crypto_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _w public.wallets%ROWTYPE; _a public.crypto_assets%ROWTYPE; _row public.crypto_withdrawals%ROWTYPE; _crypto numeric := 0; _rate numeric := 0; _kyc public.kyc_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = _uid;
  IF _kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de retirar' USING ERRCODE = 'P0001';
  END IF;
  IF _kind NOT IN ('moncash','natcash','crypto') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF _amount_htg IS NULL OR _amount_htg <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _kind = 'crypto' THEN
    SELECT * INTO _a FROM public.crypto_assets WHERE id = _asset_id AND is_active;
    IF _a.id IS NULL THEN RAISE EXCEPTION 'Cripto no disponible'; END IF;
    IF _a.htg_rate <= 0 THEN RAISE EXCEPTION 'Sin tasa configurada'; END IF;
    _rate := _a.htg_rate;
    _crypto := round((_amount_htg / _a.htg_rate) * (1 - _a.fee_percent / 100), 8);
  END IF;
  SELECT * INTO _w FROM public.wallets WHERE user_id = _uid AND currency = 'HTG' FOR UPDATE;
  IF _w.id IS NULL THEN RAISE EXCEPTION 'Sin saldo en gourdes'; END IF;
  IF _w.balance < _amount_htg THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE public.wallets SET balance = balance - _amount_htg WHERE id = _w.id;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (_w.id, _uid, 'crypto_out', -_amount_htg, 'HTG', 'Retiro ' || _kind || ' ' || _destination);
  INSERT INTO public.crypto_withdrawals (user_id, kind, asset_id, destination, amount_htg, amount_crypto, rate)
  VALUES (_uid, _kind, _asset_id, _destination, _amount_htg, _crypto, _rate) RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Mismo bloqueo para recargas pagadas con billetera.
CREATE OR REPLACE FUNCTION public.create_topup(
  _wallet_id uuid, _sku_code text, _operator text, _country_code text, _phone text, _amount numeric
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
  VALUES (auth.uid(), w.id, _sku_code, coalesce(_operator,''), coalesce(_country_code,''), _phone, _amount, w.currency)
  RETURNING * INTO t;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (w.id, auth.uid(), 'topup_out', -_amount, w.currency, 'Recarga ' || coalesce(_operator,'') || ' ' || _phone);

  RETURN t;
END;
$$;

-- Mismo bloqueo para recargas con pago externo (tarjeta/OXXO/SPEI).
CREATE OR REPLACE FUNCTION public.create_topup_direct(
  _sku_code text, _operator text, _country_code text, _phone text, _amount numeric, _currency text
) RETURNS public.topups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _row public.topups; _kyc public.kyc_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = _uid;
  IF _kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de recargar' USING ERRCODE = 'P0001';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  INSERT INTO public.topups (user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency, status)
  VALUES (_uid, NULL, _sku_code, coalesce(_operator, ''), coalesce(_country_code, ''), _phone, _amount, coalesce(nullif(_currency, ''), 'USD'), 'pending')
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_topup_pending(
  _sku_code text, _operator text, _country_code text, _phone text, _amount numeric, _currency text,
  _payment_method text, _origin_country text
) RETURNS public.topups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _row public.topups; _kyc public.kyc_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = _uid;
  IF _kyc IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de recargar' USING ERRCODE = 'P0001';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
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
