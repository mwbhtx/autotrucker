import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/services/auth-provider";
import { fetchRegionInspector } from "../api";

interface RegionQuery {
  city: string;
  state: string;
  radius_miles: number;
}

export function useRegionInspector(query: RegionQuery | null) {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ["route-discovery", "region", activeCompanyId, query],
    queryFn: () => {
      if (!activeCompanyId || !query) throw new Error("missing inputs");
      return fetchRegionInspector(activeCompanyId, query);
    },
    enabled: !!activeCompanyId && !!query,
  });
}
