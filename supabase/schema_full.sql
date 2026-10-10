-- ROLES
CREATE TYPE public.app_role AS ENUM ('client', 'agent', 'admin');
CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE public.transfer_status AS ENUM ('created', 'awaiting_payment', 'paid', 'processing', 'ready_for_pickup', 'completed', 'cancelled');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  country TEXT NOT NULL DEFAULT 'MX',
  language TEXT NOT NULL DEFAULT 'es',
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('agent','admin'));
$$;

-- KYC
CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  birth_date DATE,
  address TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- RATES
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL DEFAULT 'MXN',
  to_currency TEXT NOT NULL DEFAULT 'HTG',
  rate NUMERIC(14,6) NOT NULL,
  fee_percent NUMERIC(6,3) NOT NULL DEFAULT 2.5,
  fee_fixed NUMERIC(12,2) NOT NULL DEFAULT 25,
  agent_commission_percent NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT INSERT, UPDATE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- TRANSFERS
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_city TEXT NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'cash_pickup',
  payment_method TEXT NOT NULL DEFAULT 'oxxo',
  amount_mxn NUMERIC(12,2) NOT NULL CHECK (amount_mxn > 0),
  fee_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate NUMERIC(14,6) NOT NULL,
  amount_htg NUMERIC(14,2) NOT NULL DEFAULT 0,
  agent_commission_mxn NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.transfer_status NOT NULL DEFAULT 'awaiting_payment',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transfer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  status public.transfer_status NOT NULL,
  message TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transfer_events TO authenticated;
GRANT ALL ON public.transfer_events TO service_role;
ALTER TABLE public.transfer_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "kyc_select" ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_update_admin" ON public.kyc_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rates_select_public" ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rates_insert_admin" ON public.exchange_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rates_update_admin" ON public.exchange_rates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "transfers_select" ON public.transfers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "transfers_insert_own" ON public.transfers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "transfers_update_staff" ON public.transfers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "events_select" ON public.transfer_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))));
CREATE POLICY "events_insert" ON public.transfer_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))));

CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert_staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_kyc_upd BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_rates_upd BEFORE UPDATE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_transfers_upd BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- log status changes
CREATE OR REPLACE FUNCTION public.log_transfer_event() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transfer_events (transfer_id, status, message, actor_id)
    VALUES (NEW.id, NEW.status, 'Envío creado', NEW.user_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.transfer_events (transfer_id, status, message, actor_id)
    VALUES (NEW.id, NEW.status, 'Estado actualizado', auth.uid());
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, 'Actualización de tu envío ' || NEW.reference, 'Nuevo estado: ' || NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER t_transfer_log AFTER INSERT OR UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.log_transfer_event();

-- bootstrap admin
CREATE OR REPLACE FUNCTION public.claim_admin_if_none() RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated;

-- admin role management
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id UUID, _role public.app_role) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;

-- seed rate
INSERT INTO public.exchange_rates (rate, fee_percent, fee_fixed, agent_commission_percent, is_active)
VALUES (7.180000, 2.500, 25.00, 1.000, true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_admin_if_none() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_transfer_event() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;-- 1) Remove self-promotion RPC
DROP FUNCTION IF EXISTS public.claim_admin_if_none();

-- 2) Server-side recomputation of transfer financials
CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.exchange_rates;
BEGIN
  SELECT * INTO r FROM public.exchange_rates
  WHERE is_active = true AND from_currency = 'MXN' AND to_currency = 'HTG'
  ORDER BY created_at DESC LIMIT 1;

  IF r IS NULL THEN
    RAISE EXCEPTION 'No hay tipo de cambio activo';
  END IF;

  IF NEW.amount_mxn IS NULL OR NEW.amount_mxn <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  NEW.rate := r.rate;
  NEW.fee_mxn := round((NEW.amount_mxn * r.fee_percent / 100.0) + r.fee_fixed, 2);
  NEW.total_mxn := round(NEW.amount_mxn + NEW.fee_mxn, 2);
  NEW.amount_htg := round(NEW.amount_mxn * r.rate, 2);
  NEW.agent_commission_mxn := round(NEW.amount_mxn * r.agent_commission_percent / 100.0, 2);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_transfers_amounts ON public.transfers;
CREATE TRIGGER t_transfers_amounts
BEFORE INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.compute_transfer_amounts();

-- 3) Restrict owner updates
CREATE OR REPLACE FUNCTION public.guard_transfer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Owner: may only cancel a transfer that is still awaiting payment
  IF NEW.amount_mxn IS DISTINCT FROM OLD.amount_mxn
     OR NEW.fee_mxn IS DISTINCT FROM OLD.fee_mxn
     OR NEW.total_mxn IS DISTINCT FROM OLD.total_mxn
     OR NEW.rate IS DISTINCT FROM OLD.rate
     OR NEW.amount_htg IS DISTINCT FROM OLD.amount_htg
     OR NEW.agent_commission_mxn IS DISTINCT FROM OLD.agent_commission_mxn
     OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'No autorizado a modificar los datos del envío';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'awaiting_payment' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'Cambio de estado no permitido';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_transfers_guard ON public.transfers;
CREATE TRIGGER t_transfers_guard
BEFORE UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_update();

DROP POLICY IF EXISTS transfers_update_staff ON public.transfers;
CREATE POLICY transfers_update_staff ON public.transfers
FOR UPDATE TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY transfers_update_own_cancel ON public.transfers
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'awaiting_payment')
WITH CHECK (user_id = auth.uid());

-- 4) Lock down SECURITY DEFINER functions from direct API execution
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_transfer_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_transfer_amounts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_transfer_update() FROM PUBLIC, anon, authenticated;-- 1. Catálogo de países
CREATE TABLE public.countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  flag TEXT NOT NULL DEFAULT '',
  is_origin BOOLEAN NOT NULL DEFAULT false,
  is_destination BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.countries TO anon;
GRANT SELECT ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY countries_select_public ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY countries_insert_admin ON public.countries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY countries_update_admin ON public.countries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER t_countries_upd BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.countries (code,name,currency,flag,is_origin,is_destination) VALUES
  ('MX','México','MXN','🇲🇽',true,false),
  ('US','Estados Unidos','USD','🇺🇸',true,false),
  ('CA','Canadá','CAD','🇨🇦',true,false),
  ('CL','Chile','CLP','🇨🇱',true,false),
  ('BR','Brasil','BRL','🇧🇷',true,false),
  ('AR','Argentina','ARS','🇦🇷',true,false),
  ('CO','Colombia','COP','🇨🇴',true,false),
  ('PE','Perú','PEN','🇵🇪',true,false),
  ('EC','Ecuador','USD','🇪🇨',true,false),
  ('PA','Panamá','USD','🇵🇦',true,false),
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

-- 2. Tarifas por corredor
DELETE FROM public.exchange_rates;

CREATE UNIQUE INDEX exchange_rates_active_pair_idx
  ON public.exchange_rates (from_currency, to_currency)
  WHERE is_active;

INSERT INTO public.exchange_rates (from_currency,to_currency,rate,fee_percent,fee_fixed,agent_commission_percent,is_active) VALUES
  ('MXN','HTG',7.0800,2.5,25,1.0,true),
  ('MXN','DOP',3.3500,2.5,25,1.0,true),
  ('USD','HTG',131.0000,2.5,1.5,1.0,true),
  ('USD','DOP',62.0000,2.5,1.5,1.0,true),
  ('CAD','HTG',95.6000,2.5,2,1.0,true),
  ('CAD','DOP',45.3000,2.5,2,1.0,true),
  ('CLP','HTG',0.1380,2.5,1200,1.0,true),
  ('CLP','DOP',0.0650,2.5,1200,1.0,true),
  ('BRL','HTG',24.2600,2.5,8,1.0,true),
  ('BRL','DOP',11.4800,2.5,8,1.0,true),
  ('ARS','HTG',0.1190,2.5,1500,1.0,true),
  ('ARS','DOP',0.0560,2.5,1500,1.0,true),
  ('COP','HTG',0.0320,2.5,6000,1.0,true),
  ('COP','DOP',0.0150,2.5,6000,1.0,true),
  ('PEN','HTG',35.4000,2.5,5,1.0,true),
  ('PEN','DOP',16.7600,2.5,5,1.0,true),
  ('CRC','HTG',0.2570,2.5,800,1.0,true),
  ('CRC','DOP',0.1220,2.5,800,1.0,true),
  ('GTQ','HTG',17.0100,2.5,12,1.0,true),
  ('GTQ','DOP',8.0500,2.5,12,1.0,true),
  ('EUR','HTG',142.4000,2.5,1.5,1.0,true),
  ('EUR','DOP',67.4000,2.5,1.5,1.0,true),
  ('GBP','HTG',167.9000,2.5,1.2,1.0,true),
  ('GBP','DOP',79.5000,2.5,1.2,1.0,true),
  ('CHF','HTG',148.9000,2.5,1.5,1.0,true),
  ('CHF','DOP',70.5000,2.5,1.5,1.0,true);

-- 3. Envíos genéricos (se borran los existentes)
DELETE FROM public.transfer_events;
DELETE FROM public.transfers;

ALTER TABLE public.transfers RENAME COLUMN amount_mxn TO amount_send;
ALTER TABLE public.transfers RENAME COLUMN fee_mxn TO fee_send;
ALTER TABLE public.transfers RENAME COLUMN total_mxn TO total_send;
ALTER TABLE public.transfers RENAME COLUMN amount_htg TO amount_receive;
ALTER TABLE public.transfers RENAME COLUMN agent_commission_mxn TO agent_commission_send;

ALTER TABLE public.transfers
  ADD COLUMN origin_country TEXT NOT NULL DEFAULT 'MX',
  ADD COLUMN destination_country TEXT NOT NULL DEFAULT 'HT',
  ADD COLUMN send_currency TEXT NOT NULL DEFAULT 'MXN',
  ADD COLUMN receive_currency TEXT NOT NULL DEFAULT 'HTG';

-- 4. Cálculo servidor por corredor
CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.exchange_rates;
  oc public.countries;
  dc public.countries;
BEGIN
  SELECT * INTO oc FROM public.countries WHERE code = NEW.origin_country AND is_origin AND is_active;
  IF oc IS NULL THEN RAISE EXCEPTION 'País de origen no disponible'; END IF;

  SELECT * INTO dc FROM public.countries WHERE code = NEW.destination_country AND is_destination AND is_active;
  IF dc IS NULL THEN RAISE EXCEPTION 'País de destino no disponible'; END IF;

  NEW.send_currency := oc.currency;
  NEW.receive_currency := dc.currency;

  SELECT * INTO r FROM public.exchange_rates
  WHERE is_active = true AND from_currency = oc.currency AND to_currency = dc.currency
  ORDER BY created_at DESC LIMIT 1;

  IF r IS NULL THEN
    RAISE EXCEPTION 'No hay tipo de cambio activo para este corredor';
  END IF;

  IF NEW.amount_send IS NULL OR NEW.amount_send <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  NEW.rate := r.rate;
  NEW.fee_send := round((NEW.amount_send * r.fee_percent / 100.0) + r.fee_fixed, 2);
  NEW.total_send := round(NEW.amount_send + NEW.fee_send, 2);
  NEW.amount_receive := round(NEW.amount_send * r.rate, 2);
  NEW.agent_commission_send := round(NEW.amount_send * r.agent_commission_percent / 100.0, 2);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_transfer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_send IS DISTINCT FROM OLD.amount_send
     OR NEW.fee_send IS DISTINCT FROM OLD.fee_send
     OR NEW.total_send IS DISTINCT FROM OLD.total_send
     OR NEW.rate IS DISTINCT FROM OLD.rate
     OR NEW.amount_receive IS DISTINCT FROM OLD.amount_receive
     OR NEW.agent_commission_send IS DISTINCT FROM OLD.agent_commission_send
     OR NEW.send_currency IS DISTINCT FROM OLD.send_currency
     OR NEW.receive_currency IS DISTINCT FROM OLD.receive_currency
     OR NEW.origin_country IS DISTINCT FROM OLD.origin_country
     OR NEW.destination_country IS DISTINCT FROM OLD.destination_country
     OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'No autorizado a modificar los datos del envío';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'awaiting_payment' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'Cambio de estado no permitido';
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.compute_transfer_amounts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_transfer_update() FROM PUBLIC, anon, authenticated;
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

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.issue_virtual_card(uuid, text, text, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_card_status(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.convert_wallet(uuid, text, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.card_purchase(uuid, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_virtual_card(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_card_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_wallet(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_purchase(uuid, text, numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, country, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'MX'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'language', ''), 'es')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;CREATE TABLE public.integration_credentials (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT ALL ON public.integration_credentials TO service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo accesible desde el backend con rol de servicio.UPDATE public.countries SET is_destination = false, is_active = CASE WHEN is_origin THEN is_active ELSE false END, updated_at = now() WHERE code <> 'HT' AND is_destination;
UPDATE public.countries SET is_destination = true, is_active = true, updated_at = now() WHERE code = 'HT';
ALTER TABLE public.transfers ALTER COLUMN delivery_method SET DEFAULT 'moncash';
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_delivery_method_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_delivery_method_check CHECK (delivery_method IN ('moncash','natcash')) NOT VALID;
ALTER TABLE public.transfers ALTER COLUMN destination_country SET DEFAULT 'HT';
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_destination_ht_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_destination_ht_check CHECK (destination_country = 'HT') NOT VALID;
CREATE OR REPLACE FUNCTION public.find_user_by_phone(_phone text)
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') <> ''
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.p2p_send(_from_wallet uuid, _phone text, _amount numeric, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _from public.wallets%ROWTYPE;
  _to_user uuid;
  _to_name text;
  _to_wallet uuid;
  _from_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT * INTO _from FROM public.wallets WHERE id = _from_wallet FOR UPDATE;
  IF _from.id IS NULL THEN RAISE EXCEPTION 'Billetera no encontrada'; END IF;
  IF _from.user_id <> _uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _from.status <> 'active' THEN RAISE EXCEPTION 'Billetera no activa'; END IF;
  IF _from.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  SELECT p.id, p.full_name INTO _to_user, _to_name
  FROM public.profiles p
  WHERE regexp_replace(coalesce(p.phone,''), '\D', '', 'g') <> ''
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  LIMIT 1;

  IF _to_user IS NULL THEN RAISE EXCEPTION 'No encontramos a nadie con ese número'; END IF;
  IF _to_user = _uid THEN RAISE EXCEPTION 'No puedes enviarte dinero a ti mismo'; END IF;

  SELECT full_name INTO _from_name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.wallets (user_id, currency) VALUES (_to_user, _from.currency)
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
  RETURNING id INTO _to_wallet;

  UPDATE public.wallets SET balance = balance - _amount WHERE id = _from_wallet;
  UPDATE public.wallets SET balance = balance + _amount WHERE id = _to_wallet;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description) VALUES
    (_from_wallet, _uid, 'p2p_out', -_amount, _from.currency,
      coalesce(nullif(_note,''), 'Envío a ' || coalesce(nullif(_to_name,''), 'usuario'))),
    (_to_wallet, _to_user, 'p2p_in', _amount, _from.currency,
      coalesce(nullif(_note,''), 'Recibido de ' || coalesce(nullif(_from_name,''), 'usuario')));

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_to_user, 'Recibiste dinero',
    coalesce(nullif(_from_name,''), 'Un usuario') || ' te envió ' || _amount::text || ' ' || _from.currency);

  RETURN jsonb_build_object('ok', true, 'recipient', coalesce(_to_name,''), 'currency', _from.currency, 'amount', _amount);
END;
$$;

REVOKE ALL ON FUNCTION public.p2p_send(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p2p_send(uuid, text, numeric, text) TO authenticated;

CREATE TABLE public.topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  provider text NOT NULL DEFAULT 'dingconnect',
  provider_ref text,
  reference text NOT NULL DEFAULT ('LR-TU-'::text || upper(substr(md5((random())::text), 1, 8))),
  sku_code text NOT NULL,
  operator text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  phone text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded')),
  status_detail text,
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX topups_reference_key ON public.topups(reference);
CREATE INDEX topups_user_idx ON public.topups(user_id, created_at DESC);

GRANT SELECT ON public.topups TO authenticated;
GRANT ALL ON public.topups TO service_role;

ALTER TABLE public.topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY topups_select_own ON public.topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TRIGGER topups_updated_at BEFORE UPDATE ON public.topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_topup(
  _wallet_id uuid,
  _sku_code text,
  _operator text,
  _country_code text,
  _phone text,
  _amount numeric
) RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets;
  t public.topups;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.create_topup(uuid, text, text, text, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_topup(uuid, text, text, text, text, numeric) TO authenticated;
-- Create support configuration table
CREATE TABLE public.support_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL DEFAULT '',
  whatsapp_url text,
  email text NOT NULL DEFAULT '',
  email_subject text,
  support_hours text,
  timezone text DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one config record should exist
CREATE UNIQUE INDEX support_config_singleton ON public.support_config ((1));

GRANT SELECT ON public.support_config TO authenticated, anon;
GRANT ALL ON public.support_config TO service_role;

ALTER TABLE public.support_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_config_select ON public.support_config FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY support_config_update_admin ON public.support_config FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY support_config_insert_admin ON public.support_config FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER support_config_updated_at BEFORE UPDATE ON public.support_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get support config
CREATE OR REPLACE FUNCTION public.get_support_config()
RETURNS TABLE (
  whatsapp_number text,
  whatsapp_url text,
  email text,
  email_subject text,
  support_hours text,
  timezone text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sc.whatsapp_number,
    sc.whatsapp_url,
    sc.email,
    sc.email_subject,
    sc.support_hours,
    sc.timezone,
    sc.status
  FROM public.support_config sc
  WHERE sc.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_support_config() TO authenticated, anon;

-- Function to update support config (admin only)
CREATE OR REPLACE FUNCTION public.update_support_config(
  _whatsapp_number text DEFAULT NULL,
  _email text DEFAULT NULL,
  _support_hours text DEFAULT NULL,
  _timezone text DEFAULT NULL
)
RETURNS public.support_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config public.support_config;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar la configuración de soporte';
  END IF;

  -- Get or create config
  SELECT * INTO config FROM public.support_config LIMIT 1;
  
  IF config IS NULL THEN
    INSERT INTO public.support_config (
      whatsapp_number,
      email,
      support_hours,
      timezone
    ) VALUES (
      COALESCE(_whatsapp_number, ''),
      COALESCE(_email, ''),
      COALESCE(_support_hours, '24/7'),
      COALESCE(_timezone, 'UTC')
    )
    RETURNING * INTO config;
  ELSE
    UPDATE public.support_config SET
      whatsapp_number = COALESCE(_whatsapp_number, whatsapp_number),
      email = COALESCE(_email, email),
      support_hours = COALESCE(_support_hours, support_hours),
      timezone = COALESCE(_timezone, timezone),
      updated_at = now()
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_support_config(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_support_config(text, text, text, text) TO authenticated;
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
  ('USDC', 'ERC20', 'USD Coin', 132, 10);REVOKE EXECUTE ON FUNCTION public.guard_crypto_deposit() FROM public, anon, authenticated;ALTER TABLE public.topups ALTER COLUMN wallet_id DROP NOT NULL;

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
GRANT EXECUTE ON FUNCTION public.create_topup_direct(text, text, text, text, numeric, text) TO authenticated;ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'wallet';
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
-- Fix: una migración posterior (20260808054552) había reemplazado
-- compute_transfer_amounts() por una versión que ya NO deriva
-- send_currency/receive_currency desde origin_country/destination_country
-- (solo usaba lo que trajera la fila, cayendo siempre en el DEFAULT 'MXN'
-- porque el cliente nunca envía send_currency explícitamente). Esto causaba
-- que envíos con origin_country distinto de MX (ej. Brasil) se cobraran
-- incorrectamente en MXN. Se restaura la derivación desde public.countries.
CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.exchange_rates%ROWTYPE;
  oc public.countries%ROWTYPE;
  dc public.countries%ROWTYPE;
BEGIN
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
-- Correo de bienvenida real (separado del correo de confirmación de Supabase
-- Auth): cuando auth.users.email_confirmed_at pasa de NULL a un valor (el
-- usuario confirmó su cuenta por primera vez), se notifica de forma
-- asíncrona vía pg_net a nuestro propio webhook, que envía el correo real
-- por Resend.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_user_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $$
DECLARE
  _secret text;
  _base_url text;
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT value INTO _secret FROM public.integration_credentials
     WHERE name = 'WELCOME_EMAIL_WEBHOOK_SECRET';

    SELECT COALESCE(
      (SELECT value FROM public.integration_credentials WHERE name = 'APP_URL'),
      'https://lajanrapid.app'
    ) INTO _base_url;

    IF _secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := rtrim(_base_url, '/') || '/api/public/auth/welcome',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', _secret),
        body := jsonb_build_object(
          'email', NEW.email,
          'full_name', NEW.raw_user_meta_data->>'full_name'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.notify_user_confirmed();

REVOKE ALL ON FUNCTION public.notify_user_confirmed() FROM PUBLIC, anon, authenticated;
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
-- Auditoría de seguridad: 2 vulnerabilidades RLS críticas encontradas y corregidas.

-- 1) La política de UPDATE de 'transfers' permitía a cualquier usuario
--    actualizar CUALQUIER columna de su propia fila (status, montos, moneda,
--    comisión, etc.), ya que solo verificaba user_id = auth.uid() sin
--    restricción de columnas. Ningún flujo legítimo de la app depende de
--    esto (todos los cambios de estado pasan por supabaseAdmin en server
--    functions), así que se restringe a solo staff.
DROP POLICY IF EXISTS transfers_update ON public.transfers;
CREATE POLICY transfers_update_staff_only ON public.transfers
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 2) Cualquier usuario podía auto-aprobar su propio KYC ejecutando
--    supabase.from('profiles').update({ kyc_status: 'approved' }) desde el
--    cliente, evadiendo por completo la revisión y el bloqueo de
--    transacciones sin KYC. Se agrega un trigger: un usuario normal solo
--    puede poner su propio kyc_status en 'pending' (al enviar su
--    verificación, como ya hace la app); 'approved'/'rejected' solo los
--    puede poner el staff.
CREATE OR REPLACE FUNCTION public.protect_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    IF NEW.kyc_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'No autorizado para cambiar el estado de verificación (KYC)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_kyc_status_trigger ON public.profiles;
CREATE TRIGGER protect_kyc_status_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_kyc_status();
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_select_staff ON public.security_events
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Sin políticas de INSERT/UPDATE/DELETE para 'authenticated': solo se
-- escribe vía el service role (desde security.server.ts), nunca directo
-- desde el cliente.

-- Se revierte el valor en silencio (en vez de RAISE EXCEPTION) para que la
-- transacción SÍ se confirme y la alerta encolada con pg_net realmente se
-- envíe (una excepción aquí revertiría también esa alerta, ya que pg_net
-- encola su petición como una fila normal dentro de la misma transacción).
CREATE OR REPLACE FUNCTION public.protect_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $$
DECLARE
  _secret text;
  _base_url text;
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    IF NEW.kyc_status IS DISTINCT FROM 'pending' THEN
      SELECT value INTO _secret FROM public.integration_credentials
       WHERE name = 'WELCOME_EMAIL_WEBHOOK_SECRET';

      SELECT COALESCE(
        (SELECT value FROM public.integration_credentials WHERE name = 'APP_URL'),
        'https://lajanrapid.app'
      ) INTO _base_url;

      IF _secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := rtrim(_base_url, '/') || '/api/public/security/alert',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', _secret),
          body := jsonb_build_object(
            'event_type', 'kyc_self_approve_attempt',
            'detail', jsonb_build_object('attempted_status', NEW.kyc_status, 'user_id', auth.uid())
          )
        );
      END IF;

      NEW.kyc_status := OLD.kyc_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_set_topup_status(_topup_id uuid, _status text, _detail text DEFAULT NULL)
RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _row public.topups;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('pending','processing','completed','failed','refunded') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  UPDATE public.topups
     SET status = _status,
         status_detail = coalesce(_detail, status_detail),
         refunded = (_status = 'refunded')
   WHERE id = _topup_id
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Recarga no encontrada'; END IF;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_row.user_id, 'Recarga ' || _row.reference, 'Nuevo estado: ' || _status);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_topup_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_topup_status(uuid, text, text) TO authenticated;-- La publicación 'supabase_realtime' existía pero no tenía ninguna tabla
-- agregada — ni siquiera 'notifications', que NotificationBell ya intentaba
-- suscribir desde antes (solo funcionaba por su respaldo de refrescar cada
-- 60 segundos, nunca en tiempo real de verdad).
--
-- Idempotente a propósito: 'notifications' y 'transfers' ya estaban
-- agregadas desde la configuración inicial del proyecto, y un
-- ALTER PUBLICATION ... ADD TABLE sobre una tabla que ya es miembro falla
-- con error — lo cual abortaba toda la migración antes de llegar a
-- 'topups', 'kyc_submissions' y 'security_events'. Cada tabla ahora se
-- agrega solo si todavía no es miembro de la publicación.
DO $$
DECLARE
  _tables text[] := ARRAY['notifications', 'transfers', 'topups', 'kyc_submissions', 'security_events'];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = _t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _t);
    END IF;
  END LOOP;
END $$;
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
CREATE TABLE IF NOT EXISTS public.topup_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency)
);

ALTER TABLE public.topup_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY topup_rates_select_all ON public.topup_rates
  FOR SELECT TO authenticated USING (true);

-- Mismo criterio que exchange_rates: solo admin (no agentes) puede escribir.
CREATE POLICY topup_rates_admin_write ON public.topup_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
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
-- Storage público para las imágenes del banner de publicidad.
-- El texto/link/estado del banner se guardan en integration_credentials
-- (mismo patrón que support.functions.ts), solo la imagen necesita un bucket.
insert into storage.buckets (id, name, public)
values ('ad-banner', 'ad-banner', true)
on conflict (id) do nothing;

CREATE POLICY "ad_banner_insert_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

CREATE POLICY "ad_banner_update_staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

CREATE POLICY "ad_banner_delete_staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

-- Bucket público: cualquiera puede leer las imágenes (se muestran en
-- landing pages sin sesión), igual que cualquier otro bucket "public".
CREATE POLICY "ad_banner_select_public" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'ad-banner');
-- Bazik payout safety metadata.
-- These fields prevent concurrent payout attempts and preserve provider state
-- for reconciliation when a network timeout leaves the outcome unknown.

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS bazik_provider TEXT,
  ADD COLUMN IF NOT EXISTS bazik_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS bazik_status TEXT,
  ADD COLUMN IF NOT EXISTS bazik_error TEXT,
  ADD COLUMN IF NOT EXISTS bazik_submitted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS transfers_bazik_transaction_id_uq
  ON public.transfers (bazik_transaction_id)
  WHERE bazik_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transfers_bazik_status_idx
  ON public.transfers (bazik_status)
  WHERE bazik_status IS NOT NULL;

COMMENT ON COLUMN public.transfers.bazik_status IS
  'Provider state: submitting, pending, processing, succeeded, failed, unknown.';

COMMENT ON COLUMN public.transfers.bazik_transaction_id IS
  'Provider transaction id returned by Bazik; unique when present.';
-- Prevent concurrent duplicate provider submissions.
CREATE OR REPLACE FUNCTION public.claim_bazik_payout(_transfer_id UUID, _from_status public.transfer_status)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.transfers
     SET status = 'processing'::public.transfer_status,
         bazik_status = 'submitting',
         bazik_submitted_at = now(),
         bazik_error = NULL
   WHERE id = _transfer_id
     AND status = _from_status
     AND delivery_method IN ('moncash', 'natcash');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status) TO service_role;
-- Asignar rol admin a lajanrapid26@gmail.com si ya existe el usuario
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'lajanrapid26@gmail.com';
  IF v_user_id IS NOT NULL THEN
    -- Asegurar que tenga el rol admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Eliminar rol client para no duplicar
    DELETE FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'client';
  END IF;
END $$;

-- Actualizar trigger handle_new_user para que si se registra lajanrapid26@gmail.com sea admin automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  initial_role public.app_role := 'client';
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'lajanrapid26@gmail.com' THEN
    initial_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;
-- Permitir a los usuarios con rol admin gestionar credenciales de integraciones
GRANT ALL ON public.integration_credentials TO authenticated;

-- Eliminar políticas previas si existieran para evitar conflictos
DROP POLICY IF EXISTS "admins_manage_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_select_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_insert_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_update_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_delete_integration_credentials" ON public.integration_credentials;

-- Crear política RLS para administradores
CREATE POLICY "admins_manage_integration_credentials"
ON public.integration_credentials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
