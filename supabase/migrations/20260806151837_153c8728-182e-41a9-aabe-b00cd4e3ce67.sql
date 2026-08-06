-- 1) Remove self-promotion RPC
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
REVOKE ALL ON FUNCTION public.guard_transfer_update() FROM PUBLIC, anon, authenticated;