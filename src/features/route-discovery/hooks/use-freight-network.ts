import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/services/auth-provider';
import { fetchFreightNetwork } from '../api';

export function useFreightNetwork(period: '30d' | '60d' | '90d', zoneRadius: 100 | 200 | 300 | 400) {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ['route-discovery', 'freight-network', activeCompanyId, period, zoneRadius],
    queryFn: () => fetchFreightNetwork(activeCompanyId!, period, zoneRadius),
    enabled: !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  });
}
