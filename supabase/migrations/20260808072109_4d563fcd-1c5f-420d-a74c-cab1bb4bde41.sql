UPDATE public.countries SET is_destination = false, is_active = CASE WHEN is_origin THEN is_active ELSE false END, updated_at = now() WHERE code <> 'HT' AND is_destination;
UPDATE public.countries SET is_destination = true, is_active = true, updated_at = now() WHERE code = 'HT';
ALTER TABLE public.transfers ALTER COLUMN delivery_method SET DEFAULT 'moncash';
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_delivery_method_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_delivery_method_check CHECK (delivery_method IN ('moncash','natcash')) NOT VALID;
ALTER TABLE public.transfers ALTER COLUMN destination_country SET DEFAULT 'HT';
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_destination_ht_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_destination_ht_check CHECK (destination_country = 'HT') NOT VALID;