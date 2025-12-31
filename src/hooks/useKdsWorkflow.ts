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

interface OrderData {
  id: string;
  order_items: OrderItem[];
  [key: string]: unknown;
}

export function useKdsWorkflow() {
  const queryClient = useQueryClient();
  const { activeStations, getNextStation, orderStatusStation, isLastProductionStation } = useKdsStations();
  const { logAction } = useKdsStationLogs();
  const { user } = useAuth();

  // Mover item diretamente para a próxima estação (clique único) - OTIMIZADO
  const moveItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      const now = new Date().toISOString();
      
      // Buscar próxima praça de produção
      const nextStation = getNextStation(currentStationId);
      const targetStationId = nextStation?.id || orderStatusStation?.id || null;

      // CRÍTICO: Update primeiro (mais importante)
      if (nextStation) {
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
      } else if (orderStatusStation) {
        const { error } = await supabase
          .from('order_items')
          .update({
            current_station_id: orderStatusStation.id,
            station_status: 'waiting',
            station_started_at: null,
            station_completed_at: now,
          })
          .eq('id', itemId);

        if (error) throw error;
      } else {
        // Sem estação de status - marcar item como done
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
      }

      // Logs em paralelo (fire-and-forget, não bloqueiam)
      Promise.all([
        logAction.mutateAsync({
          orderItemId: itemId,
          stationId: currentStationId,
          action: 'completed',
        }).catch(() => {}),
        targetStationId ? logAction.mutateAsync({
          orderItemId: itemId,
          stationId: targetStationId,
          action: 'entered',
        }).catch(() => {}) : Promise.resolve(),
      ]);

      // Verificar se pedido está pronto (em background)
      if (!nextStation) {
        supabase
          .from('order_items')
          .select('order_id')
          .eq('id', itemId)
          .single()
          .then(({ data: itemData }) => {
            if (itemData?.order_id) {
              supabase
                .from('order_items')
                .select('id, current_station_id, station_status')
                .eq('order_id', itemData.order_id)
                .then(({ data: allItems }) => {
                  const allItemsReady = allItems?.every(item => 
                    (orderStatusStation && item.current_station_id === orderStatusStation.id) ||
                    item.station_status === 'done'
                  );
                  if (allItemsReady) {
                    supabase
                      .from('orders')
                      .update({ status: 'ready', ready_at: new Date().toISOString() })
                      .eq('id', itemData.order_id);
                  }
                });
            }
          });
      }

      return { itemId, nextStationId: targetStationId, isComplete: !nextStation && !orderStatusStation };
    },
    
    // OPTIMISTIC UPDATE: Atualiza UI imediatamente
    onMutate: async ({ itemId, currentStationId }) => {
      // Cancelar refetches em andamento
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Salvar estado anterior para rollback
      const previousOrders = queryClient.getQueryData(['orders']);
      
      // Calcular próxima estação
      const nextStation = getNextStation(currentStationId);
      const targetStationId = nextStation?.id || orderStatusStation?.id || null;
      
      // Atualizar cache otimisticamente
      queryClient.setQueryData(['orders'], (old: OrderData[] | undefined) => {
        if (!old) return old;
        return old.map(order => ({
          ...order,
          order_items: order.order_items?.map((item: OrderItem) => 
            item.id === itemId 
              ? { 
                  ...item, 
                  current_station_id: targetStationId, 
                  station_status: targetStationId ? 'waiting' : 'done',
                  station_started_at: null,
                }
              : item
          ) || []
        }));
      });
      
      return { previousOrders };
    },
    
    onError: (error, variables, context) => {
      // Rollback em caso de erro
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error('Erro ao mover item');
      console.error(error);
    },
    
    onSuccess: (result) => {
      // Refetch suave em background após 2 segundos para garantir sincronização
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }, 2000);
      
      if (result.isComplete) {
        toast.success('Item concluído!');
      }
    },
  });

  // Iniciar item em uma praça (mantido para compatibilidade)
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

  // Completar item na praça atual e mover para próxima (mantido para compatibilidade)
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
        // Última praça de produção - marcar pedido como ready
        const { data: itemData } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('id', itemId)
          .single();

        // Se tiver estação de status do pedido, mover o item para lá
        if (orderStatusStation) {
          const { error } = await supabase
            .from('order_items')
            .update({
              current_station_id: orderStatusStation.id,
              station_status: 'waiting',
              station_started_at: null,
              station_completed_at: now,
            })
            .eq('id', itemId);

          if (error) throw error;

          // Log de entrada na estação de status
          await logAction.mutateAsync({
            orderItemId: itemId,
            stationId: orderStatusStation.id,
            action: 'entered',
          });
        } else {
          // Sem estação de status - marcar item como done diretamente
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
        }

        // Verificar se todos os itens do pedido terminaram a produção
        if (itemData?.order_id) {
          const { data: allItems } = await supabase
            .from('order_items')
            .select('id, current_station_id, station_status')
            .eq('order_id', itemData.order_id);

          // Todos estão na estação order_status ou já finalizados
          const allItemsReady = allItems?.every(item => 
            (orderStatusStation && item.current_station_id === orderStatusStation.id) ||
            item.station_status === 'done'
          );

          if (allItemsReady) {
            // Atualizar pedido para 'ready'
            await supabase
              .from('orders')
              .update({ 
                status: 'ready',
                ready_at: new Date().toISOString()
              })
              .eq('id', itemData.order_id);
          }
        }

        return { itemId, nextStationId: orderStatusStation?.id || null, isComplete: !orderStatusStation };
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

  // Finalizar pedido na estação de status (marcar como entregue)
  const finalizeOrderFromStatus = useMutation({
    mutationFn: async (orderId: string) => {
      const now = new Date().toISOString();

      // Buscar todos os itens do pedido na estação order_status
      const { data: items, error: fetchError } = await supabase
        .from('order_items')
        .select('id, current_station_id')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      // Marcar todos os itens como done
      for (const item of items || []) {
        if (item.current_station_id && orderStatusStation?.id === item.current_station_id) {
          // Log de conclusão
          await logAction.mutateAsync({
            orderItemId: item.id,
            stationId: item.current_station_id,
            action: 'completed',
          });
        }

        await supabase
          .from('order_items')
          .update({
            current_station_id: null,
            station_status: 'done',
            station_completed_at: now,
            status: 'delivered',
          })
          .eq('id', item.id);
      }

      // Atualizar pedido para delivered
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'delivered',
          delivered_at: now
        })
        .eq('id', orderId);

      if (error) throw error;

      return { orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido entregue!');
    },
    onError: (error) => {
      toast.error('Erro ao finalizar pedido');
      console.error(error);
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
    moveItemToNextStation,
    startItemAtStation,
    completeItemAtStation,
    skipItemToNextStation,
    initializeOrderForProductionLine,
    finalizeOrderFromStatus,
    getItemsByStation,
    getWaitingItems,
    orderStatusStation,
  };
}
