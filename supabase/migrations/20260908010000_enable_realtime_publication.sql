-- La publicación 'supabase_realtime' existía pero no tenía ninguna tabla
-- agregada — ni siquiera 'notifications', que NotificationBell ya intentaba
-- suscribir desde antes (solo funcionaba por su respaldo de refrescar cada
-- 60 segundos, nunca en tiempo real de verdad).
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;
