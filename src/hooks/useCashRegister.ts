import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import {
  closeCashRegister as closeCashRegisterDoc,
  createCashRegister,
  createPayment as createPaymentDoc,
  getCashRegisterById,
  getOpenCashRegister,
  getOrderById,
  listPaymentsByCashRegister,
  updateOrderById,
  updateTable as updateTenantTable,
} from '@/lib/firebaseTenantCrud';

export type CashRegisterStatus = 'open' | 'closed';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix';

export interface CashRegister {
  id: string;
  opened_by: string;
  closed_by: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: CashRegisterStatus;
  opened_at: string;
  closed_at: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  cash_register_id: string | null;
  payment_method: PaymentMethod;
  amount: number;
  received_by: string | null;
  created_at: string;
  is_partial?: boolean;
}

export function useOpenCashRegister() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['cash-register', 'open', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return (await getOpenCashRegister(tenantId)) as CashRegister | null;
    },
    enabled: !!tenantId,
  });
}

export function useCashRegisterMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const openCashRegister = useMutation({
    mutationFn: async (openingAmount: number) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data: userData } = await backendClient.auth.getUser();
      if (!userData.user?.id) throw new Error('Usuario nao autenticado');

      return await createCashRegister(tenantId, {
        opened_by: userData.user.id,
        opening_amount: openingAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      toast({ title: 'Caixa aberto!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao abrir caixa', description: error.message, variant: 'destructive' });
    },
  });

  const closeCashRegister = useMutation({
    mutationFn: async ({ id, closingAmount }: { id: string; closingAmount: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data: userData } = await backendClient.auth.getUser();
      if (!userData.user?.id) throw new Error('Usuario nao autenticado');

      const [payments, cashRegister] = await Promise.all([
        listPaymentsByCashRegister(tenantId, id),
        getCashRegisterById(tenantId, id),
      ]);
      if (!cashRegister) throw new Error('Caixa nao encontrado');

      const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expectedAmount = Number(cashRegister.opening_amount || 0) + totalPayments;
      const difference = closingAmount - expectedAmount;

      return await closeCashRegisterDoc(tenantId, id, {
        closed_by: userData.user.id,
        closing_amount: closingAmount,
        expected_amount: expectedAmount,
        difference,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      toast({ title: 'Caixa fechado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao fechar caixa', description: error.message, variant: 'destructive' });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (payment: Omit<Payment, 'id' | 'created_at' | 'received_by'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data: userData } = await backendClient.auth.getUser();
      if (!userData.user?.id) throw new Error('Usuario nao autenticado');

      const data = await createPaymentDoc(tenantId, {
        order_id: payment.order_id,
        cash_register_id: payment.cash_register_id,
        payment_method: payment.payment_method,
        amount: payment.amount,
        is_partial: payment.is_partial || false,
        received_by: userData.user.id,
      });

      if (!payment.is_partial) {
        const order = await getOrderById(tenantId, payment.order_id);

        if (order?.order_type === 'dine_in') {
          await updateOrderById(tenantId, payment.order_id, {
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            table_id: null,
          });
        }

        if (order?.table_id) {
          await updateTenantTable(tenantId, order.table_id, { status: 'available' });
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (variables.is_partial) {
        toast({ title: 'Pagamento parcial registrado!', description: 'A mesa continua aberta.' });
      } else {
        toast({ title: 'Pagamento registrado!' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  return { openCashRegister, closeCashRegister, createPayment: createPaymentMutation };
}
