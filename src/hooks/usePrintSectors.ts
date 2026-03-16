import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  createPrintSector as createPrintSectorDoc,
  deletePrintSector as deletePrintSectorDoc,
  listPrintSectors,
  updatePrintSector as updatePrintSectorDoc,
} from '@/lib/firebaseTenantCrud';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';

export interface PrintSector {
  id: string;
  name: string;
  description: string | null;
  printer_name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  icon: string | null;
  color: string | null;
  created_at: string | null;
}

export function usePrintSectors(options?: { enabled?: boolean }) {
  const { tenantId } = useTenant();
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ['print-sectors', tenantId],
    queryFn: async () => {
      const currentTenantId = tenantId || (await resolveCurrentTenantId());
      if (!currentTenantId) return [];
      return (await listPrintSectors(currentTenantId)) as PrintSector[];
    },
    enabled,
  });
}

export function usePrintSectorMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createSector = useMutation({
    mutationFn: async (sector: Omit<PrintSector, 'id' | 'created_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createPrintSectorDoc(tenantId, {
        name: sector.name,
        description: sector.description ?? null,
        printer_name: sector.printer_name ?? null,
        is_active: sector.is_active ?? true,
        sort_order: sector.sort_order ?? null,
        icon: sector.icon ?? null,
        color: sector.color ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar setor', description: error.message, variant: 'destructive' });
    },
  });

  const updateSector = useMutation({
    mutationFn: async ({ id, ...sector }: Partial<PrintSector> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updatePrintSectorDoc(tenantId, id, sector as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar setor', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deletePrintSectorDoc(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor excluido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir setor', description: error.message, variant: 'destructive' });
    },
  });

  return { createSector, updateSector, deleteSector };
}
