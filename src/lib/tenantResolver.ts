import { backendClient } from '@/integrations/backend/client';
import { firebaseAuth } from '@/integrations/firebase/client';
import { listTenantMembershipsByUser } from '@/lib/firebaseTenantCrud';
import { getStoredKdsDeviceTenantId, hasActiveKdsDeviceSession } from '@/lib/kdsDeviceSession';

const ACTIVE_TENANT_KEY = 'activeTenantId';

export async function resolveCurrentTenantId(): Promise<string | null> {
  if (hasActiveKdsDeviceSession()) {
    return getStoredKdsDeviceTenantId();
  }

  const authWithReady = firebaseAuth as typeof firebaseAuth & {
    authStateReady?: () => Promise<void>;
  };

  if (typeof authWithReady.authStateReady === 'function') {
    await authWithReady.authStateReady();
  }

  const storedTenantId =
    typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_TENANT_KEY) : null;

  const currentUid = firebaseAuth.currentUser?.uid ?? null;
  if (currentUid && storedTenantId) {
    return storedTenantId;
  }

  const { data: userData, error: userError } = await backendClient.auth.getUser();
  if (userError) {
    throw userError;
  }

  const uid = userData.user?.id;
  if (!uid) return null;

  if (storedTenantId) {
    return storedTenantId;
  }

  const memberships = await listTenantMembershipsByUser(uid);
  const resolvedTenantId = memberships[0]?.tenant_id ?? null;

  if (resolvedTenantId && typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_TENANT_KEY, resolvedTenantId);
  }

  return resolvedTenantId;
}



