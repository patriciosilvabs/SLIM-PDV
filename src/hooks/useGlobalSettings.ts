import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface GlobalSetting {
  id: string;
  key: string;
  value: Json;
  created_at: string;
  updated_at: string;
}

export function useGlobalSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*');

      if (error) throw error;
      return (data || []) as GlobalSetting[];
    },
  });

  const getSetting = (key: string): Json => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value ?? null;
  };

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { error } = await supabase
        .from('global_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
    },
  });

  // Convenience getters
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
