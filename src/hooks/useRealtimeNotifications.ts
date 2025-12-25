import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAudioNotification } from './useAudioNotification';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeNotifications() {
  const { playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound } = useAudioNotification();
  const { toast } = useToast();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('orders-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('New order:', payload);
          playNewOrderSound();
          toast({
            title: 'Novo Pedido!',
            description: `Pedido #${(payload.new as any).id?.slice(0, 8)} recebido.`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Play sound when order becomes ready
          if (oldData?.status !== 'ready' && newData?.status === 'ready') {
            playOrderReadySound();
            toast({
              title: 'Pedido Pronto!',
              description: `Pedido #${newData.id?.slice(0, 8)} está pronto para entrega.`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to reservations changes
    const reservationsChannel = supabase
      .channel('reservations-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('New reservation:', payload);
          playNewReservationSound();
          const reservation = payload.new as any;
          toast({
            title: 'Nova Reserva!',
            description: `Reserva de ${reservation.customer_name} para ${reservation.party_size} pessoas.`,
          });
        }
      )
      .subscribe();

    // Subscribe to order_items changes for station transitions
    const orderItemsChannel = supabase
      .channel('order-items-station-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Play sound when item moves to a different station
          if (oldData?.current_station_id !== newData?.current_station_id && newData?.current_station_id) {
            playStationChangeSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(orderItemsChannel);
    };
  }, [playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound, toast]);
}
