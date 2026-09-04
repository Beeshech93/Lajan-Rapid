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
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT value INTO _secret FROM public.integration_credentials
     WHERE name = 'WELCOME_EMAIL_WEBHOOK_SECRET';

    IF _secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://lajanrapid-app.lovable.app/api/public/auth/welcome',
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
