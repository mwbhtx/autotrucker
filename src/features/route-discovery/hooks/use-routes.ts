import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/services/auth-provider";
import { fetchDiscoveredRoutes, type RoutesQuery } from "../api";

export function useDiscoveredRoutes(query: RoutesQuery | null) {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ["route-discovery", "routes", activeCompanyId, query],
    queryFn: () => {
      if (!activeCompanyId || !query) throw new Error("missing inputs");
      return fetchDiscoveredRoutes(activeCompanyId, query);
    },
    enabled: !!activeCompanyId && !!query,
  });
}
