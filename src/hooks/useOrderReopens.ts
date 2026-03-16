import { useQuery } from '@tanstack/react-query';
import { createOrderReopen, listOrderReopens, listProfilesByIds, listTables } from '@/lib/firebaseTenantCrud';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';

export interface OrderReopen {
  id: string;
  order_id: string;
  table_id: string | null;
  previous_status: string;
  new_status: string;
  reopened_by: string | null;
  reopened_at: string;
  reason: string | null;
  order_type: string | null;
  customer_name: string | null;
  total_value: number | null;
  table?: { number: number } | null;
  reopened_by_name?: string | null;
}

export function useOrderReopens(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['order-reopens', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) return [];

      let endDateIso: string | undefined;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        endDateIso = endOfDay.toISOString();
      }

      const [data, tables] = await Promise.all([
        listOrderReopens(tenantId, {
          startDateIso: startDate?.toISOString(),
          endDateIso,
          max: 500,
        }),
        listTables(tenantId),
      ]);

      const tableById = new Map(tables.map((t) => [t.id, t]));
      const userIds = [...new Set(data.filter((r) => r.reopened_by).map((r) => r.reopened_by as string))];

      if (userIds.length > 0) {
        const profiles = await listProfilesByIds(userIds);
        const profileMap = new Map(profiles.map((p) => [p.id, p.name]));

        return data.map((reopen) => ({
          ...reopen,
          table: reopen.table_id ? { number: tableById.get(reopen.table_id)?.number || 0 } : null,
          reopened_by_name: reopen.reopened_by ? profileMap.get(reopen.reopened_by) || 'Desconhecido' : null,
        })) as OrderReopen[];
      }

      return data.map((reopen) => ({
        ...reopen,
        table: reopen.table_id ? { number: tableById.get(reopen.table_id)?.number || 0 } : null,
      })) as OrderReopen[];
    },
  });
}

export function useOrderReopenMutations() {
  const createReopen = async (data: {
    order_id: string;
    table_id?: string | null;
    previous_status: string;
    new_status: string;
    reopened_by?: string | null;
    reason?: string | null;
    order_type?: string | null;
    customer_name?: string | null;
    total_value?: number | null;
  }) => {
    const tenantId = await resolveCurrentTenantId();
    if (!tenantId) throw new Error('Tenant nao encontrado');
    await createOrderReopen(tenantId, {
      order_id: data.order_id,
      table_id: data.table_id ?? null,
      previous_status: data.previous_status,
      new_status: data.new_status,
      reopened_by: data.reopened_by ?? null,
      reason: data.reason ?? null,
      order_type: data.order_type ?? null,
      customer_name: data.customer_name ?? null,
      total_value: data.total_value ?? null,
    });
  };

  return { createReopen };
}

