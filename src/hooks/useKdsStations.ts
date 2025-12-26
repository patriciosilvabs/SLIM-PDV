import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

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
  prep_start: 'Em preparação',
  item_assembly: 'Item em montagem',
  assembly: 'Em Produção',
  oven_expedite: 'Item em Finalização',
  order_status: 'Status do Pedido',
  custom: 'Personalizada',
};

export function useKdsStations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ['kds-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kds_stations')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as KdsStation[];
    },
  });

  const activeStations = stations.filter(s => s.is_active);
  
  // Estações de produção (exclui order_status)
  const productionStations = activeStations.filter(s => s.station_type !== 'order_status');
  
  // Estação de status do pedido
  const orderStatusStation = activeStations.find(s => s.station_type === 'order_status');

  const createStation = useMutation({
    mutationFn: async (station: Omit<KdsStation, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('kds_stations')
        .insert({ ...station, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar praça', description: error.message, variant: 'destructive' });
    },
  });

  const updateStation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KdsStation> & { id: string }) => {
      const { data, error } = await supabase
        .from('kds_stations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça atualizada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar praça', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kds_stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
      toast({ title: 'Praça excluída com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir praça', description: error.message, variant: 'destructive' });
    },
  });

  const toggleStationActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('kds_stations')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-stations'] });
    },
  });

  // Buscar praça por tipo
  const getStationByType = (type: StationType): KdsStation | undefined => {
    return stations.find(s => s.station_type === type && s.is_active);
  };

  // Buscar próxima praça na sequência (apenas praças de produção)
  const getNextStation = (currentStationId: string): KdsStation | undefined => {
    const currentIndex = productionStations.findIndex(s => s.id === currentStationId);
    if (currentIndex === -1 || currentIndex >= productionStations.length - 1) return undefined;
    return productionStations[currentIndex + 1];
  };
  
  // Verificar se é a última estação de produção
  const isLastProductionStation = (stationId: string): boolean => {
    const currentIndex = productionStations.findIndex(s => s.id === stationId);
    return currentIndex === productionStations.length - 1;
  };

  return {
    stations,
    activeStations,
    productionStations,
    orderStatusStation,
    isLoading,
    error,
    createStation,
    updateStation,
    deleteStation,
    toggleStationActive,
    getStationByType,
    getNextStation,
    isLastProductionStation,
  };
}
