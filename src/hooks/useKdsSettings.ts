import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

// Global settings (synced to database)
export interface KdsGlobalSettings {
  operationMode: KdsOperationMode;
  slaGreenMinutes: number;
  slaYellowMinutes: number;
  showPendingColumn: boolean;
  cancellationAlertInterval: number;
  cancellationAlertsEnabled: boolean;
  autoPrintCancellations: boolean;
  highlightSpecialBorders: boolean;
  borderKeywords: string[];
  bottleneckSettings: BottleneckSettings;
  showPartySize: boolean;
  compactMode: boolean;
  // Timer settings
  timerGreenMinutes: number;
  timerYellowMinutes: number;
  // Delay alert settings
  delayAlertEnabled: boolean;
  delayAlertMinutes: number;
  // Display settings
  notesBlinkAllStations: boolean;
  showWaiterName: boolean;
}

// Device-specific settings (stored in localStorage)
export interface KdsDeviceSettings {
  deviceId: string;
  deviceName: string;
  assignedStationId: string | null;
}

// Combined settings interface
export interface KdsSettings extends KdsGlobalSettings, KdsDeviceSettings {}

const DEVICE_STORAGE_KEY = 'pdv_kds_device_settings';

// Generate unique device ID
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

const defaultGlobalSettings: KdsGlobalSettings = {
  operationMode: 'traditional',
  slaGreenMinutes: 8,
  slaYellowMinutes: 12,
  showPendingColumn: true,
  cancellationAlertInterval: 3,
  cancellationAlertsEnabled: true,
  autoPrintCancellations: true,
  highlightSpecialBorders: true,
  borderKeywords: ['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'],
  bottleneckSettings: defaultBottleneckSettings,
  showPartySize: true,
  compactMode: false,
  timerGreenMinutes: 5,
  timerYellowMinutes: 10,
  delayAlertEnabled: true,
  delayAlertMinutes: 10,
  notesBlinkAllStations: false,
  showWaiterName: true,
};

const getDeviceSettings = (): KdsDeviceSettings => {
  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
    const deviceId = generateDeviceId();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...parsed, deviceId };
    }
    
    return {
      deviceId,
      deviceName: 'KDS Device',
      assignedStationId: null,
    };
  } catch (e) {
    console.error('Error loading device settings:', e);
    return {
      deviceId: generateDeviceId(),
      deviceName: 'KDS Device',
      assignedStationId: null,
    };
  }
};

const saveDeviceSettings = (settings: KdsDeviceSettings) => {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving device settings:', e);
  }
};

// Parse bottleneck settings from database JSON
const parseBottleneckSettings = (dbSettings: unknown): BottleneckSettings => {
  if (!dbSettings || typeof dbSettings !== 'object') {
    return defaultBottleneckSettings;
  }
  
  const settings = dbSettings as Record<string, unknown>;
  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : defaultBottleneckSettings.enabled,
    defaultMaxQueueSize: typeof settings.defaultMaxQueueSize === 'number' ? settings.defaultMaxQueueSize : defaultBottleneckSettings.defaultMaxQueueSize,
    defaultMaxTimeRatio: typeof settings.defaultMaxTimeRatio === 'number' ? settings.defaultMaxTimeRatio : defaultBottleneckSettings.defaultMaxTimeRatio,
    stationOverrides: (settings.stationOverrides as Record<string, BottleneckStationOverride>) || {},
  };
};

export function useKdsSettings() {
  const queryClient = useQueryClient();
  const [deviceSettings, setDeviceSettings] = useState<KdsDeviceSettings>(getDeviceSettings);

  // Fetch global settings from database
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['kds-global-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kds_global_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching KDS global settings:', error);
        throw error;
      }

      return data;
    },
    staleTime: 1000 * 60, // 1 minute
  });

  // Parse global settings from database
  const globalSettings: KdsGlobalSettings = useMemo(() => {
    if (!dbSettings) return defaultGlobalSettings;

    return {
      operationMode: (dbSettings.operation_mode as KdsOperationMode) || defaultGlobalSettings.operationMode,
      slaGreenMinutes: dbSettings.sla_green_minutes ?? defaultGlobalSettings.slaGreenMinutes,
      slaYellowMinutes: dbSettings.sla_yellow_minutes ?? defaultGlobalSettings.slaYellowMinutes,
      showPendingColumn: dbSettings.show_pending_column ?? defaultGlobalSettings.showPendingColumn,
      cancellationAlertInterval: dbSettings.cancellation_alert_interval ?? defaultGlobalSettings.cancellationAlertInterval,
      cancellationAlertsEnabled: dbSettings.cancellation_alerts_enabled ?? defaultGlobalSettings.cancellationAlertsEnabled,
      autoPrintCancellations: dbSettings.auto_print_cancellations ?? defaultGlobalSettings.autoPrintCancellations,
      highlightSpecialBorders: dbSettings.highlight_special_borders ?? defaultGlobalSettings.highlightSpecialBorders,
      borderKeywords: dbSettings.border_keywords ?? defaultGlobalSettings.borderKeywords,
      bottleneckSettings: parseBottleneckSettings(dbSettings.bottleneck_settings),
      showPartySize: dbSettings.show_party_size ?? defaultGlobalSettings.showPartySize,
      compactMode: dbSettings.compact_mode ?? defaultGlobalSettings.compactMode,
      timerGreenMinutes: (dbSettings as any).timer_green_minutes ?? defaultGlobalSettings.timerGreenMinutes,
      timerYellowMinutes: (dbSettings as any).timer_yellow_minutes ?? defaultGlobalSettings.timerYellowMinutes,
      delayAlertEnabled: (dbSettings as any).delay_alert_enabled ?? defaultGlobalSettings.delayAlertEnabled,
      delayAlertMinutes: (dbSettings as any).delay_alert_minutes ?? defaultGlobalSettings.delayAlertMinutes,
      notesBlinkAllStations: (dbSettings as any).notes_blink_all_stations ?? defaultGlobalSettings.notesBlinkAllStations,
      showWaiterName: (dbSettings as any).show_waiter_name ?? defaultGlobalSettings.showWaiterName,
    };
  }, [dbSettings]);

  // Combined settings
  const settings: KdsSettings = useMemo(() => ({
    ...globalSettings,
    ...deviceSettings,
  }), [globalSettings, deviceSettings]);

  // Mutation to update global settings in database
  const updateGlobalMutation = useMutation({
    mutationFn: async (updates: Partial<KdsGlobalSettings>) => {
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.operationMode !== undefined) dbUpdates.operation_mode = updates.operationMode;
      if (updates.slaGreenMinutes !== undefined) dbUpdates.sla_green_minutes = updates.slaGreenMinutes;
      if (updates.slaYellowMinutes !== undefined) dbUpdates.sla_yellow_minutes = updates.slaYellowMinutes;
      if (updates.showPendingColumn !== undefined) dbUpdates.show_pending_column = updates.showPendingColumn;
      if (updates.cancellationAlertInterval !== undefined) dbUpdates.cancellation_alert_interval = updates.cancellationAlertInterval;
      if (updates.cancellationAlertsEnabled !== undefined) dbUpdates.cancellation_alerts_enabled = updates.cancellationAlertsEnabled;
      if (updates.autoPrintCancellations !== undefined) dbUpdates.auto_print_cancellations = updates.autoPrintCancellations;
      if (updates.highlightSpecialBorders !== undefined) dbUpdates.highlight_special_borders = updates.highlightSpecialBorders;
      if (updates.borderKeywords !== undefined) dbUpdates.border_keywords = updates.borderKeywords;
      if (updates.bottleneckSettings !== undefined) dbUpdates.bottleneck_settings = updates.bottleneckSettings;
      if (updates.showPartySize !== undefined) dbUpdates.show_party_size = updates.showPartySize;
      if (updates.compactMode !== undefined) dbUpdates.compact_mode = updates.compactMode;
      if (updates.timerGreenMinutes !== undefined) dbUpdates.timer_green_minutes = updates.timerGreenMinutes;
      if (updates.timerYellowMinutes !== undefined) dbUpdates.timer_yellow_minutes = updates.timerYellowMinutes;
      if (updates.delayAlertEnabled !== undefined) dbUpdates.delay_alert_enabled = updates.delayAlertEnabled;
      if (updates.delayAlertMinutes !== undefined) dbUpdates.delay_alert_minutes = updates.delayAlertMinutes;
      if (updates.notesBlinkAllStations !== undefined) dbUpdates.notes_blink_all_stations = updates.notesBlinkAllStations;
      if (updates.showWaiterName !== undefined) dbUpdates.show_waiter_name = updates.showWaiterName;

      const { error } = await supabase
        .from('kds_global_settings')
        .update(dbUpdates)
        .not('id', 'is', null); // Update all rows (should only be one)

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-global-settings'] });
    },
  });

  // Update global settings (synced to database)
  const updateSettings = useCallback((updates: Partial<KdsSettings>) => {
    // Separate device-specific from global settings
    const deviceUpdates: Partial<KdsDeviceSettings> = {};
    const globalUpdates: Partial<KdsGlobalSettings> = {};

    if (updates.deviceName !== undefined) deviceUpdates.deviceName = updates.deviceName;
    if (updates.assignedStationId !== undefined) deviceUpdates.assignedStationId = updates.assignedStationId;

    if (updates.operationMode !== undefined) globalUpdates.operationMode = updates.operationMode;
    if (updates.slaGreenMinutes !== undefined) globalUpdates.slaGreenMinutes = updates.slaGreenMinutes;
    if (updates.slaYellowMinutes !== undefined) globalUpdates.slaYellowMinutes = updates.slaYellowMinutes;
    if (updates.showPendingColumn !== undefined) globalUpdates.showPendingColumn = updates.showPendingColumn;
    if (updates.cancellationAlertInterval !== undefined) globalUpdates.cancellationAlertInterval = updates.cancellationAlertInterval;
    if (updates.cancellationAlertsEnabled !== undefined) globalUpdates.cancellationAlertsEnabled = updates.cancellationAlertsEnabled;
    if (updates.autoPrintCancellations !== undefined) globalUpdates.autoPrintCancellations = updates.autoPrintCancellations;
    if (updates.highlightSpecialBorders !== undefined) globalUpdates.highlightSpecialBorders = updates.highlightSpecialBorders;
    if (updates.borderKeywords !== undefined) globalUpdates.borderKeywords = updates.borderKeywords;
    if (updates.bottleneckSettings !== undefined) globalUpdates.bottleneckSettings = updates.bottleneckSettings;
    if (updates.showPartySize !== undefined) globalUpdates.showPartySize = updates.showPartySize;
    if (updates.compactMode !== undefined) globalUpdates.compactMode = updates.compactMode;
    if (updates.timerGreenMinutes !== undefined) globalUpdates.timerGreenMinutes = updates.timerGreenMinutes;
    if (updates.timerYellowMinutes !== undefined) globalUpdates.timerYellowMinutes = updates.timerYellowMinutes;
    if (updates.delayAlertEnabled !== undefined) globalUpdates.delayAlertEnabled = updates.delayAlertEnabled;
    if (updates.delayAlertMinutes !== undefined) globalUpdates.delayAlertMinutes = updates.delayAlertMinutes;
    if (updates.notesBlinkAllStations !== undefined) globalUpdates.notesBlinkAllStations = updates.notesBlinkAllStations;
    if (updates.showWaiterName !== undefined) globalUpdates.showWaiterName = updates.showWaiterName;

    // Update device settings locally
    if (Object.keys(deviceUpdates).length > 0) {
      setDeviceSettings(prev => {
        const newSettings = { ...prev, ...deviceUpdates };
        saveDeviceSettings(newSettings);
        return newSettings;
      });
    }

    // Update global settings in database
    if (Object.keys(globalUpdates).length > 0) {
      updateGlobalMutation.mutate(globalUpdates);
    }
  }, [updateGlobalMutation]);

  // Update device-specific settings only
  const updateDeviceSettings = useCallback((updates: Partial<KdsDeviceSettings>) => {
    setDeviceSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveDeviceSettings(newSettings);
      return newSettings;
    });
  }, []);

  // Update bottleneck settings
  const updateBottleneckSettings = useCallback((updates: Partial<BottleneckSettings>) => {
    const newBottleneckSettings = { ...globalSettings.bottleneckSettings, ...updates };
    updateGlobalMutation.mutate({ bottleneckSettings: newBottleneckSettings });
  }, [globalSettings.bottleneckSettings, updateGlobalMutation]);

  // Update station override
  const updateStationOverride = useCallback((stationId: string, override: BottleneckStationOverride | null) => {
    const newOverrides = { ...globalSettings.bottleneckSettings.stationOverrides };
    if (override === null) {
      delete newOverrides[stationId];
    } else {
      newOverrides[stationId] = { ...newOverrides[stationId], ...override };
    }
    
    updateBottleneckSettings({ stationOverrides: newOverrides });
  }, [globalSettings.bottleneckSettings.stationOverrides, updateBottleneckSettings]);

  // Set up realtime subscription for global settings changes
  useEffect(() => {
    const channel = supabase
      .channel('kds-global-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kds_global_settings',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kds-global-settings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Helper to get initial order status based on settings
  const getInitialOrderStatus = useCallback((): 'pending' | 'preparing' => {
    return settings.showPendingColumn ? 'pending' : 'preparing';
  }, [settings.showPendingColumn]);

  // Helper to calculate SLA color based on time
  const getSlaColor = useCallback((minutesElapsed: number): 'green' | 'yellow' | 'red' => {
    if (minutesElapsed <= settings.slaGreenMinutes) return 'green';
    if (minutesElapsed <= settings.slaYellowMinutes) return 'yellow';
    return 'red';
  }, [settings.slaGreenMinutes, settings.slaYellowMinutes]);

  // Helper to check if text contains special border
  const hasSpecialBorder = useCallback((text: string): boolean => {
    if (!settings.highlightSpecialBorders || !text) return false;
    const lowerText = text.toLowerCase();
    return settings.borderKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }, [settings.highlightSpecialBorders, settings.borderKeywords]);

  // Helper to get station thresholds (with override or default)
  const getStationThresholds = useCallback((stationId: string) => {
    const override = settings.bottleneckSettings.stationOverrides[stationId];
    return {
      maxQueueSize: override?.maxQueueSize ?? settings.bottleneckSettings.defaultMaxQueueSize,
      maxTimeRatio: override?.maxTimeRatio ?? settings.bottleneckSettings.defaultMaxTimeRatio,
      alertsEnabled: override?.alertsEnabled ?? true,
    };
  }, [settings.bottleneckSettings]);

  // Check if in production line mode
  const isProductionLineMode = settings.operationMode === 'production_line';

  return {
    settings,
    isLoading,
    updateSettings,
    updateDeviceSettings,
    updateBottleneckSettings,
    updateStationOverride,
    getInitialOrderStatus,
    getSlaColor,
    hasSpecialBorder,
    getStationThresholds,
    isProductionLineMode,
  };
}
