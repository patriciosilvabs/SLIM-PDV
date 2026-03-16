const DEVICE_AUTH_STORAGE_KEY = 'kds_device_auth';

export interface StoredKdsDeviceAuth {
  deviceId: string;
  deviceName: string;
  stationId: string | null;
  tenantId: string | null;
}

export function getStoredKdsDeviceAuth(): StoredKdsDeviceAuth | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(DEVICE_AUTH_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const deviceId = typeof parsed?.deviceId === 'string' ? parsed.deviceId.trim() : '';
    const tenantId = typeof parsed?.tenantId === 'string' ? parsed.tenantId.trim() : '';

    if (!deviceId || !tenantId) return null;

    return {
      deviceId,
      deviceName: typeof parsed?.deviceName === 'string' ? parsed.deviceName : 'KDS Device',
      stationId: typeof parsed?.stationId === 'string' && parsed.stationId ? parsed.stationId : null,
      tenantId,
    };
  } catch {
    return null;
  }
}

export function isKdsRoute(pathname?: string): boolean {
  const currentPath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return currentPath.toLowerCase().includes('/kds');
}

export function hasActiveKdsDeviceSession(pathname?: string): boolean {
  return !!getStoredKdsDeviceAuth() && isKdsRoute(pathname);
}

export function getStoredKdsDeviceTenantId(): string | null {
  return getStoredKdsDeviceAuth()?.tenantId ?? null;
}

export function clearStoredKdsDeviceAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEVICE_AUTH_STORAGE_KEY);
}
