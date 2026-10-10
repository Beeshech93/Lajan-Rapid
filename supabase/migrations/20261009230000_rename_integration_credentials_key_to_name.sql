-- Renombrar columna key -> name en integration_credentials
-- para consistencia con el código TypeScript que usa la columna "name"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integration_credentials'
      AND column_name = 'key'
  ) THEN
    ALTER TABLE public.integration_credentials RENAME COLUMN key TO name;
  END IF;
END $$;

-- Asegurar constraint unique en name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_credentials_name_key'
      AND conrelid = 'public.integration_credentials'::regclass
  ) THEN
    ALTER TABLE public.integration_credentials ADD CONSTRAINT integration_credentials_name_key UNIQUE (name);
  END IF;
END $$;
