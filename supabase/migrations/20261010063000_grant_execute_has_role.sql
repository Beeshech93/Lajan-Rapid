-- Asegurar permisos de ejecución en has_role e is_staff para evitar errores 401 en llamadas RPC desde el servidor
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO anon, authenticated, service_role;
