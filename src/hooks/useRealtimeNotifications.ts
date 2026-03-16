import { useEffect, useRef } from 'react';
import { useAudioNotification } from './useAudioNotification';
import { toast } from 'sonner';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { listRecentOrderItems, listRecentOrders, listReservations } from '@/lib/firebaseTenantCrud';

type OrderSnapshot = {
  id: string;
  status: string | null;
  is_draft: boolean | null;
  created_at: string | null;
};

type ReservationSnapshot = {
  id: string;
  customer_name: string | null;
  party_size: number | null;
};

type OrderItemSnapshot = {
  id: string;
  current_station_id: string | null;
};

export function useRealtimeNotifications() {
  const { playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound } = useAudioNotification();
  const lastOrderCreatedAtRef = useRef<string | null>(null);
  const seenReservationIdsRef = useRef<Set<string>>(new Set());
  const orderStatusRef = useRef<Map<string, string | null>>(new Map());
  const itemStationRef = useRef<Map<string, string | null>>(new Map());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      const tenantId = await resolveCurrentTenantId();
      const [orders, reservations, items] = await Promise.all([
        tenantId ? listRecentOrders(tenantId, 100) : Promise.resolve([]),
        tenantId ? listReservations(tenantId) : Promise.resolve([]),
        tenantId ? listRecentOrderItems(tenantId, 300) : Promise.resolve([]),
      ]);

      const safeOrders = (orders || []) as OrderSnapshot[];
      const safeReservations = (reservations || []) as ReservationSnapshot[];
      const safeItems = (items || []) as OrderItemSnapshot[];

      if (!bootstrappedRef.current) {
        lastOrderCreatedAtRef.current = safeOrders[0]?.created_at || null;
        seenReservationIdsRef.current = new Set(safeReservations.map((r) => r.id));
        orderStatusRef.current = new Map(safeOrders.map((o) => [o.id, o.status]));
        itemStationRef.current = new Map(safeItems.map((i) => [i.id, i.current_station_id]));
        bootstrappedRef.current = true;
        return;
      }

      const newOrders = safeOrders.filter((o) => {
        if (o.is_draft) return false;
        if (!o.created_at) return false;
        return !lastOrderCreatedAtRef.current || o.created_at > lastOrderCreatedAtRef.current;
      });

      if (newOrders.length > 0) {
        playNewOrderSound();
        newOrders.forEach((newOrder) => {
          toast.success('Novo Pedido!', {
            description: `Pedido #${newOrder.id?.slice(0, 8)} recebido.`,
          });
        });
      }

      if (safeOrders[0]?.created_at) {
        lastOrderCreatedAtRef.current = safeOrders[0].created_at;
      }

      safeOrders.forEach((order) => {
        const prevStatus = orderStatusRef.current.get(order.id);
        if (prevStatus && prevStatus !== 'ready' && order.status === 'ready') {
          playOrderReadySound();
          toast.success('Pedido Pronto!', {
            description: `Pedido #${order.id?.slice(0, 8)} est\u00e1 pronto para entrega.`,
          });
        }
      });
      orderStatusRef.current = new Map(safeOrders.map((o) => [o.id, o.status]));

      const newReservations = safeReservations.filter((reservation) => !seenReservationIdsRef.current.has(reservation.id));
      if (newReservations.length > 0) {
        playNewReservationSound();
        newReservations.forEach((reservation) => {
          toast.success('Nova Reserva!', {
            description: `Reserva de ${reservation.customer_name} para ${reservation.party_size} pessoas.`,
          });
        });
      }
      seenReservationIdsRef.current = new Set(safeReservations.map((r) => r.id));

      let stationChanged = false;
      safeItems.forEach((item) => {
        const previousStation = itemStationRef.current.get(item.id);
        if (previousStation !== undefined && previousStation !== item.current_station_id && item.current_station_id) {
          stationChanged = true;
        }
      });
      if (stationChanged) {
        playStationChangeSound();
      }
      itemStationRef.current = new Map(safeItems.map((i) => [i.id, i.current_station_id]));
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [playNewOrderSound, playNewReservationSound, playOrderReadySound, playStationChangeSound]);
}
