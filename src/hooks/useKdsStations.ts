import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from './useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { backendClient } from '@/integrations/backend/client';
import { getStoredKdsDeviceTenantId, hasActiveKdsDeviceSession } from '@/lib/kdsDeviceSession';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { toast } from 'sonner';

export interface KdsStation {
  id: string;
  name: string;
  station_type: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StationType = 'prep_start' | 'item_assembly' | 'assembly' | 'oven_expedite' | 'order_status' | 'custom';

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  prep_start: 'Em preparacao',
  item_assembly: 'Item em montagem',
  assembly: 'Em Producao',
  oven_expedite: 'Item em Finalizacao',
  order_status: 'Item Pronto',
  custom: 'Personalizada',
};

async function invokeKdsStationsAdmin<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await backendClient.functions.invoke('kds-data', { body });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  return data as T;
}

export function useKdsStations(options?: { enabled?: boolean; tenantIdOverride?: string | null }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const effectiveTenantId = options?.tenantIdOverride || tenantId || getStoredKdsDeviceTenantId() || null;
  const enabled = options?.enabled ?? !hasActiveKdsDeviceSession();
  const canQueryStations = enabled && !!user?.id;

  const resolveTenantIdForWrite = async () => {
    const tenantIdForWrite = effectiveTenantId || await resolveCurrentTenantId();
    if (!tenantIdForWrite) {
      throw new Error('Tenant nao encontrado');
    }
    return tenantIdForWrite;
  };

  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ['kds-stations', effectiveTenantId],
    queryFn: async () => {
      const tenantIdForQuery = effectiveTenantId || await resolveCurrentTenantId();
      if (!tenantIdForQuery) return [];
      const result = await invokeKdsStationsAdmin<{ stations: KdsStation[] }>({
        action: 'list_stations',
        tenant_id: tenantIdForQuery,
      });
      return result.stations ?? [];
    },
    enabled: canQueryStations,
  });

  const activeStations = stations.filter((s) => s.is_active);
  const productionStations = activeStations.filter((s) => s.station_type !== 'order_status');
  const orderStatusStations = activeStations.filter((s) => s.station_type === 'order_status');
  const orderStatusStation = orderStatusStations[0];

  const createStation = useMutation({
    mutationFn: async (station: Omit<KdsStation, 'id' | 'created_at' | 'updated_at'>) => {
      const tenantIdForWrite = await resolveTenantIdForWrite();
      const result = await invokeKdsStationsAdmin<{ station: KdsStation }>({
        action: 'create_station',
        tenant_id: tenantIdForWrite,
        ...station,
      });
      return result.station;
    },
    onSuccess: (createdStation) => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      if (createdStation?.id && effectiveTenantId) {
        queryClient.setQueryData<KdsStation[]>(
          ['kds-stations', effectiveTenantId],
          (current = []) => [...current, createdStation].sort((a, b) => a.sort_order - b.sort_order)
        );
      }
      toast.success('Setor criado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao criar setor: ${error.message}`);
    },
  });

  const updateStation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KdsStation> & { id: string }) => {
      const tenantIdForWrite = await resolveTenantIdForWrite();
      const result = await invokeKdsStationsAdmin<{ station: KdsStation }>({
        action: 'update_station',
        tenant_id: tenantIdForWrite,
        station_id: id,
        ...updates,
      });
      return result.station;
    },
    onSuccess: (updatedStation) => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      if (updatedStation?.id && effectiveTenantId) {
        queryClient.setQueryData<KdsStation[]>(
          ['kds-stations', effectiveTenantId],
          (current = []) => current.map((station) => (
            station.id === updatedStation.id ? updatedStation : station
          ))
        );
      }
      toast.success('Setor atualizado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar setor: ${error.message}`);
    },
  });

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const tenantIdForWrite = await resolveTenantIdForWrite();
      await invokeKdsStationsAdmin({
        action: 'delete_station',
        tenant_id: tenantIdForWrite,
        station_id: id,
      });
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      if (effectiveTenantId) {
        queryClient.setQueryData<KdsStation[]>(
          ['kds-stations', effectiveTenantId],
          (current = []) => current.filter((station) => station.id !== deletedId)
        );
      }
      toast.success('Setor excluido com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir setor: ${error.message}`);
    },
  });

  const toggleStationActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const tenantIdForWrite = await resolveTenantIdForWrite();
      const result = await invokeKdsStationsAdmin<{ station: KdsStation }>({
        action: 'toggle_station_active',
        tenant_id: tenantIdForWrite,
        station_id: id,
        is_active,
      });
      return result.station;
    },
    onSuccess: (updatedStation) => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      if (updatedStation?.id && effectiveTenantId) {
        queryClient.setQueryData<KdsStation[]>(
          ['kds-stations', effectiveTenantId],
          (current = []) => current.map((station) => (
            station.id === updatedStation.id ? updatedStation : station
          ))
        );
      }
    },
  });

  const getStationByType = (type: StationType): KdsStation | undefined => {
    return stations.find((s) => s.station_type === type && s.is_active);
  };

  const getNextStation = (currentStationId: string): KdsStation | undefined => {
    const currentIndex = productionStations.findIndex((s) => s.id === currentStationId);
    if (currentIndex === -1 || currentIndex >= productionStations.length - 1) return undefined;
    return productionStations[currentIndex + 1];
  };

  const isLastProductionStation = (stationId: string): boolean => {
    const currentIndex = productionStations.findIndex((s) => s.id === stationId);
    return currentIndex === productionStations.length - 1;
  };

  const reorderStations = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const tenantIdForWrite = await resolveTenantIdForWrite();
      await invokeKdsStationsAdmin({
        action: 'reorder_stations',
        tenant_id: tenantIdForWrite,
        ordered_ids: orderedIds,
      });
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['kds-stations', effectiveTenantId] });
      const previousStations = queryClient.getQueryData<KdsStation[]>(['kds-stations', effectiveTenantId]);

      if (effectiveTenantId && previousStations) {
        const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
        queryClient.setQueryData<KdsStation[]>(
          ['kds-stations', effectiveTenantId],
          previousStations
            .map((station) => ({
              ...station,
              sort_order: orderMap.get(station.id) ?? station.sort_order,
            }))
            .sort((a, b) => a.sort_order - b.sort_order)
        );
      }

      return { previousStations };
    },
    onError: (error, _orderedIds, context) => {
      if (effectiveTenantId && context?.previousStations) {
        queryClient.setQueryData(['kds-stations', effectiveTenantId], context.previousStations);
      }
      toast.error(`Erro ao reordenar setores: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast.success('Ordem dos setores atualizada');
    },
  });

  return {
    stations,
    activeStations,
    productionStations,
    orderStatusStation,
    orderStatusStations,
    isLoading,
    error,
    createStation,
    updateStation,
    deleteStation,
    toggleStationActive,
    reorderStations,
    getStationByType,
    getNextStation,
    isLastProductionStation,
  };
}
