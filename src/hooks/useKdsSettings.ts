import { useState, useEffect, useCallback } from 'react';

export type KdsOperationMode = 'traditional' | 'production_line';

export interface BottleneckStationOverride {
  maxQueueSize?: number;
  maxTimeRatio?: number;
  alertsEnabled?: boolean;
}

export interface BottleneckSettings {
  enabled: boolean;
  defaultMaxQueueSize: number;
  defaultMaxTimeRatio: number;
  stationOverrides: Record<string, BottleneckStationOverride>;
}

export interface KdsSettings {
  // Modo de operação
  operationMode: KdsOperationMode;
  
  // Configurações por dispositivo
  deviceId: string;
  deviceName: string;
  assignedStationId: string | null;
  
  // SLA Visual (em minutos)
  slaGreenMinutes: number;
  slaYellowMinutes: number;
  
  // Configurações existentes
  showPendingColumn: boolean;
  cancellationAlertInterval: number;
  cancellationAlertsEnabled: boolean;
  autoPrintCancellations: boolean;
  
  // Destaque de bordas (para pizzarias)
  highlightSpecialBorders: boolean;
  borderKeywords: string[]; // palavras-chave que indicam borda especial
  
  // Configurações de alertas de gargalo
  bottleneckSettings: BottleneckSettings;
}

const STORAGE_KEY = 'pdv_kds_settings';

// Gera um ID único para este dispositivo
const generateDeviceId = (): string => {
  const stored = localStorage.getItem('pdv_kds_device_id');
  if (stored) return stored;
  
  const newId = crypto.randomUUID();
  localStorage.setItem('pdv_kds_device_id', newId);
  return newId;
};

const defaultBottleneckSettings: BottleneckSettings = {
  enabled: true,
  defaultMaxQueueSize: 5,
  defaultMaxTimeRatio: 1.5,
  stationOverrides: {},
};

const defaultSettings: KdsSettings = {
  // Modo de operação
  operationMode: 'traditional',
  
  // Configurações por dispositivo
  deviceId: '',
  deviceName: 'KDS Device',
  assignedStationId: null,
  
  // SLA Visual
  slaGreenMinutes: 8,
  slaYellowMinutes: 12,
  
  // Configurações existentes
  showPendingColumn: true,
  cancellationAlertInterval: 3,
  cancellationAlertsEnabled: true,
  autoPrintCancellations: true,
  
  // Destaque de bordas
  highlightSpecialBorders: true,
  borderKeywords: ['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'],
  
  // Alertas de gargalo
  bottleneckSettings: defaultBottleneckSettings,
};

export function useKdsSettings() {
  const [settings, setSettings] = useState<KdsSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const deviceId = generateDeviceId();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure new fields exist
        return { 
          ...defaultSettings, 
          ...parsed, 
          deviceId,
          bottleneckSettings: {
            ...defaultBottleneckSettings,
            ...parsed.bottleneckSettings,
          }
        };
      }
      
      return { ...defaultSettings, deviceId };
    } catch (e) {
      console.error('Error loading KDS settings:', e);
      return { ...defaultSettings, deviceId: generateDeviceId() };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving KDS settings:', e);
    }
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<KdsSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateBottleneckSettings = useCallback((updates: Partial<BottleneckSettings>) => {
    setSettings(prev => ({
      ...prev,
      bottleneckSettings: { ...prev.bottleneckSettings, ...updates }
    }));
  }, []);

  const updateStationOverride = useCallback((stationId: string, override: BottleneckStationOverride | null) => {
    setSettings(prev => {
      const newOverrides = { ...prev.bottleneckSettings.stationOverrides };
      if (override === null) {
        delete newOverrides[stationId];
      } else {
        newOverrides[stationId] = { ...newOverrides[stationId], ...override };
      }
      return {
        ...prev,
        bottleneckSettings: {
          ...prev.bottleneckSettings,
          stationOverrides: newOverrides
        }
      };
    });
  }, []);

  // Helper to get initial order status based on settings
  const getInitialOrderStatus = useCallback((): 'pending' | 'preparing' => {
    return settings.showPendingColumn ? 'pending' : 'preparing';
  }, [settings.showPendingColumn]);

  // Helper para calcular cor do SLA baseado no tempo
  const getSlaColor = useCallback((minutesElapsed: number): 'green' | 'yellow' | 'red' => {
    if (minutesElapsed <= settings.slaGreenMinutes) return 'green';
    if (minutesElapsed <= settings.slaYellowMinutes) return 'yellow';
    return 'red';
  }, [settings.slaGreenMinutes, settings.slaYellowMinutes]);

  // Helper para verificar se um texto contém borda especial
  const hasSpecialBorder = useCallback((text: string): boolean => {
    if (!settings.highlightSpecialBorders || !text) return false;
    const lowerText = text.toLowerCase();
    return settings.borderKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }, [settings.highlightSpecialBorders, settings.borderKeywords]);

  // Helper para obter thresholds de uma praça (com override ou padrão)
  const getStationThresholds = useCallback((stationId: string) => {
    const override = settings.bottleneckSettings.stationOverrides[stationId];
    return {
      maxQueueSize: override?.maxQueueSize ?? settings.bottleneckSettings.defaultMaxQueueSize,
      maxTimeRatio: override?.maxTimeRatio ?? settings.bottleneckSettings.defaultMaxTimeRatio,
      alertsEnabled: override?.alertsEnabled ?? true,
    };
  }, [settings.bottleneckSettings]);

  // Verificar se está em modo linha de produção
  const isProductionLineMode = settings.operationMode === 'production_line';

  return {
    settings,
    updateSettings,
    updateBottleneckSettings,
    updateStationOverride,
    getInitialOrderStatus,
    getSlaColor,
    hasSpecialBorder,
    getStationThresholds,
    isProductionLineMode,
  };
}
