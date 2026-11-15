-- Multi-tenant White Label schema
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  domain TEXT UNIQUE,
  subdomain TEXT UNIQUE,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default Lajan Rapid primary tenant
INSERT INTO public.tenants (id, slug, name, legal_name, is_default, is_active, domain, subdomain, branding, content, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Lajan Rapid',
  'Lajan Rapid Financial Services S.R.L.',
  true,
  true,
  'lajanrapid.com',
  'app',
  '{
    "primaryColor": "#10b981",
    "primaryDarkColor": "#059669",
    "accentColor": "#34d399",
    "backgroundColor": "#0b1426",
    "surfaceColor": "#121d33",
    "textColor": "#f8fafc",
    "fontFamily": "Sora, sans-serif",
    "borderRadius": "1.25rem"
  }'::jsonb,
  '{
    "slogan": "Envía dinero y recarga a Haití en minutos",
    "tagline": "El servicio más rápido y seguro de remesas directas a MonCash y NatCash",
    "supportEmail": "lajanrapid26@gmail.com",
    "supportPhone": "+1 (829) 341-7169",
    "supportWhatsapp": "18293417169",
    "address": "Santo Domingo, República Dominicana"
  }'::jsonb,
  '{
    "allowedOrigins": ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    "allowedDestinations": ["HT"],
    "feeMarkupPercent": 0,
    "feeMarkupFixed": 0,
    "enabledServices": {
      "transfers": true,
      "topups": true,
      "crypto": true,
      "virtualCards": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET is_default = true, name = 'Lajan Rapid';

-- Add tenant_id to transfers and profiles if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- Enable RLS on tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_public_read" ON public.tenants
  FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "tenants_admin_manage" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
