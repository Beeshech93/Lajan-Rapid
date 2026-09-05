import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortDate } from "@/lib/remesa";

const SEVERITY_TONE: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

export function SecurityPanel() {
  const { data: events } = useQuery({
    queryKey: ["security_events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4" /> Eventos de seguridad
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Firmas de webhook inválidas, intentos de auto-aprobar KYC y otras acciones no autorizadas
          detectadas automáticamente. Configura un correo de alertas en la pestaña Correo para
          recibir avisos en tiempo real.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {(events ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin eventos de seguridad registrados.
          </p>
        )}
        {(events ?? []).map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{e.event_type}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{shortDate(e.created_at)}</p>
              {e.detail && Object.keys(e.detail as object).length > 0 && (
                <pre className="mt-1.5 max-w-md overflow-x-auto rounded bg-muted p-2 text-[11px]">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              )}
            </div>
            <Badge className={SEVERITY_TONE[e.severity] ?? ""} variant="secondary">
              {e.severity}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
