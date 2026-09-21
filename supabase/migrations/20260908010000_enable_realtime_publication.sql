-- La publicación 'supabase_realtime' existía pero no tenía ninguna tabla
-- agregada — ni siquiera 'notifications', que NotificationBell ya intentaba
-- suscribir desde antes (solo funcionaba por su respaldo de refrescar cada
-- 60 segundos, nunca en tiempo real de verdad).
--
-- Idempotente a propósito: 'notifications' y 'transfers' ya estaban
-- agregadas desde la configuración inicial del proyecto, y un
-- ALTER PUBLICATION ... ADD TABLE sobre una tabla que ya es miembro falla
-- con error — lo cual abortaba toda la migración antes de llegar a
-- 'topups', 'kyc_submissions' y 'security_events'. Cada tabla ahora se
-- agrega solo si todavía no es miembro de la publicación.
DO $$
DECLARE
  _tables text[] := ARRAY['notifications', 'transfers', 'topups', 'kyc_submissions', 'security_events'];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = _t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _t);
    END IF;
  END LOOP;
END $$;
