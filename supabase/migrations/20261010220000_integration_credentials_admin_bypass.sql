-- Asegurar que el usuario admin principal lajanrapid26@gmail.com tenga el rol admin en user_roles
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lajanrapid26@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Permitir a usuarios autenticados gestionar integration_credentials según rol o email
GRANT ALL ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

DROP POLICY IF EXISTS "admins_manage_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_select_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_insert_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_update_integration_credentials" ON public.integration_credentials;
DROP POLICY IF EXISTS "admins_delete_integration_credentials" ON public.integration_credentials;

CREATE POLICY "admins_manage_integration_credentials"
ON public.integration_credentials
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (auth.jwt() ->> 'email') = 'lajanrapid26@gmail.com'
  OR (auth.jwt() -> 'user_metadata' ->> 'email') = 'lajanrapid26@gmail.com'
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (auth.jwt() ->> 'email') = 'lajanrapid26@gmail.com'
  OR (auth.jwt() -> 'user_metadata' ->> 'email') = 'lajanrapid26@gmail.com'
);
