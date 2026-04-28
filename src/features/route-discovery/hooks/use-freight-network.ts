import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/services/auth-provider';
import { fetchFreightNetwork } from '../api';

export function useFreightNetwork(period: '30d' | '90d' | 'all') {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ['route-discovery', 'freight-network', activeCompanyId, period],
    queryFn: () => fetchFreightNetwork(activeCompanyId!, period),
    enabled: !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  });
}
