import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/services/auth-provider';
import { fetchZoneDetail } from '../api';

export function useZoneDetail(zoneKey: string | null, period: '30d' | '60d' | '90d') {
  const { activeCompanyId } = useAuth();
  return useQuery({
    queryKey: ['route-discovery', 'zone-detail', activeCompanyId, zoneKey, period],
    queryFn: () => fetchZoneDetail(activeCompanyId!, zoneKey!, period),
    enabled: !!activeCompanyId && !!zoneKey,
    staleTime: 5 * 60 * 1000,
  });
}
