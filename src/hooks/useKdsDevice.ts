import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKdsSettings } from './useKdsSettings';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { clearStoredKdsDeviceAuth } from '@/lib/kdsDeviceSession';
import {
  getKdsDeviceByDeviceId,
  listKdsDevices,
  updateKdsDevice,
} from '@/lib/firebaseTenantCrud';

export interface KdsDevice {
  id: string;
  device_id: string;
  name: string;
  station_id: string | null;
  stage_type?: 'prep_start' | 'item_assembly' | 'assembly' | 'oven_expedite' | 'order_status' | 'custom';
  display_order?: number | null;
  is_terminal?: boolean;
  operation_mode: string;
  routing_mode?: 'default' | 'keywords';
  routing_keywords?: string[];
  is_entry_device?: boolean;
  next_device_ids?: string[];
  next_device_id?: string | null;
  last_seen_at: string;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export function useKdsDevice() {
  const { settings, updateDeviceSettings, clearDeviceRegistration } = useKdsSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: device, isLoading } = useQuery({
    queryKey: ['kds-device', settings.deviceId, tenantId],
    queryFn: async () => {
      if (!settings.deviceId || !tenantId) return null;

      const existing = await getKdsDeviceByDeviceId(tenantId, settings.deviceId);
      if (existing) {
        if (existing.deleted_at) {
          clearStoredKdsDeviceAuth();
          clearDeviceRegistration({ suppressAutoRegister: true });
          return null;
        }

        await updateKdsDevice(tenantId, existing.id, { last_seen_at: new Date().toISOString() });
        return existing as KdsDevice;
      }

      clearStoredKdsDeviceAuth();
      clearDeviceRegistration({ suppressAutoRegister: true });
      return null;
    },
    enabled: !!settings.deviceId && !!tenantId,
    staleTime: 1000 * 30,
  });

  const clearCurrentDeviceRegistration = useCallback(() => {
    clearStoredKdsDeviceAuth();
    clearDeviceRegistration({ suppressAutoRegister: true });
    queryClient.removeQueries({ queryKey: ['kds-device'] });
    queryClient.invalidateQueries({ queryKey: ['kds-devices-all', tenantId] });
  }, [clearDeviceRegistration, queryClient, tenantId]);

  const updateDevice = useMutation({
    mutationFn: async (updates: Partial<Omit<KdsDevice, 'id' | 'device_id' | 'created_at'>>) => {
      if (!device?.id || !tenantId) return null;
      return (await updateKdsDevice(tenantId, device.id, {
        ...updates,
        last_seen_at: new Date().toISOString(),
      })) as KdsDevice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device', settings.deviceId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all', tenantId] });
    },
    onError: (error) => {
      console.error('Error updating KDS device:', error);
    },
  });

  const syncToDatabase = useCallback(() => {
    if (!device) return;

    updateDevice.mutate({
      name: settings.deviceName,
      operation_mode: settings.operationMode,
      station_id: settings.assignedStationId,
    });
  }, [device, settings.deviceName, settings.operationMode, settings.assignedStationId, updateDevice]);

  const assignToStation = useCallback((stationId: string | null) => {
    updateDeviceSettings({ assignedStationId: stationId });

    if (device) {
      updateDevice.mutate({ station_id: stationId });
    }

    toast({
      title: stationId ? 'Dispositivo atribuido a praca' : 'Dispositivo desvinculado da praca',
    });
  }, [device, updateDevice, updateDeviceSettings, toast]);

  const renameDevice = useCallback((name: string) => {
    updateDeviceSettings({ deviceName: name });

    if (device) {
      updateDevice.mutate({ name });
    }
  }, [device, updateDevice, updateDeviceSettings]);

  useEffect(() => {
    if (!device?.id || !tenantId) return;

    const interval = setInterval(() => {
      void updateKdsDevice(tenantId, device.id, { last_seen_at: new Date().toISOString() });
    }, 10000);

    return () => clearInterval(interval);
  }, [device?.id, tenantId]);

  const { data: allDevices = [] } = useQuery({
    queryKey: ['kds-devices-all', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listKdsDevices(tenantId)) as KdsDevice[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30,
  });

  return {
    device,
    allDevices,
    isLoading,
    assignToStation,
    renameDevice,
    syncToDatabase,
    updateDevice,
    clearCurrentDeviceRegistration,
  };
}
