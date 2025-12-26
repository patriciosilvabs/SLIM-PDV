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

interface SettingsData {
  tenantId: string | null;
  settings: GlobalSetting[];
}

export function useGlobalSettings() {
  const queryClient = useQueryClient();

  // Buscar tenant_id e settings em uma única query para evitar problemas de HMR
  const { data, isLoading } = useQuery({
    queryKey: ['global-settings-with-tenant'],
    queryFn: async (): Promise<SettingsData> => {
      // Primeiro obter tenant_id
      const { data: tenantId, error: tenantError } = await supabase.rpc('get_user_tenant_id');
      if (tenantError) throw tenantError;
      
      if (!tenantId) {
        return { tenantId: null, settings: [] };
      }

      // Então buscar settings filtradas por tenant_id
      const { data: settings, error: settingsError } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId);

      if (settingsError) throw settingsError;
      return { tenantId, settings: (settings || []) as GlobalSetting[] };
    },
    staleTime: 1000 * 60 * 5,
  });

  const tenantId = data?.tenantId ?? null;
  const settings = data?.settings ?? [];

  const getSetting = (key: string): Json => {
    const setting = settings.find(s => s.key === key);
    return setting?.value ?? null;
  };

  // UPSERT: inserir se não existir, atualizar se existir
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const existingSetting = settings.find(s => s.key === key);
      
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
      queryClient.invalidateQueries({ queryKey: ['global-settings-with-tenant'] });
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
