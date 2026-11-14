import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyPermissions,
  type AdminTabId,
  type AdminPermissionsConfig,
  ALL_ADMIN_TAB_IDS,
} from "@/lib/admin-permissions.functions";

export const MY_ADMIN_PERMISSIONS_KEY = ["my-admin-permissions"] as const;

export function useAdminPermissions() {
  const fetchMyPermissions = useServerFn(getMyPermissions);

  const query = useQuery<AdminPermissionsConfig>({
    queryKey: MY_ADMIN_PERMISSIONS_KEY,
    queryFn: () => fetchMyPermissions(),
    staleTime: 30_000,
  });

  const isSuperAdmin = query.data?.isSuperAdmin ?? true;
  const allowedTabs = isSuperAdmin ? ALL_ADMIN_TAB_IDS : (query.data?.allowedTabs ?? []);

  const hasTabPermission = (tabId: AdminTabId): boolean => {
    if (query.isLoading) return true; // evitar parpadeo mientras carga
    if (isSuperAdmin) return true;
    return allowedTabs.includes(tabId);
  };

  return {
    ...query,
    isSuperAdmin,
    allowedTabs,
    hasTabPermission,
  };
}

