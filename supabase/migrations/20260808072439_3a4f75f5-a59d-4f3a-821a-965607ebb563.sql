
CREATE OR REPLACE FUNCTION public.find_user_by_phone(_phone text)
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') <> ''
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.p2p_send(_from_wallet uuid, _phone text, _amount numeric, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _from public.wallets%ROWTYPE;
  _to_user uuid;
  _to_name text;
  _to_wallet uuid;
  _from_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT * INTO _from FROM public.wallets WHERE id = _from_wallet FOR UPDATE;
  IF _from.id IS NULL THEN RAISE EXCEPTION 'Billetera no encontrada'; END IF;
  IF _from.user_id <> _uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _from.status <> 'active' THEN RAISE EXCEPTION 'Billetera no activa'; END IF;
  IF _from.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  SELECT p.id, p.full_name INTO _to_user, _to_name
  FROM public.profiles p
  WHERE regexp_replace(coalesce(p.phone,''), '\D', '', 'g') <> ''
    AND regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  LIMIT 1;

  IF _to_user IS NULL THEN RAISE EXCEPTION 'No encontramos a nadie con ese número'; END IF;
  IF _to_user = _uid THEN RAISE EXCEPTION 'No puedes enviarte dinero a ti mismo'; END IF;

  SELECT full_name INTO _from_name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.wallets (user_id, currency) VALUES (_to_user, _from.currency)
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now()
  RETURNING id INTO _to_wallet;

  UPDATE public.wallets SET balance = balance - _amount WHERE id = _from_wallet;
  UPDATE public.wallets SET balance = balance + _amount WHERE id = _to_wallet;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description) VALUES
    (_from_wallet, _uid, 'p2p_out', -_amount, _from.currency,
      coalesce(nullif(_note,''), 'Envío a ' || coalesce(nullif(_to_name,''), 'usuario'))),
    (_to_wallet, _to_user, 'p2p_in', _amount, _from.currency,
      coalesce(nullif(_note,''), 'Recibido de ' || coalesce(nullif(_from_name,''), 'usuario')));

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_to_user, 'Recibiste dinero',
    coalesce(nullif(_from_name,''), 'Un usuario') || ' te envió ' || _amount::text || ' ' || _from.currency);

  RETURN jsonb_build_object('ok', true, 'recipient', coalesce(_to_name,''), 'currency', _from.currency, 'amount', _amount);
END;
$$;

REVOKE ALL ON FUNCTION public.p2p_send(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p2p_send(uuid, text, numeric, text) TO authenticated;
