import { useQuery } from '@tanstack/react-query';
import { listProfilesByIds, listTables, listTableSwitches } from '@/lib/firebaseTenantCrud';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';

export interface TableSwitch {
  id: string;
  order_id: string;
  from_table_id: string;
  to_table_id: string;
  switched_by: string | null;
  switched_at: string;
  reason: string | null;
  from_table?: { number: number } | null;
  to_table?: { number: number } | null;
  switched_by_name?: string | null;
}

export function useTableSwitches(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['table-switches', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<TableSwitch[]> => {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) return [];

      const switches = await listTableSwitches(tenantId, {
        startDateIso: startDate?.toISOString(),
        endDateIso: endDate?.toISOString(),
        max: 100,
      });

      const userIds = [...new Set(switches.filter((s) => s.switched_by).map((s) => s.switched_by as string))];
      const tableIds = [
        ...new Set(
          switches.flatMap((s) => [s.from_table_id, s.to_table_id]).filter((id): id is string => Boolean(id))
        ),
      ];

      const [profiles, tables] = await Promise.all([
        userIds.length ? listProfilesByIds(userIds) : Promise.resolve([]),
        tableIds.length ? listTables(tenantId) : Promise.resolve([]),
      ]);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));
      const tableMap = new Map((tables || []).map((t) => [t.id, t.number]));

      return switches.map((s) => ({
        ...s,
        from_table: s.from_table_id ? { number: tableMap.get(s.from_table_id) || 0 } : null,
        to_table: s.to_table_id ? { number: tableMap.get(s.to_table_id) || 0 } : null,
        switched_by_name: s.switched_by ? profileMap.get(s.switched_by) || null : null,
      })) as TableSwitch[];
    },
  });
}

