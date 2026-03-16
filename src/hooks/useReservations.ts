import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import { firebaseAuth } from '@/integrations/firebase/client';
import {
  createReservation as createReservationFs,
  isTableAvailable,
  listReservations,
  updateReservation as updateReservationFs,
} from '@/lib/firebaseTenantCrud';

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Reservation {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
  created_by: string | null;
  table?: {
    number: number;
    capacity: number;
  };
}

export function useReservations(date?: string) {
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: ['reservations', date],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listReservations(tenantId, date)) as Reservation[];
    },
    refetchInterval: 5000,
    enabled: !!tenantId,
  });

  return query;
}

export function useReservationMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createReservation = useMutation({
    mutationFn: async (reservation: Omit<Reservation, 'id' | 'created_at' | 'table'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');

      const payload = {
        ...reservation,
        created_by: reservation.created_by ?? firebaseAuth.currentUser?.uid ?? null,
      };

      return createReservationFs(tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar reserva', description: error.message, variant: 'destructive' });
    },
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Reservation> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return updateReservationFs(tenantId, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar reserva', description: error.message, variant: 'destructive' });
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateReservationFs(tenantId, id, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva cancelada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar reserva', description: error.message, variant: 'destructive' });
    },
  });

  return { createReservation, updateReservation, cancelReservation };
}

export function useTableAvailability(tableId: string, date: string, time: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['table-availability', tableId, date, time],
    queryFn: async () => {
      if (!tenantId) return false;
      return isTableAvailable(tenantId, tableId, date, time);
    },
    enabled: !!tenantId && !!tableId && !!date && !!time,
  });
}
