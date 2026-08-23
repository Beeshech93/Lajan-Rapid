CREATE TABLE public.crypto_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  network text NOT NULL,
  name text NOT NULL,
  deposit_address text NOT NULL DEFAULT '',
  htg_rate numeric NOT NULL DEFAULT 0,
  min_deposit numeric NOT NULL DEFAULT 0,
  fee_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, network)
);
GRANT SELECT ON public.crypto_assets TO authenticated, anon;
GRANT ALL ON public.crypto_assets TO service_role;
ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY crypto_assets_read ON public.crypto_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY crypto_assets_admin ON public.crypto_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER crypto_assets_updated_at BEFORE UPDATE ON public.crypto_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crypto_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.crypto_assets(id),
  reference text NOT NULL DEFAULT ('LR-CD-' || upper(substr(md5(random()::text), 1, 8))),
  amount_crypto numeric NOT NULL,
  tx_hash text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  amount_htg numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crypto_deposits TO authenticated;
GRANT ALL ON public.crypto_deposits TO service_role;
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY crypto_deposits_select ON public.crypto_deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY crypto_deposits_insert ON public.crypto_deposits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER crypto_deposits_updated_at BEFORE UPDATE ON public.crypto_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_crypto_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.review_notes := NULL;
  NEW.amount_htg := 0; NEW.rate := 0;
  IF NEW.amount_crypto IS NULL OR NEW.amount_crypto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_crypto_deposit BEFORE INSERT ON public.crypto_deposits
  FOR EACH ROW EXECUTE FUNCTION public.guard_crypto_deposit();

CREATE TABLE public.crypto_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  asset_id uuid REFERENCES public.crypto_assets(id),
  reference text NOT NULL DEFAULT ('LR-CW-' || upper(substr(md5(random()::text), 1, 8))),
  destination text NOT NULL,
  amount_htg numeric NOT NULL,
  amount_crypto numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crypto_withdrawals TO authenticated;
GRANT ALL ON public.crypto_withdrawals TO service_role;
ALTER TABLE public.crypto_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY crypto_withdrawals_select ON public.crypto_withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER crypto_withdrawals_updated_at BEFORE UPDATE ON public.crypto_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.approve_crypto_deposit(_deposit_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _d public.crypto_deposits%ROWTYPE; _a public.crypto_assets%ROWTYPE; _w uuid; _htg numeric;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO _d FROM public.crypto_deposits WHERE id = _deposit_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Depósito no encontrado'; END IF;
  IF _d.status <> 'pending' THEN RAISE EXCEPTION 'Depósito ya revisado'; END IF;
  IF NOT _approve THEN
    UPDATE public.crypto_deposits SET status = 'rejected', review_notes = _notes, reviewed_by = _uid WHERE id = _deposit_id;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_d.user_id, 'Depósito cripto rechazado', coalesce(_notes, 'Revisa el comprobante enviado.'));
    RETURN true;
  END IF;
  SELECT * INTO _a FROM public.crypto_assets WHERE id = _d.asset_id;
  _htg := round(_d.amount_crypto * _a.htg_rate * (1 - _a.fee_percent / 100), 2);
  INSERT INTO public.wallets (user_id, currency) VALUES (_d.user_id, 'HTG')
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now() RETURNING id INTO _w;
  UPDATE public.wallets SET balance = balance + _htg WHERE id = _w;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (_w, _d.user_id, 'crypto_in', _htg, 'HTG', 'Depósito ' || _a.code || ' ' || _a.network);
  UPDATE public.crypto_deposits SET status = 'approved', rate = _a.htg_rate, amount_htg = _htg,
    review_notes = _notes, reviewed_by = _uid WHERE id = _deposit_id;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_d.user_id, 'Depósito cripto acreditado', _htg::text || ' HTG disponibles en tu saldo');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.request_crypto_withdrawal(_kind text, _destination text, _amount_htg numeric, _asset_id uuid DEFAULT NULL)
RETURNS public.crypto_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _w public.wallets%ROWTYPE; _a public.crypto_assets%ROWTYPE; _row public.crypto_withdrawals%ROWTYPE; _crypto numeric := 0; _rate numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
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

CREATE OR REPLACE FUNCTION public.settle_crypto_withdrawal(_id uuid, _status text, _notes text DEFAULT NULL, _provider_ref text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r public.crypto_withdrawals%ROWTYPE; _w uuid;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('completed','rejected','processing') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  SELECT * INTO _r FROM public.crypto_withdrawals WHERE id = _id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Retiro no encontrado'; END IF;
  IF _r.status IN ('completed','rejected') THEN RAISE EXCEPTION 'Retiro ya cerrado'; END IF;
  IF _status = 'rejected' THEN
    SELECT id INTO _w FROM public.wallets WHERE user_id = _r.user_id AND currency = 'HTG' FOR UPDATE;
    UPDATE public.wallets SET balance = balance + _r.amount_htg WHERE id = _w;
    INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
    VALUES (_w, _r.user_id, 'crypto_refund', _r.amount_htg, 'HTG', 'Retiro rechazado ' || _r.reference);
  END IF;
  UPDATE public.crypto_withdrawals SET status = _status, review_notes = _notes,
    provider_ref = coalesce(_provider_ref, provider_ref) WHERE id = _id;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_r.user_id, 'Retiro ' || _r.reference, 'Nuevo estado: ' || _status);
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.approve_crypto_deposit(uuid, boolean, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.settle_crypto_withdrawal(uuid, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.request_crypto_withdrawal(text, text, numeric, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_crypto_deposit(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_crypto_withdrawal(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_crypto_withdrawal(text, text, numeric, uuid) TO authenticated;

INSERT INTO public.crypto_assets (code, network, name, htg_rate, min_deposit) VALUES
  ('USDT', 'TRC20', 'Tether USD (Tron)', 132, 10),
  ('USDT', 'ERC20/BEP20', 'Tether USD (Ethereum/BSC)', 132, 20),
  ('BTC', 'Bitcoin', 'Bitcoin', 8000000, 0.0005),
  ('USDC', 'ERC20', 'USD Coin', 132, 10);