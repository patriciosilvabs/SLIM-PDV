import { useQuery } from '@tanstack/react-query';
import {
  listCancelledOrders,
  listOrderReopens,
  listProfilesByIds,
  listTables,
  listTableSwitches,
} from '@/lib/firebaseTenantCrud';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';

export type AuditEventType = 'reopen' | 'table_switch' | 'cancellation' | 'item_deletion';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  description: string;
  order_id: string | null;
  table_number: number | null;
  value: number | null;
  reason: string | null;
}

interface UseAuditEventsParams {
  startDate?: string;
  endDate?: string;
  types?: AuditEventType[];
  userId?: string;
}

export function useAuditEvents(params: UseAuditEventsParams = {}) {
  const { startDate, endDate, types, userId } = params;

  return useQuery({
    queryKey: ['audit-events', startDate, endDate, types, userId],
    queryFn: async () => {
      const events: AuditEvent[] = [];
      const tenantId = await resolveCurrentTenantId();
      const tables = tenantId ? await listTables(tenantId) : [];
      const tableById = new Map(tables.map((t) => [t.id, t.number]));

      if (tenantId && (!types || types.includes('reopen'))) {
        const reopens = await listOrderReopens(tenantId, {
          startDateIso: startDate,
          endDateIso: endDate ? `${endDate}T23:59:59` : undefined,
          userId,
          max: 500,
        });

        if (reopens.length) {
          const userIds = [...new Set(reopens.map((r) => r.reopened_by).filter(Boolean))] as string[];
          const profiles = await listProfilesByIds(userIds);
          const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

          for (const reopen of reopens) {
            events.push({
              id: reopen.id,
              type: 'reopen',
              timestamp: reopen.reopened_at,
              user_id: reopen.reopened_by,
              user_name: profileMap.get(reopen.reopened_by) || null,
              description: `Reabriu mesa ${reopen.table_id ? tableById.get(reopen.table_id) || '?' : '?'}`,
              order_id: reopen.order_id,
              table_number: reopen.table_id ? tableById.get(reopen.table_id) || null : null,
              value: reopen.total_value,
              reason: reopen.reason,
            });
          }
        }
      }

      if (tenantId && (!types || types.includes('table_switch'))) {
        const switches = await listTableSwitches(tenantId, {
          startDateIso: startDate,
          endDateIso: endDate ? `${endDate}T23:59:59` : undefined,
          userId,
          max: 500,
        });

        if (switches.length) {
          const userIds = [...new Set(switches.map((s) => s.switched_by).filter(Boolean))] as string[];
          const profiles = await listProfilesByIds(userIds);
          const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

          for (const sw of switches) {
            events.push({
              id: sw.id,
              type: 'table_switch',
              timestamp: sw.switched_at,
              user_id: sw.switched_by,
              user_name: profileMap.get(sw.switched_by) || null,
              description: `Trocou mesa ${sw.from_table_id ? tableById.get(sw.from_table_id) || '?' : '?'} -> ${sw.to_table_id ? tableById.get(sw.to_table_id) || '?' : '?'}`,
              order_id: sw.order_id,
              table_number: sw.from_table_id ? tableById.get(sw.from_table_id) || null : null,
              value: null,
              reason: sw.reason,
            });
          }
        }
      }

      if (tenantId && (!types || types.includes('cancellation'))) {
        const cancellations = await listCancelledOrders(tenantId, {
          cancelledStartIso: startDate,
          cancelledEndIso: endDate ? `${endDate}T23:59:59` : undefined,
          cancelledBy: userId,
          max: 1000,
        });

        if (cancellations.length) {
          const userIds = [...new Set(cancellations.map((c) => c.created_by).filter(Boolean))] as string[];
          const profiles = await listProfilesByIds(userIds);
          const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

          for (const cancel of cancellations) {
            events.push({
              id: cancel.id,
              type: 'cancellation',
              timestamp: cancel.updated_at || cancel.created_at || '',
              user_id: cancel.created_by || null,
              user_name: cancel.created_by ? profileMap.get(cancel.created_by) || null : null,
              description: cancel.table_id
                ? `Cancelou pedido da mesa ${tableById.get(cancel.table_id) || '?'}`
                : `Cancelou pedido ${cancel.order_type === 'delivery' ? 'delivery' : 'balcao'}`,
              order_id: cancel.id,
              table_number: cancel.table_id ? tableById.get(cancel.table_id) || null : null,
              value: cancel.total || 0,
              reason: cancel.notes || cancel.cancellation_reason || null,
            });
          }
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events;
    },
  });
}

export function useAuditStats(startDate?: string, endDate?: string) {
  const { data: events } = useAuditEvents({ startDate, endDate });

  const stats = {
    total: events?.length || 0,
    reopens: events?.filter((e) => e.type === 'reopen').length || 0,
    switches: events?.filter((e) => e.type === 'table_switch').length || 0,
    cancellations: events?.filter((e) => e.type === 'cancellation').length || 0,
    totalValue: events?.reduce((sum, e) => sum + (e.value || 0), 0) || 0,
  };

  return stats;
}
