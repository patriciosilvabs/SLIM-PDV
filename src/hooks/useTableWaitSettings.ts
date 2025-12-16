import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pdv_table_wait_settings';

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

export function useTableWaitSettings() {
  const [settings, setSettings] = useState<TableWaitSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<TableWaitSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return { settings, updateSettings };
}
