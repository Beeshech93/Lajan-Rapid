CREATE OR REPLACE FUNCTION public.admin_set_topup_status(_topup_id uuid, _status text, _detail text DEFAULT NULL)
RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _row public.topups;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('pending','processing','completed','failed','refunded') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  UPDATE public.topups
     SET status = _status,
         status_detail = coalesce(_detail, status_detail),
         refunded = (_status = 'refunded')
   WHERE id = _topup_id
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Recarga no encontrada'; END IF;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_row.user_id, 'Recarga ' || _row.reference, 'Nuevo estado: ' || _status);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_topup_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_topup_status(uuid, text, text) TO authenticated;