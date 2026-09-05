-- Auditoría de seguridad: 2 vulnerabilidades RLS críticas encontradas y corregidas.

-- 1) La política de UPDATE de 'transfers' permitía a cualquier usuario
--    actualizar CUALQUIER columna de su propia fila (status, montos, moneda,
--    comisión, etc.), ya que solo verificaba user_id = auth.uid() sin
--    restricción de columnas. Ningún flujo legítimo de la app depende de
--    esto (todos los cambios de estado pasan por supabaseAdmin en server
--    functions), así que se restringe a solo staff.
DROP POLICY IF EXISTS transfers_update ON public.transfers;
CREATE POLICY transfers_update_staff_only ON public.transfers
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 2) Cualquier usuario podía auto-aprobar su propio KYC ejecutando
--    supabase.from('profiles').update({ kyc_status: 'approved' }) desde el
--    cliente, evadiendo por completo la revisión y el bloqueo de
--    transacciones sin KYC. Se agrega un trigger: un usuario normal solo
--    puede poner su propio kyc_status en 'pending' (al enviar su
--    verificación, como ya hace la app); 'approved'/'rejected' solo los
--    puede poner el staff.
CREATE OR REPLACE FUNCTION public.protect_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    IF NEW.kyc_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'No autorizado para cambiar el estado de verificación (KYC)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_kyc_status_trigger ON public.profiles;
CREATE TRIGGER protect_kyc_status_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_kyc_status();
