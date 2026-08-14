import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupportConfig } from "@/lib/support.functions";

export interface SupportConfig {
  whatsapp_number?: string;
  email?: string;
  support_hours?: string;
  timezone?: string;
  status?: string;
}

export function useSupportConfig() {
  const getConfig = useServerFn(getSupportConfig);

  return useQuery({
    queryKey: ["support_config"],
    queryFn: () => getConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
