import { useEffect, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Se suscribe a cambios en tiempo real (Supabase Realtime) de una tabla y
 * refresca automáticamente la query correspondiente, sin recargar la
 * página. Cada instancia usa un nombre de canal único (useId) para evitar
 * colisiones cuando el mismo componente se monta más de una vez a la vez
 * (ver el bug de NotificationBell corregido antes).
 */
export function useRealtimeInvalidate(table: string, queryKey: unknown[]) {
  const qc = useQueryClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void qc.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, instanceId, qc]);
}
