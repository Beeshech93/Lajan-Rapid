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
