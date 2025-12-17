import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PrintSector {
  id: string;
  name: string;
  description: string | null;
  printer_name: string | null;
  is_active: boolean;
  sort_order: number;
  icon: string;
  color: string;
  created_at: string;
}

export function usePrintSectors() {
  return useQuery({
    queryKey: ['print-sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_sectors')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PrintSector[];
    },
  });
}

export function usePrintSectorMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSector = useMutation({
    mutationFn: async (sector: Omit<PrintSector, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('print_sectors')
        .insert(sector)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('print_sectors')
        .update(sector)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
      const { error } = await supabase
        .from('print_sectors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-sectors'] });
      toast({ title: 'Setor excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir setor', description: error.message, variant: 'destructive' });
    },
  });

  return { createSector, updateSector, deleteSector };
}
