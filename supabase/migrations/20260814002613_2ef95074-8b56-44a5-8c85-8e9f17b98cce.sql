
CREATE TABLE public.topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  provider text NOT NULL DEFAULT 'dingconnect',
  provider_ref text,
  reference text NOT NULL DEFAULT ('LR-TU-'::text || upper(substr(md5((random())::text), 1, 8))),
  sku_code text NOT NULL,
  operator text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  phone text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded')),
  status_detail text,
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX topups_reference_key ON public.topups(reference);
CREATE INDEX topups_user_idx ON public.topups(user_id, created_at DESC);

GRANT SELECT ON public.topups TO authenticated;
GRANT ALL ON public.topups TO service_role;

ALTER TABLE public.topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY topups_select_own ON public.topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TRIGGER topups_updated_at BEFORE UPDATE ON public.topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_topup(
  _wallet_id uuid,
  _sku_code text,
  _operator text,
  _country_code text,
  _phone text,
  _amount numeric
) RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets;
  t public.topups;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE id = _wallet_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billetera no encontrada';
  END IF;
  IF w.balance < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = w.id;

  INSERT INTO public.topups (user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency)
  VALUES (auth.uid(), w.id, _sku_code, coalesce(_operator,''), coalesce(_country_code,''), _phone, _amount, w.currency)
  RETURNING * INTO t;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (w.id, auth.uid(), 'topup_out', -_amount, w.currency, 'Recarga ' || coalesce(_operator,'') || ' ' || _phone);

  RETURN t;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_topup(uuid, text, text, text, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_topup(uuid, text, text, text, text, numeric) TO authenticated;
