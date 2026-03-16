import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { listProfilesByIds, listTenantMembers } from '@/lib/firebaseTenantCrud';

export interface Employee {
  id: string;
  name: string;
}

export function useEmployees() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async (): Promise<Employee[]> => {
      if (!tenantId) return [];

      const members = await listTenantMembers(tenantId);
      if (!members.length) return [];

      const profiles = await listProfilesByIds(members.map((m) => m.user_id));
      return (profiles || [])
        .map((p) => ({ id: p.id, name: p.name || 'Usuario' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!tenantId,
  });
}
