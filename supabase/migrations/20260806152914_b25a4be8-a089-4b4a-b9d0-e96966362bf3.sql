-- 1. Catálogo de países
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