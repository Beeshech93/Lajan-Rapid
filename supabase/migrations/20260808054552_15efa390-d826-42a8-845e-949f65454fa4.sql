
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('client','agent','admin');
CREATE TYPE public.kyc_status AS ENUM ('none','pending','approved','rejected');
CREATE TYPE public.transfer_status AS ENUM ('created','awaiting_payment','paid','processing','ready_for_pickup','completed','cancelled');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  phone text,
  country text NOT NULL DEFAULT 'MX',
  language text NOT NULL DEFAULT 'es',
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== ROLES =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('agent','admin'));
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  RETURN true;
END; $$;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY roles_select_own ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== KYC =====
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  birth_date date,
  address text,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY kyc_select_own ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY kyc_insert_own ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY kyc_update_staff ON public.kyc_submissions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_profile_kyc_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    NEW.kyc_status := OLD.kyc_status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_profile_kyc_update BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_kyc_update();

CREATE OR REPLACE FUNCTION public.guard_kyc_submission_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.review_notes := NULL;
  ELSE
    NEW.status := OLD.status; NEW.reviewed_by := OLD.reviewed_by; NEW.review_notes := OLD.review_notes;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_kyc_submission_status BEFORE INSERT OR UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_submission_status();

CREATE TRIGGER kyc_updated_at BEFORE UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== COUNTRIES / RATES =====
CREATE TABLE public.countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  currency text NOT NULL,
  flag text NOT NULL DEFAULT '',
  is_origin boolean NOT NULL DEFAULT false,
  is_destination boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY countries_public_read ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY countries_admin_write ON public.countries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL DEFAULT 'MXN',
  to_currency text NOT NULL DEFAULT 'HTG',
  rate numeric(14,6) NOT NULL,
  fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  fee_fixed numeric(10,2) NOT NULL DEFAULT 0,
  agent_commission_percent numeric(6,3) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency)
);
GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rates_public_read ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY rates_admin_write ON public.exchange_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER rates_updated_at BEFORE UPDATE ON public.exchange_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER countries_updated_at BEFORE UPDATE ON public.countries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.countries (code,name,currency,flag,is_origin,is_destination) VALUES
('MX','México','MXN','🇲🇽',true,false),
('US','Estados Unidos','USD','🇺🇸',true,false),
('CA','Canadá','CAD','🇨🇦',true,false),
('BR','Brasil','BRL','🇧🇷',true,false),
('CL','Chile','CLP','🇨🇱',true,false),
('AR','Argentina','ARS','🇦🇷',true,false),
('CO','Colombia','COP','🇨🇴',true,false),
('PE','Perú','PEN','🇵🇪',true,false),
('CR','Costa Rica','CRC','🇨🇷',true,false),
('GT','Guatemala','GTQ','🇬🇹',true,false),
('ES','España','EUR','🇪🇸',true,false),
('FR','Francia','EUR','🇫🇷',true,false),
('DE','Alemania','EUR','🇩🇪',true,false),
('IT','Italia','EUR','🇮🇹',true,false),
('PT','Portugal','EUR','🇵🇹',true,false),
('NL','Países Bajos','EUR','🇳🇱',true,false),
('BE','Bélgica','EUR','🇧🇪',true,false),
('CH','Suiza','CHF','🇨🇭',true,false),
('GB','Reino Unido','GBP','🇬🇧',true,false),
('HT','Haití','HTG','🇭🇹',false,true),
('DO','República Dominicana','DOP','🇩🇴',false,true);

INSERT INTO public.exchange_rates (from_currency,to_currency,rate,fee_percent,fee_fixed,agent_commission_percent) VALUES
('MXN','HTG',7.35,1.5,15,0.8),('MXN','DOP',3.15,1.5,15,0.8),
('USD','HTG',131.50,1.2,2.99,0.8),('USD','DOP',60.20,1.2,2.99,0.8),
('EUR','HTG',142.30,1.2,2.99,0.8),('EUR','DOP',65.10,1.2,2.99,0.8),
('CAD','HTG',96.40,1.3,3.5,0.8),('CAD','DOP',44.10,1.3,3.5,0.8),
('GBP','HTG',166.20,1.2,2.5,0.8),('GBP','DOP',76.00,1.2,2.5,0.8),
('CHF','HTG',148.70,1.3,3,0.8),('CHF','DOP',68.00,1.3,3,0.8),
('BRL','HTG',24.10,1.5,5,0.8),('BRL','DOP',11.00,1.5,5,0.8),
('CLP','HTG',0.14,1.5,900,0.8),('CLP','DOP',0.064,1.5,900,0.8),
('ARS','HTG',0.11,1.5,900,0.8),('ARS','DOP',0.05,1.5,900,0.8),
('COP','HTG',0.033,1.5,4000,0.8),('COP','DOP',0.015,1.5,4000,0.8),
('PEN','HTG',35.10,1.5,4,0.8),('PEN','DOP',16.05,1.5,4,0.8),
('CRC','HTG',0.25,1.5,700,0.8),('CRC','DOP',0.115,1.5,700,0.8),
('GTQ','HTG',17.00,1.5,10,0.8),('GTQ','DOP',7.80,1.5,10,0.8);

-- ===== TRANSFERS =====
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  reference text NOT NULL DEFAULT ('RH-' || upper(substr(md5(random()::text),1,8))),
  origin_country text NOT NULL DEFAULT 'MX',
  destination_country text NOT NULL DEFAULT 'HT',
  send_currency text NOT NULL DEFAULT 'MXN',
  receive_currency text NOT NULL DEFAULT 'HTG',
  amount_send numeric(14,2) NOT NULL,
  fee_send numeric(14,2) NOT NULL DEFAULT 0,
  total_send numeric(14,2) NOT NULL DEFAULT 0,
  rate numeric(14,6) NOT NULL,
  amount_receive numeric(14,2) NOT NULL DEFAULT 0,
  agent_commission_send numeric(14,2) NOT NULL DEFAULT 0,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_city text NOT NULL,
  delivery_method text NOT NULL DEFAULT 'cash_pickup',
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  note text,
  status public.transfer_status NOT NULL DEFAULT 'awaiting_payment',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfers_select ON public.transfers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY transfers_insert_own ON public.transfers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY transfers_update ON public.transfers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER transfers_updated_at BEFORE UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.exchange_rates%ROWTYPE;
BEGIN
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
CREATE TRIGGER compute_transfer_amounts BEFORE INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.compute_transfer_amounts();

CREATE OR REPLACE FUNCTION public.guard_transfer_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  NEW.amount_send := OLD.amount_send; NEW.fee_send := OLD.fee_send; NEW.total_send := OLD.total_send;
  NEW.rate := OLD.rate; NEW.amount_receive := OLD.amount_receive;
  NEW.agent_commission_send := OLD.agent_commission_send; NEW.agent_id := OLD.agent_id;
  NEW.user_id := OLD.user_id; NEW.reference := OLD.reference;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status IN ('created','awaiting_payment') AND NEW.status = 'cancelled') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_transfer_update BEFORE UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_update();

CREATE TABLE public.transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  status public.transfer_status NOT NULL,
  message text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transfer_events TO authenticated;
GRANT ALL ON public.transfer_events TO service_role;
ALTER TABLE public.transfer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select ON public.transfer_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND t.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.log_transfer_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.transfer_events (transfer_id, status, actor_id) VALUES (NEW.id, NEW.status, auth.uid());
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, 'Actualización de tu envío ' || NEW.reference, 'Nuevo estado: ' || NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER log_transfer_event AFTER INSERT OR UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.log_transfer_event();

-- ===== WALLETS =====
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallets_select_own ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_tx_select_own ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.virtual_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sandbox',
  provider_card_id text,
  brand text NOT NULL DEFAULT 'visa',
  last4 text NOT NULL,
  exp_month int NOT NULL,
  exp_year int NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_disposable boolean NOT NULL DEFAULT false,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.virtual_cards TO authenticated;
GRANT ALL ON public.virtual_cards TO service_role;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY cards_select_own ON public.virtual_cards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON public.virtual_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.card_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL UNIQUE REFERENCES public.virtual_cards(id) ON DELETE CASCADE,
  per_transaction numeric(14,2) NOT NULL DEFAULT 500,
  daily_limit numeric(14,2) NOT NULL DEFAULT 1000,
  monthly_limit numeric(14,2) NOT NULL DEFAULT 5000,
  online_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.card_limits TO authenticated;
GRANT ALL ON public.card_limits TO service_role;
ALTER TABLE public.card_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_limits_select ON public.card_limits FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.virtual_cards c WHERE c.id = card_id AND c.user_id = auth.uid()));
CREATE POLICY card_limits_staff_write ON public.card_limits FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER card_limits_updated_at BEFORE UPDATE ON public.card_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.virtual_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  merchant text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.card_transactions TO authenticated;
GRANT ALL ON public.card_transactions TO service_role;
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_tx_select_own ON public.card_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ===== WALLET / CARD RPCs =====
CREATE OR REPLACE FUNCTION public.ensure_wallet(_currency text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _currency NOT IN ('MXN','USD','HTG','DOP','EUR') THEN RAISE EXCEPTION 'Moneda no soportada'; END IF;
  INSERT INTO public.wallets (user_id, currency) VALUES (_uid, _currency)
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.issue_virtual_card(_wallet_id uuid, _brand text DEFAULT 'visa', _label text DEFAULT NULL, _disposable boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _card uuid;
BEGIN
  SELECT user_id INTO _owner FROM public.wallets WHERE id = _wallet_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Billetera no encontrada'; END IF;
  IF _owner <> _uid AND NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF (SELECT kyc_status FROM public.profiles WHERE id = _owner) <> 'approved' THEN
    RAISE EXCEPTION 'Se requiere verificación de identidad aprobada';
  END IF;
  IF _brand NOT IN ('visa','mastercard') THEN RAISE EXCEPTION 'Marca no soportada'; END IF;
  INSERT INTO public.virtual_cards (user_id, wallet_id, brand, last4, exp_month, exp_year, label, is_disposable)
  VALUES (_owner, _wallet_id, _brand, lpad((floor(random()*10000))::int::text, 4, '0'),
          1 + floor(random()*12)::int, extract(year from now())::int + 3, _label, _disposable)
  RETURNING id INTO _card;
  INSERT INTO public.card_limits (card_id) VALUES (_card);
  RETURN _card;
END; $$;

CREATE OR REPLACE FUNCTION public.set_card_status(_card_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid;
BEGIN
  SELECT user_id INTO _owner FROM public.virtual_cards WHERE id = _card_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Tarjeta no encontrada'; END IF;
  IF _owner <> _uid AND NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('active','frozen','cancelled') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF _status = 'cancelled' AND NOT public.is_staff(_uid) AND _owner <> _uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.virtual_cards SET status = _status WHERE id = _card_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_wallet_id uuid, _amount numeric, _description text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _w public.wallets%ROWTYPE;
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO _w FROM public.wallets WHERE id = _wallet_id FOR UPDATE;
  IF _w.id IS NULL THEN RAISE EXCEPTION 'Billetera no encontrada'; END IF;
  IF _w.balance + _amount < 0 THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE public.wallets SET balance = balance + _amount WHERE id = _wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (_wallet_id, _w.user_id, CASE WHEN _amount >= 0 THEN 'deposit' ELSE 'withdrawal' END, _amount, _w.currency, _description);
  RETURN _w.balance + _amount;
END; $$;

CREATE OR REPLACE FUNCTION public.convert_wallet(_from_wallet uuid, _to_currency text, _amount numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _from public.wallets%ROWTYPE; _to_id uuid; _rate numeric; _converted numeric;
BEGIN
  SELECT * INTO _from FROM public.wallets WHERE id = _from_wallet FOR UPDATE;
  IF _from.id IS NULL THEN RAISE EXCEPTION 'Billetera no encontrada'; END IF;
  IF _from.user_id <> _uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _from.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  IF _to_currency = _from.currency THEN RAISE EXCEPTION 'Misma moneda'; END IF;
  SELECT rate INTO _rate FROM public.exchange_rates
   WHERE is_active AND from_currency = _from.currency AND to_currency = _to_currency
   ORDER BY created_at DESC LIMIT 1;
  IF _rate IS NULL THEN RAISE EXCEPTION 'Sin tipo de cambio para ese par'; END IF;
  _converted := round(_amount * _rate, 2);
  INSERT INTO public.wallets (user_id, currency) VALUES (_uid, _to_currency)
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now() RETURNING id INTO _to_id;
  UPDATE public.wallets SET balance = balance - _amount WHERE id = _from_wallet;
  UPDATE public.wallets SET balance = balance + _converted WHERE id = _to_id;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description) VALUES
    (_from_wallet, _uid, 'conversion_out', -_amount, _from.currency, 'Conversión a ' || _to_currency),
    (_to_id, _uid, 'conversion_in', _converted, _to_currency, 'Conversión desde ' || _from.currency);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.card_purchase(_card_id uuid, _merchant text, _amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.virtual_cards%ROWTYPE; _w public.wallets%ROWTYPE;
        _lim public.card_limits%ROWTYPE; _spent_day numeric; _spent_month numeric; _tx uuid; _reason text;
BEGIN
  SELECT * INTO _c FROM public.virtual_cards WHERE id = _card_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Tarjeta no encontrada'; END IF;
  IF _c.user_id <> _uid AND NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  SELECT * INTO _w FROM public.wallets WHERE id = _c.wallet_id FOR UPDATE;
  SELECT * INTO _lim FROM public.card_limits WHERE card_id = _card_id;
  SELECT COALESCE(sum(amount),0) INTO _spent_day FROM public.card_transactions
   WHERE card_id = _card_id AND status = 'approved' AND created_at >= date_trunc('day', now());
  SELECT COALESCE(sum(amount),0) INTO _spent_month FROM public.card_transactions
   WHERE card_id = _card_id AND status = 'approved' AND created_at >= date_trunc('month', now());
  IF _c.status <> 'active' THEN _reason := 'Tarjeta no activa';
  ELSIF _lim.id IS NOT NULL AND NOT _lim.online_enabled THEN _reason := 'Compras en línea desactivadas';
  ELSIF _lim.id IS NOT NULL AND _amount > _lim.per_transaction THEN _reason := 'Supera el límite por compra';
  ELSIF _lim.id IS NOT NULL AND _spent_day + _amount > _lim.daily_limit THEN _reason := 'Supera el límite diario';
  ELSIF _lim.id IS NOT NULL AND _spent_month + _amount > _lim.monthly_limit THEN _reason := 'Supera el límite mensual';
  ELSIF _w.balance < _amount THEN _reason := 'Saldo insuficiente';
  END IF;
  IF _reason IS NOT NULL THEN
    INSERT INTO public.card_transactions (card_id, user_id, merchant, amount, currency, status, decline_reason)
    VALUES (_card_id, _c.user_id, _merchant, _amount, _w.currency, 'declined', _reason) RETURNING id INTO _tx;
    RETURN _tx;
  END IF;
  UPDATE public.wallets SET balance = balance - _amount WHERE id = _w.id;
  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (_w.id, _c.user_id, 'card_purchase', -_amount, _w.currency, _merchant);
  INSERT INTO public.card_transactions (card_id, user_id, merchant, amount, currency, status)
  VALUES (_card_id, _c.user_id, _merchant, _amount, _w.currency, 'approved') RETURNING id INTO _tx;
  IF _c.is_disposable THEN UPDATE public.virtual_cards SET status = 'cancelled' WHERE id = _card_id; END IF;
  RETURN _tx;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_kyc_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_kyc_submission_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_transfer_amounts() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_transfer_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_transfer_event() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
