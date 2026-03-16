import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import { createTable, deleteTable, listTables, updateTable } from '@/lib/firebaseTenantCrud';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'bill_requested';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  position_x: number;
  position_y: number;
  created_at: string;
}

export function useTables() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['tables', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listTables(tenantId)) as Table[];
    },
    enabled: !!tenantId,
    refetchInterval: 5000,
  });
}

export function useTableMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createTableMutation = useMutation({
    mutationFn: async (table: Omit<Table, 'id' | 'created_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createTable(tenantId, table);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Mesa criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar mesa', description: error.message, variant: 'destructive' });
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, ...table }: Partial<Table> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateTable(tenantId, id, table);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar mesa', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteTable(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Mesa excluida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir mesa', description: error.message, variant: 'destructive' });
    },
  });

  return { createTable: createTableMutation, updateTable: updateTableMutation, deleteTable: deleteTableMutation };
}
