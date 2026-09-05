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
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    IF NEW.kyc_status IS DISTINCT FROM 'pending' THEN
      SELECT value INTO _secret FROM public.integration_credentials
       WHERE name = 'WELCOME_EMAIL_WEBHOOK_SECRET';
      IF _secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://lajanrapid-app.lovable.app/api/public/security/alert',
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
