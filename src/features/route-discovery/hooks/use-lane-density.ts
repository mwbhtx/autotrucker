import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/services/auth-provider";
import { fetchLaneDensity } from "../api";

interface LaneQuery {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  radius_miles: number;
}

export function useLaneDensity(query: LaneQuery | null) {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ["route-discovery", "lane-density", activeCompanyId, query],
    queryFn: () => {
      if (!activeCompanyId || !query) throw new Error("missing inputs");
      return fetchLaneDensity(activeCompanyId, query);
    },
    enabled: !!activeCompanyId && !!query,
  });
}
