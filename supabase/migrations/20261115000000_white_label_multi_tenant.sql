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

-- Seed Empresa Piloto 1: VipPip Express
INSERT INTO public.tenants (id, slug, name, legal_name, is_default, is_active, domain, subdomain, branding, content, settings)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'vippip',
  'VipPip Express',
  'VipPip Global Remittance S.A.',
  false,
  true,
  'vippip.lajanrapid.app',
  'vippip',
  '{
    "primaryColor": "#2563eb",
    "primaryDarkColor": "#1d4ed8",
    "accentColor": "#60a5fa",
    "backgroundColor": "#0a0f1d",
    "surfaceColor": "#111827",
    "textColor": "#f9fafb",
    "fontFamily": "Sora, sans-serif",
    "borderRadius": "1rem"
  }'::jsonb,
  '{
    "slogan": "Transferencias directas y seguras a Haití",
    "tagline": "Tu aliado confiable para enviar a MonCash y NatCash sin intermediarios",
    "supportEmail": "soporte@vippip.com",
    "supportPhone": "+1 (800) 847-7470",
    "supportWhatsapp": "18008477470",
    "address": "Miami, FL & Santo Domingo, RD"
  }'::jsonb,
  '{
    "allowedOrigins": ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    "allowedDestinations": ["HT"],
    "feeMarkupPercent": 0.5,
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
SET name = 'VipPip Express', is_active = true;

-- Seed Empresa Piloto 2: Kash Ayiti
INSERT INTO public.tenants (id, slug, name, legal_name, is_default, is_active, domain, subdomain, branding, content, settings)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'kash-ayiti',
  'Kash Ayiti',
  'Kash Ayiti Financial Services Ltd.',
  false,
  true,
  'kashayiti.lajanrapid.app',
  'kashayiti',
  '{
    "primaryColor": "#f59e0b",
    "primaryDarkColor": "#d97706",
    "accentColor": "#fbbf24",
    "backgroundColor": "#120e09",
    "surfaceColor": "#1c160e",
    "textColor": "#fffbeb",
    "fontFamily": "Sora, sans-serif",
    "borderRadius": "1.25rem"
  }'::jsonb,
  '{
    "slogan": "Voye lajan bay fanmi w an sekirite",
    "tagline": "Sèvis transfè lajan ki pi rapid pou Ayiti depi tout peyi",
    "supportEmail": "contact@kashayiti.com",
    "supportPhone": "+1 (829) 555-0199",
    "supportWhatsapp": "18295550199",
    "address": "Pétion-Ville, Haïti & Santiago, RD"
  }'::jsonb,
  '{
    "allowedOrigins": ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    "allowedDestinations": ["HT"],
    "feeMarkupPercent": 0.75,
    "feeMarkupFixed": 1.0,
    "enabledServices": {
      "transfers": true,
      "topups": true,
      "crypto": true,
      "virtualCards": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET name = 'Kash Ayiti', is_active = true;

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

