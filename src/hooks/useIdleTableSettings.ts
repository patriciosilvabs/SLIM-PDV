import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { useCallback } from 'react';
import { getGlobalSettingByKey, upsertGlobalSetting } from '@/lib/firebaseTenantCrud';

interface IdleTableSettings {
  enabled: boolean;
  thresholdMinutes: number;
  autoClose: boolean;
  includeDeliveredOrders: boolean;
}

const defaultSettings: IdleTableSettings = {
  enabled: true,
  thresholdMinutes: 15,
  autoClose: false,
  includeDeliveredOrders: false,
};

const SETTINGS_KEY = 'idle_table_settings';

export function useIdleTableSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['idle-table-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return { settings: defaultSettings };

      const record = await getGlobalSettingByKey(tenantId, SETTINGS_KEY);
      if (!record) return { settings: defaultSettings };

      const storedValue = (record.value || {}) as Record<string, unknown>;
      return {
        settings: {
          enabled: 'enabled' in storedValue ? !!storedValue.enabled : defaultSettings.enabled,
          thresholdMinutes:
            'thresholdMinutes' in storedValue && typeof storedValue.thresholdMinutes === 'number'
              ? storedValue.thresholdMinutes
              : defaultSettings.thresholdMinutes,
          autoClose: 'autoClose' in storedValue ? !!storedValue.autoClose : defaultSettings.autoClose,
          includeDeliveredOrders:
            'includeDeliveredOrders' in storedValue
              ? !!storedValue.includeDeliveredOrders
              : defaultSettings.includeDeliveredOrders,
        },
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<IdleTableSettings>) => {
      if (!tenantId) throw new Error('No tenant ID');

      const currentSettings = data?.settings ?? defaultSettings;
      const newSettings = { ...currentSettings, ...updates };
      await upsertGlobalSetting(tenantId, SETTINGS_KEY, newSettings);
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idle-table-settings', tenantId] });
    },
  });

  const updateSettings = useCallback(
    (updates: Partial<IdleTableSettings>) => {
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
