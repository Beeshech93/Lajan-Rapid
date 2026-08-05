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
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;