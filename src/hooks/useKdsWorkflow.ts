import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKdsStations } from './useKdsStations';
import { useKdsStationLogs } from './useKdsStationLogs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  order_id: string;
  current_station_id: string | null;
  station_status: string;
  station_started_at: string | null;
  station_completed_at: string | null;
  product?: { name: string } | null;
  quantity: number;
}

export function useKdsWorkflow() {
  const queryClient = useQueryClient();
  const { activeStations, getNextStation } = useKdsStations();
  const { logAction } = useKdsStationLogs();
  const { user } = useAuth();

  // Iniciar item em uma praça
  const startItemAtStation = useMutation({
    mutationFn: async ({ itemId, stationId }: { itemId: string; stationId: string }) => {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('order_items')
        .update({
          current_station_id: stationId,
          station_status: 'in_progress',
          station_started_at: now,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Log da ação
      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId,
        action: 'started',
      });

      return { itemId, stationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      toast.error('Erro ao iniciar item na praça');
      console.error(error);
    },
  });

  // Completar item na praça atual e mover para próxima
  const completeItemAtStation = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      const now = new Date().toISOString();
      
      // Buscar dados do item para calcular duração
      const { data: item } = await supabase
        .from('order_items')
        .select('station_started_at')
        .eq('id', itemId)
        .single();

      const durationSeconds = item?.station_started_at 
        ? Math.floor((new Date().getTime() - new Date(item.station_started_at).getTime()) / 1000)
        : null;

      // Log de conclusão
      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'completed',
        durationSeconds: durationSeconds || undefined,
      });

      // Buscar próxima praça
      const nextStation = getNextStation(currentStationId);

      if (nextStation) {
        // Mover para próxima praça
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: nextStation.id,
            station_status: 'waiting',
            station_started_at: null,
            station_completed_at: now,
          })
          .eq('id', itemId);

        if (error) throw error;

        // Log de entrada na nova praça
        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        });

        return { itemId, nextStationId: nextStation.id, isComplete: false };
      } else {
        // Última praça - marcar item como entregue
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: null,
            station_status: 'done',
            station_completed_at: now,
            status: 'delivered',
          })
          .eq('id', itemId);

        if (error) throw error;

        return { itemId, nextStationId: null, isComplete: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.isComplete) {
        toast.success('Item concluído!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao completar item');
      console.error(error);
    },
  });

  // Pular item para próxima praça sem processar
  const skipItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId, reason }: { itemId: string; currentStationId: string; reason?: string }) => {
      // Log de skip
      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'skipped',
        notes: reason,
      });

      const nextStation = getNextStation(currentStationId);

      if (nextStation) {
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: nextStation.id,
            station_status: 'waiting',
            station_started_at: null,
          })
          .eq('id', itemId);

        if (error) throw error;

        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        });
      }

      return { itemId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.info('Item pulado para próxima praça');
    },
  });

  // Iniciar novo pedido no modo linha de produção
  const initializeOrderForProductionLine = useMutation({
    mutationFn: async (orderId: string) => {
      const firstStation = activeStations[0];
      if (!firstStation) throw new Error('Nenhuma praça ativa configurada');

      // Buscar itens do pedido
      const { data: items, error: fetchError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId)
        .is('current_station_id', null);

      if (fetchError) throw fetchError;

      // Mover todos os itens para a primeira praça
      for (const item of items || []) {
        await supabase
          .from('order_items')
          .update({
            current_station_id: firstStation.id,
            station_status: 'waiting',
          })
          .eq('id', item.id);

        await logAction.mutateAsync({
          orderItemId: item.id,
          stationId: firstStation.id,
          action: 'entered',
        });
      }

      // Atualizar status do pedido para preparing
      await supabase
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', orderId);

      return { orderId, itemCount: items?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Pedido iniciado com ${result.itemCount} itens`);
    },
    onError: (error) => {
      toast.error('Erro ao iniciar pedido');
      console.error(error);
    },
  });

  // Helper para obter itens por praça
  const getItemsByStation = (items: OrderItem[], stationId: string) => {
    return items.filter(item => item.current_station_id === stationId);
  };

  // Helper para obter itens aguardando (sem praça atribuída)
  const getWaitingItems = (items: OrderItem[]) => {
    return items.filter(item => !item.current_station_id && item.station_status !== 'done');
  };

  return {
    startItemAtStation,
    completeItemAtStation,
    skipItemToNextStation,
    initializeOrderForProductionLine,
    getItemsByStation,
    getWaitingItems,
  };
}
