import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { useCallback } from 'react';
import { getGlobalSettingByKey, upsertGlobalSetting } from '@/lib/firebaseTenantCrud';

interface TableWaitSettings {
  enabled: boolean;
  thresholdMinutes: number;
  cooldownMinutes: number;
}

const defaultSettings: TableWaitSettings = {
  enabled: true,
  thresholdMinutes: 20,
  cooldownMinutes: 5,
};

const SETTINGS_KEY = 'table_wait_settings';

export function useTableWaitSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['table-wait-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return { settings: defaultSettings };

      const record = await getGlobalSettingByKey(tenantId, SETTINGS_KEY);
      if (!record) return { settings: defaultSettings };

      const storedValue = (record.value || {}) as Record<string, unknown>;
      return {
        settings: {
          enabled: typeof storedValue?.enabled === 'boolean' ? storedValue.enabled : defaultSettings.enabled,
          thresholdMinutes:
            typeof storedValue?.thresholdMinutes === 'number'
              ? storedValue.thresholdMinutes
              : defaultSettings.thresholdMinutes,
          cooldownMinutes:
            typeof storedValue?.cooldownMinutes === 'number'
              ? storedValue.cooldownMinutes
              : defaultSettings.cooldownMinutes,
        },
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TableWaitSettings>) => {
      if (!tenantId) throw new Error('No tenant ID');

      const currentSettings = data?.settings ?? defaultSettings;
      const newSettings = { ...currentSettings, ...updates };
      await upsertGlobalSetting(tenantId, SETTINGS_KEY, newSettings);
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table-wait-settings', tenantId] });
    },
  });

  const updateSettings = useCallback(
    (updates: Partial<TableWaitSettings>) => {
      updateMutation.mutate(updates);
    },
    [updateMutation]
  );

  return {
    settings: data?.settings ?? defaultSettings,
    updateSettings,
    isLoading,
    isSaving: updateMutation.isPending,
  };
}
