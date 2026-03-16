import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantById, getTenantMembership, listTenantMembershipsByUser } from '@/lib/firebaseTenantCrud';
import { hasActiveKdsDeviceSession } from '@/lib/kdsDeviceSession';

const ACTIVE_TENANT_KEY = 'activeTenantId';
const ACTIVE_TENANT_USER_KEY = 'activeTenantUserId';

export interface TenantMembership {
  tenant_id: string;
  is_owner: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface TenantContextType {
  allTenants: TenantMembership[];
  activeTenant: TenantMembership | null;
  tenantId: string | null;
  tenant: TenantMembership['tenant'];
  isOwner: boolean;
  isLoading: boolean;
  error: Error | null;
  hasTenant: boolean;
  setActiveTenant: (
    tenantId: string,
    tenant?: TenantMembership['tenant'],
    isOwner?: boolean
  ) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isKdsDeviceMode = hasActiveKdsDeviceSession();
  const previousUserIdRef = React.useRef<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_TENANT_KEY);
    }
    return null;
  });
  const [activeTenantUserId, setActiveTenantUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_TENANT_USER_KEY);
    }
    return null;
  });
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [optimisticTenants, setOptimisticTenants] = useState<TenantMembership[]>([]);
  const [isBootstrappingStoredTenant, setIsBootstrappingStoredTenant] = useState(false);
  const [storedTenantBootstrapCheckedKey, setStoredTenantBootstrapCheckedKey] = useState<string | null>(null);

  const persistActiveTenant = useCallback((tenantId: string) => {
    if (typeof window === 'undefined' || !user?.id) return;

    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    localStorage.setItem(ACTIVE_TENANT_USER_KEY, user.id);
    setActiveTenantUserId(user.id);
  }, [user?.id]);

  const clearPersistedActiveTenant = useCallback(() => {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(ACTIVE_TENANT_USER_KEY);
    setActiveTenantUserId(null);
  }, []);

  // Fetch all tenants for the user
  const { data: fetchedTenants = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['all-tenant-memberships', user?.id],
    queryFn: async (): Promise<TenantMembership[]> => {
      if (!user?.id) return [];

      const memberships = await listTenantMembershipsByUser(user.id);
      const tenantIds = memberships.map((m) => m.tenant_id);
      const tenants = await Promise.all(tenantIds.map((id) => getTenantById(id)));
      const tenantById = new Map(tenants.filter(Boolean).map((t) => [t!.id, t!]));

      return memberships.map((item) => ({
        tenant_id: item.tenant_id,
        is_owner: item.is_owner ?? false,
        tenant: tenantById.get(item.tenant_id) ?? null,
      }));
    },
    enabled: !isKdsDeviceMode && !authLoading && !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (isKdsDeviceMode) {
      return;
    }

    if (authLoading) {
      return;
    }

    const currentUserId = user?.id ?? null;

    if (currentUserId && previousUserIdRef.current !== currentUserId) {
      if (activeTenantUserId && activeTenantUserId !== currentUserId) {
        setActiveTenantId(null);
        clearPersistedActiveTenant();
      }

      setPendingTenantId(null);
      setOptimisticTenants([]);
      setStoredTenantBootstrapCheckedKey(null);
      queryClient.invalidateQueries({ queryKey: ['all-tenant-memberships', currentUserId] });
      void refetch();
    }

    if (!currentUserId && previousUserIdRef.current) {
      setActiveTenantId(null);
      setPendingTenantId(null);
      setOptimisticTenants([]);
      setStoredTenantBootstrapCheckedKey(null);
      clearPersistedActiveTenant();
      queryClient.removeQueries({ queryKey: ['all-tenant-memberships'] });
    }

    previousUserIdRef.current = currentUserId;
  }, [activeTenantUserId, authLoading, clearPersistedActiveTenant, isKdsDeviceMode, queryClient, refetch, user?.id]);

  const allTenants = useMemo<TenantMembership[]>(() => {
    if (optimisticTenants.length === 0) {
      return fetchedTenants;
    }

    const tenantMap = new Map<string, TenantMembership>();
    optimisticTenants.forEach((tenant) => {
      tenantMap.set(tenant.tenant_id, tenant);
    });
    fetchedTenants.forEach((tenant) => {
      tenantMap.set(tenant.tenant_id, tenant);
    });

    return Array.from(tenantMap.values());
  }, [fetchedTenants, optimisticTenants]);

  useEffect(() => {
    if (isKdsDeviceMode) return;
    if (fetchedTenants.length === 0) return;

    setOptimisticTenants((current) =>
      current.filter((tenant) => !fetchedTenants.some((fetched) => fetched.tenant_id === tenant.tenant_id))
    );
  }, [fetchedTenants, isKdsDeviceMode]);

  // Validate and set active tenant
  useEffect(() => {
    if (isKdsDeviceMode) return;
    if (authLoading || !user || isLoading || error) return;

    if (pendingTenantId) {
      const pendingTenant = allTenants.find((tenant) => tenant.tenant_id === pendingTenantId);
      if (pendingTenant) {
        setActiveTenantId(pendingTenantId);
        setPendingTenantId(null);
        persistActiveTenant(pendingTenantId);
        return;
      }
    }

    if (allTenants.length === 0) {
      return;
    }

    const storedTenantId = localStorage.getItem(ACTIVE_TENANT_KEY);
    const storedTenantUserId = localStorage.getItem(ACTIVE_TENANT_USER_KEY);
    
    // Check if stored tenant is valid (user still has access)
    const storedTenantValid = storedTenantId && 
      storedTenantUserId === user.id &&
      allTenants.some(t => t.tenant_id === storedTenantId);

    if (storedTenantValid) {
      setActiveTenantId(storedTenantId);
      setActiveTenantUserId(user.id);
    } else {
      // Default to first tenant
      const firstTenant = allTenants[0];
      if (firstTenant) {
        setActiveTenantId(firstTenant.tenant_id);
        persistActiveTenant(firstTenant.tenant_id);
      }
    }
  }, [activeTenantId, allTenants, authLoading, error, isKdsDeviceMode, isLoading, pendingTenantId, persistActiveTenant, user]);

  // Get the active tenant object
  const activeTenant = useMemo(() => {
    if (!activeTenantId || allTenants.length === 0) return null;
    return allTenants.find(t => t.tenant_id === activeTenantId) || null;
  }, [activeTenantId, allTenants]);

  const isResolvingPendingTenant = useMemo(() => {
    if (!pendingTenantId) return false;
    return !allTenants.some((tenant) => tenant.tenant_id === pendingTenantId);
  }, [allTenants, pendingTenantId]);

  const addOptimisticTenant = useCallback(
    (tenantId: string, tenant: TenantMembership['tenant'], isOwner = false) => {
      if (!tenant) return;

      const optimisticMembership: TenantMembership = {
        tenant_id: tenantId,
        is_owner: isOwner,
        tenant,
      };

      setOptimisticTenants((current) => {
        const next = current.filter((item) => item.tenant_id !== tenantId);
        return [optimisticMembership, ...next];
      });

      if (user?.id) {
        queryClient.setQueryData<TenantMembership[]>(
          ['all-tenant-memberships', user.id],
          (current = []) => {
            const next = current.filter((item) => item.tenant_id !== tenantId);
            return [optimisticMembership, ...next];
          }
        );
      }
    },
    [queryClient, user?.id]
  );

  useEffect(() => {
    if (isKdsDeviceMode) {
      setIsBootstrappingStoredTenant(false);
      return;
    }

    if (authLoading || !user?.id || !activeTenantId) {
      setIsBootstrappingStoredTenant(false);
      return;
    }

    if (activeTenantUserId && activeTenantUserId !== user.id) {
      setIsBootstrappingStoredTenant(false);
      return;
    }

    if (allTenants.some((tenant) => tenant.tenant_id === activeTenantId)) {
      setIsBootstrappingStoredTenant(false);
      return;
    }

    let cancelled = false;

    const bootstrapStoredTenant = async () => {
      setIsBootstrappingStoredTenant(true);

      try {
        const membership = await getTenantMembership(activeTenantId, user.id);
        if (!membership) {
          return;
        }

        const tenant = await getTenantById(activeTenantId);
        if (!tenant || cancelled) {
          return;
        }

        addOptimisticTenant(activeTenantId, tenant, membership.is_owner ?? false);
        setActiveTenantId(activeTenantId);
        persistActiveTenant(activeTenantId);
      } catch (bootstrapError) {
        console.warn('Falha ao bootstrap do tenant salvo', { activeTenantId, userId: user.id, bootstrapError });
      } finally {
        if (!cancelled) {
          setStoredTenantBootstrapCheckedKey(`${user.id}:${activeTenantId}`);
          setIsBootstrappingStoredTenant(false);
        }
      }
    };

    void bootstrapStoredTenant();

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, activeTenantUserId, addOptimisticTenant, allTenants, authLoading, isKdsDeviceMode, persistActiveTenant, user?.id]);

  // Switch tenant function
  const setActiveTenant = useCallback((
    tenantId: string,
    tenant?: TenantMembership['tenant'],
    isOwner = false
  ) => {
    // Validate that user has access to this tenant
    const tenantExists = allTenants.some(t => t.tenant_id === tenantId);
    if (!tenantExists) {
      if (tenant) {
        addOptimisticTenant(tenantId, tenant, isOwner);
        setPendingTenantId(null);
        setActiveTenantId(tenantId);
        persistActiveTenant(tenantId);
        queryClient.invalidateQueries();
        return;
      }

      console.warn('Tenant ainda nao apareceu na lista local, ativacao pendente:', tenantId);
      setPendingTenantId(tenantId);
      setActiveTenantId(tenantId);
      persistActiveTenant(tenantId);
      queryClient.invalidateQueries({ queryKey: ['all-tenant-memberships', user?.id] });
      return;
    }

    // Update state and localStorage
    setPendingTenantId(null);
    setActiveTenantId(tenantId);
    persistActiveTenant(tenantId);

    // Invalidate all queries to refresh data for new tenant
    queryClient.invalidateQueries();
  }, [addOptimisticTenant, allTenants, persistActiveTenant, queryClient, user?.id]);

  // Refresh tenants function
  const refreshTenants = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const canUseStoredTenant =
    authLoading || (Boolean(user?.id) && activeTenantUserId === user?.id);
  const storedTenantBootstrapKey = user?.id && activeTenantId ? `${user.id}:${activeTenantId}` : null;
  const isWaitingForStoredTenantBootstrap =
    Boolean(
      storedTenantBootstrapKey &&
      (!activeTenantUserId || activeTenantUserId === user?.id) &&
      !activeTenant &&
      allTenants.length === 0 &&
      storedTenantBootstrapCheckedKey !== storedTenantBootstrapKey
    );
  const effectiveTenantId =
    activeTenant?.tenant_id ??
    pendingTenantId ??
    (canUseStoredTenant ? activeTenantId : null) ??
    null;

  const value = useMemo<TenantContextType>(() => ({
    allTenants,
    activeTenant,
    tenantId: effectiveTenantId,
    tenant: activeTenant?.tenant ?? null,
    isOwner: activeTenant?.is_owner ?? false,
    isLoading:
      (!isKdsDeviceMode && authLoading) ||
      (!isKdsDeviceMode && isWaitingForStoredTenantBootstrap) ||
      (!isKdsDeviceMode && isBootstrappingStoredTenant) ||
      (!isKdsDeviceMode && isLoading) ||
      (!isKdsDeviceMode && Boolean(user?.id) && isFetching && allTenants.length === 0 && !activeTenant && !pendingTenantId) ||
      (!isKdsDeviceMode && isResolvingPendingTenant),
    error: error as Error | null,
    hasTenant: !!effectiveTenantId,
    setActiveTenant,
    refreshTenants,
  }), [activeTenant, allTenants, authLoading, effectiveTenantId, error, isBootstrappingStoredTenant, isFetching, isKdsDeviceMode, isLoading, isResolvingPendingTenant, isWaitingForStoredTenantBootstrap, pendingTenantId, refreshTenants, setActiveTenant, user?.id]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}



