import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getServicesConfig,
  type ServiceKey,
  type ServicesConfig,
} from "@/lib/services-config.functions";

export const SERVICES_CONFIG_QUERY_KEY = ["services_config"] as const;

export function useServicesConfig() {
  const fetchConfig = useServerFn(getServicesConfig);

  const query = useQuery<ServicesConfig>({
    queryKey: SERVICES_CONFIG_QUERY_KEY,
    queryFn: () => fetchConfig(),
    staleTime: 30_000,
  });

  const isEnabled = (key: ServiceKey): boolean => {
    return query.data ? query.data[key]?.enabled ?? true : true;
  };

  const getMessage = (key: ServiceKey): string => {
    return query.data ? query.data[key]?.message ?? "" : "";
  };

  return {
    ...query,
    config: query.data,
    isEnabled,
    getMessage,
  };
}

