import { useState, useEffect } from 'react';

interface KdsSettings {
  showPendingColumn: boolean;
}

const STORAGE_KEY = 'pdv_kds_settings';

const defaultSettings: KdsSettings = {
  showPendingColumn: true,
};

export function useKdsSettings() {
  const [settings, setSettings] = useState<KdsSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error loading KDS settings:', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving KDS settings:', e);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<KdsSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // Helper to get initial order status based on settings
  const getInitialOrderStatus = (): 'pending' | 'preparing' => {
    return settings.showPendingColumn ? 'pending' : 'preparing';
  };

  return {
    settings,
    updateSettings,
    getInitialOrderStatus,
  };
}
