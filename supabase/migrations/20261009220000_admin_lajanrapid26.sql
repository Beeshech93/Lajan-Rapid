-- Asignar rol admin a lajanrapid26@gmail.com si ya existe el usuario
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'lajanrapid26@gmail.com';
  IF v_user_id IS NOT NULL THEN
    -- Asegurar que tenga el rol admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Eliminar rol client para no duplicar
    DELETE FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'client';
  END IF;
END $$;

-- Actualizar trigger handle_new_user para que si se registra lajanrapid26@gmail.com sea admin automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  initial_role public.app_role := 'client';
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'lajanrapid26@gmail.com' THEN
    initial_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;
