import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import {
  addUserRole,
  listProfilesByIds,
  listTenantMembers,
  listUserRoles,
  listUserRolesByUser,
  removeUserRole,
} from '@/lib/firebaseTenantCrud';

export type AppRole = 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'kds';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
}

export function useUserRole(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const enabled = options?.enabled ?? true;

  const query = useQuery({
    queryKey: ['user-roles', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return [];
      if (!tenantId) return [];
      const roles = await listUserRolesByUser(tenantId, user.id);
      return roles as UserRole[];
    },
    enabled: enabled && !!user?.id && !!tenantId,
  });

  const roles = query.data?.map((r) => r.role) || [];

  return {
    ...query,
    roles,
    isAdmin: roles.includes('admin'),
    isCashier: roles.includes('cashier'),
    isWaiter: roles.includes('waiter'),
    isKitchen: roles.includes('kitchen'),
    isKds: roles.includes('kds'),
    hasRole: (role: AppRole) => roles.includes(role),
    hasAnyRole: (allowedRoles: AppRole[]) => allowedRoles.some((r) => roles.includes(r)),
  };
}

export interface UserWithRoles {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_roles: { role: AppRole }[];
}

export function useAllUsers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['all-users', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const members = await listTenantMembers(tenantId);
      if (!members.length) return [];

      const userIds = members.map((m) => m.user_id);
      const [profiles, allRoles] = await Promise.all([
        listProfilesByIds(userIds),
        listUserRoles(tenantId),
      ]);

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        ...profile,
        name: profile.name || 'Usuario',
        user_roles: (allRoles || [])
          .filter((role) => role.user_id === profile.id)
          .map((r) => ({ role: r.role as AppRole })),
      }));

      return usersWithRoles;
    },
    enabled: !!tenantId,
  });
}

export function useUserRoleMutations() {
  const { refetch } = useUserRole();
  const { tenantId } = useTenant();

  const assignRole = async (userId: string, role: AppRole) => {
    if (!tenantId) throw new Error('Tenant nao encontrado');
    await addUserRole(tenantId, userId, role);
    refetch();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    if (!tenantId) throw new Error('Tenant nao encontrado');
    await removeUserRole(tenantId, userId, role);
    refetch();
  };

  return { assignRole, removeRole };
}
