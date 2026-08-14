import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Mail, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSupportConfig } from "@/lib/support.functions";

export function SupportWidget() {
  const getConfig = useServerFn(getSupportConfig);

  const { data: config, isLoading } = useQuery({
    queryKey: ["support_config"],
    queryFn: () => getConfig(),
  });

  if (isLoading || !config) return null;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <CardContent className="space-y-4 pt-6">
        <div className="text-sm font-semibold text-blue-900 dark:text-blue-50">
          ¿Necesitas ayuda? Contáctanos
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {config.whatsapp_number && (
            <a
              href={`https://wa.me/${config.whatsapp_number.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-medium text-green-600 hover:bg-gray-50 dark:bg-slate-900 dark:text-green-400 dark:hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </a>
          )}

          {config.email && (
            <a
              href={`mailto:${config.email}`}
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-medium text-blue-600 hover:bg-gray-50 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </a>
          )}
        </div>

        {config.support_hours && (
          <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
            <Clock className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <div>
              <div className="font-semibold">{config.support_hours}</div>
              {config.timezone && (
                <div className="text-blue-600 dark:text-blue-400">{config.timezone}</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
