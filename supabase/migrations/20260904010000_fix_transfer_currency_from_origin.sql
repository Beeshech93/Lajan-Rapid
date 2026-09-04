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
