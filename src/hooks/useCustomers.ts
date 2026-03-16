import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from './useTenant';
import {
  createCustomer as createCustomerFs,
  findOrCreateCustomer as findOrCreateCustomerFs,
  listCustomers,
  searchCustomers,
  updateCustomer as updateCustomerFs,
  updateCustomerStats as updateCustomerStatsFs,
} from '@/lib/firebaseTenantCrud';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listCustomers(tenantId)) as Customer[];
    },
    enabled: !!tenantId,
  });
}

export function useSearchCustomers(searchTerm: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: async () => {
      if (!tenantId || !searchTerm.trim() || searchTerm.length < 2) return [];
      return (await searchCustomers(tenantId, searchTerm)) as Customer[];
    },
    enabled: !!tenantId && searchTerm.length >= 2,
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createCustomer = useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_orders' | 'total_spent' | 'last_order_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return (await createCustomerFs(tenantId, customer)) as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return (await updateCustomerFs(tenantId, id, updates)) as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const updateCustomerStats = useMutation({
    mutationFn: async ({ customerId, orderTotal }: { customerId: string; orderTotal: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return (await updateCustomerStatsFs(tenantId, customerId, orderTotal)) as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const findOrCreateCustomer = useMutation({
    mutationFn: async ({ name, phone, address }: { name?: string; phone?: string; address?: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return (await findOrCreateCustomerFs(tenantId, { name, phone, address })) as Customer | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return {
    createCustomer,
    updateCustomer,
    updateCustomerStats,
    findOrCreateCustomer,
  };
}
