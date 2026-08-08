
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.issue_virtual_card(uuid, text, text, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_card_status(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.convert_wallet(uuid, text, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.card_purchase(uuid, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_virtual_card(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_card_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_wallet(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_purchase(uuid, text, numeric) TO authenticated;
