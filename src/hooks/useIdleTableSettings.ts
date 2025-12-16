import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pdv_idle_table_settings';

interface IdleTableSettings {
  enabled: boolean;
  thresholdMinutes: number; // Tempo máximo sem itens (5, 10, 15, 20, 30 min)
  autoClose: boolean;       // Se true, fecha automaticamente; se false, só alerta
}

const defaultSettings: IdleTableSettings = {
  enabled: true,
  thresholdMinutes: 15,    // Padrão: 15 minutos
  autoClose: false,         // Padrão: apenas alertar (mais seguro)
};

export function useIdleTableSettings() {
  const [settings, setSettings] = useState<IdleTableSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<IdleTableSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return { settings, updateSettings };
}
