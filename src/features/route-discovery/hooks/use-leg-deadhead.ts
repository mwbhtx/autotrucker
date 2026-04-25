import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/core/services/auth-provider";
import { fetchLegDeadhead } from "../api";

interface DeadheadQuery {
  drop_lat: number;
  drop_lng: number;
  pickup_lat: number;
  pickup_lng: number;
  radius_miles: number;
}

export function useLegDeadhead(query: DeadheadQuery | null) {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ["route-discovery", "leg-deadhead", activeCompanyId, query],
    queryFn: () => {
      if (!activeCompanyId || !query) throw new Error("missing inputs");
      return fetchLegDeadhead(activeCompanyId, query);
    },
    enabled: !!activeCompanyId && !!query,
  });
}
