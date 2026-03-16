import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/backend/types';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { listGlobalSettings, upsertGlobalSetting } from '@/lib/firebaseTenantCrud';

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

  const { data, isLoading } = useQuery({
    queryKey: ['global-settings-with-tenant'],
    queryFn: async (): Promise<SettingsData> => {
      const tenantId = await resolveCurrentTenantId();

      if (!tenantId) {
        return { tenantId: null, settings: [] };
      }

      const settings = await listGlobalSettings(tenantId);
      return { tenantId, settings: (settings || []) as GlobalSetting[] };
    },
    staleTime: 1000 * 60 * 5,
  });

  const tenantId = data?.tenantId ?? null;
  const settings = data?.settings ?? [];

  const getSetting = (key: string): Json => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value ?? null;
  };

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      if (!tenantId) throw new Error('No tenant ID available');
      await upsertGlobalSetting(tenantId, key, value);
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
