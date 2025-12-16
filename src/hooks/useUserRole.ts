import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'cashier' | 'waiter' | 'kitchen';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export function useUserRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user?.id,
  });

  const roles = query.data?.map(r => r.role) || [];
  
  return {
    ...query,
    roles,
    isAdmin: roles.includes('admin'),
    isCashier: roles.includes('cashier'),
    isWaiter: roles.includes('waiter'),
    isKitchen: roles.includes('kitchen'),
    hasRole: (role: AppRole) => roles.includes(role),
    hasAnyRole: (allowedRoles: AppRole[]) => allowedRoles.some(r => roles.includes(r)),
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
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => ({
        ...profile,
        user_roles: allRoles
          .filter((role) => role.user_id === profile.id)
          .map((r) => ({ role: r.role as AppRole })),
      }));

      return usersWithRoles;
    },
  });
}

export function useUserRoleMutations() {
  const { refetch } = useUserRole();

  const assignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });
    
    if (error) throw error;
    refetch();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    
    if (error) throw error;
    refetch();
  };

  return { assignRole, removeRole };
}
