import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { getProfileById, upsertProfile } from '@/lib/firebaseTenantCrud';

interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const data = await getProfileById(user.id);
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');
      await upsertProfile(user.id, { name: name.trim().toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({
        title: 'Perfil atualizado',
        description: 'Seu nome foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      if (!user?.email) throw new Error('Usuario nao autenticado');

      const { error: signInError } = await backendClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Senha atual incorreta');
      }

      const { error } = await backendClient.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const { data: sessionData } = await backendClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessao invalida');

      const response = await backendClient.functions.invoke('delete-user', {
        body: { password },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao excluir conta');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: async () => {
      await backendClient.auth.signOut();
      toast({
        title: 'Conta excluida',
        description: 'Sua conta foi excluida permanentemente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir conta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    profile,
    isLoading,
    updateProfile: updateProfileMutation.mutate,
    isUpdatingProfile: updateProfileMutation.isPending,
    changePassword: changePasswordMutation.mutate,
    isChangingPassword: changePasswordMutation.isPending,
    deleteAccount: deleteAccountMutation.mutate,
    isDeletingAccount: deleteAccountMutation.isPending,
  };
}
