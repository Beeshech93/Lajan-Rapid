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
