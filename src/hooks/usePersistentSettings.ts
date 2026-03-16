import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { getGlobalSettingByKey, upsertGlobalSetting } from '@/lib/firebaseTenantCrud';

interface PersistentSettingsOptions<T> {
  settingsKey: string;
  defaults: T;
  localStorageKey?: string;
  version?: number;
  enableRemote?: boolean;
  tenantIdOverride?: string | null;
}

export function usePersistentSettings<T extends Record<string, any>>({
  settingsKey,
  defaults,
  localStorageKey,
  version = 1,
  enableRemote = true,
  tenantIdOverride = null,
}: PersistentSettingsOptions<T>) {
  const queryClient = useQueryClient();
  const migratedRef = useRef(false);
  const storageKey = localStorageKey || `pdv_${settingsKey}`;

  const smartMerge = useCallback((saved: Partial<T> | null, defaultValues: T): T => {
    if (!saved) return defaultValues;

    const result = { ...defaultValues };

    for (const key of Object.keys(defaultValues) as (keyof T)[]) {
      if (key in saved) {
        const savedValue = saved[key];
        const defaultValue = defaultValues[key];

        if (
          savedValue !== null &&
          defaultValue !== null &&
          typeof savedValue === 'object' &&
          typeof defaultValue === 'object' &&
          !Array.isArray(savedValue) &&
          !Array.isArray(defaultValue)
        ) {
          result[key] = { ...defaultValue, ...savedValue } as T[keyof T];
        } else {
          result[key] = savedValue as T[keyof T];
        }
      }
    }

    return result;
  }, []);

  const readFromLocalStorage = useCallback((): { data: Partial<T> | null; version: number } => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && '_version' in parsed && 'data' in parsed) {
          return { data: parsed.data, version: parsed._version };
        }
        return { data: parsed, version: 0 };
      }
    } catch {
      // ignore
    }
    return { data: null, version: 0 };
  }, [storageKey]);

  const saveToLocalStorage = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            _version: version,
            data,
          })
        );
      } catch {
        // ignore
      }
    },
    [storageKey, version]
  );

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['persistent-settings', settingsKey, enableRemote, tenantIdOverride],
    queryFn: async () => {
      if (!enableRemote) {
        const { data: localData } = readFromLocalStorage();
        return {
          tenantId: tenantIdOverride,
          settings: smartMerge(localData, defaults),
          fromLocalStorage: true,
        };
      }

      const tenantId = tenantIdOverride || await resolveCurrentTenantId();

      if (!tenantId) {
        const { data: localData } = readFromLocalStorage();
        return {
          tenantId: null,
          settings: smartMerge(localData, defaults),
          fromLocalStorage: true,
        };
      }

      const dbSettings = await getGlobalSettingByKey(tenantId, settingsKey);
      if (dbSettings?.value) {
        const value = dbSettings.value as Partial<T>;
        return {
          tenantId,
          settings: smartMerge(value, defaults),
          fromLocalStorage: false,
        };
      }

      const { data: localData } = readFromLocalStorage();
      return {
        tenantId,
        settings: smartMerge(localData, defaults),
        fromLocalStorage: localData !== null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const tenantId = queryData?.tenantId ?? null;
  const settings = queryData?.settings ?? defaults;
  const fromLocalStorage = queryData?.fromLocalStorage ?? false;

  const saveMutation = useMutation({
    mutationFn: async (newSettings: T) => {
      if (!enableRemote || !tenantId) {
        saveToLocalStorage(newSettings);
        return;
      }

      await upsertGlobalSetting(tenantId, settingsKey, newSettings);
      saveToLocalStorage(newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persistent-settings', settingsKey] });
    },
  });

  useEffect(() => {
    if (migratedRef.current || isLoading || !tenantId || !fromLocalStorage) return;

    const { data: localData } = readFromLocalStorage();
    if (localData) {
      migratedRef.current = true;
      saveMutation.mutate(settings);
    }
  }, [isLoading, tenantId, fromLocalStorage, settings]);

  useEffect(() => {
    if (!isLoading && settings) {
      saveToLocalStorage(settings);
    }
  }, [settings, isLoading, saveToLocalStorage]);

  const updateSettings = useCallback(
    (updates: Partial<T>) => {
      const newSettings = { ...settings, ...updates };
      saveMutation.mutate(newSettings);
    },
    [settings, saveMutation]
  );

  const setSettings = useCallback(
    (newSettings: T) => {
      saveMutation.mutate(newSettings);
    },
    [saveMutation]
  );

  return {
    settings,
    isLoading,
    isSaving: saveMutation.isPending,
    updateSettings,
    setSettings,
    tenantId,
  };
}
