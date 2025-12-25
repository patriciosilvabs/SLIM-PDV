import { useState, useEffect, useCallback } from 'react';

export type KdsOperationMode = 'traditional' | 'production_line';

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
};

export function useKdsSettings() {
  const [settings, setSettings] = useState<KdsSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const deviceId = generateDeviceId();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultSettings, ...parsed, deviceId };
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

  // Verificar se está em modo linha de produção
  const isProductionLineMode = settings.operationMode === 'production_line';

  return {
    settings,
    updateSettings,
    getInitialOrderStatus,
    getSlaColor,
    hasSpecialBorder,
    isProductionLineMode,
  };
}
