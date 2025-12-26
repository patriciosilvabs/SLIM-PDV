import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface GlobalSetting {
  id: string;
  key: string;
  value: Json;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export function useGlobalSettings() {
  const queryClient = useQueryClient();

  // Primeiro obter o tenant_id do usuário
  const { data: tenantId } = useQuery({
    queryKey: ['user-tenant-id'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_tenant_id');
      if (error) throw error;
      return data as string | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar configurações FILTRADAS por tenant_id
  const { data: settings, isLoading } = useQuery({
    queryKey: ['global-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data || []) as GlobalSetting[];
    },
    enabled: !!tenantId,
  });

  const getSetting = (key: string): Json => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value ?? null;
  };

  // UPSERT: inserir se não existir, atualizar se existir
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const existingSetting = settings?.find(s => s.key === key);
      
      if (existingSetting) {
        // UPDATE existente
        const { error } = await supabase
          .from('global_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('id', existingSetting.id);
        if (error) throw error;
      } else {
        // INSERT novo registro
        const { error } = await supabase
          .from('global_settings')
          .insert({ tenant_id: tenantId, key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings', tenantId] });
    },
  });

  const usePrintQueue = getSetting('use_print_queue') === true;

  const toggleUsePrintQueue = async () => {
    await updateSetting.mutateAsync({ key: 'use_print_queue', value: !usePrintQueue });
  };

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
    usePrintQueue,
    toggleUsePrintQueue,
  };
}
