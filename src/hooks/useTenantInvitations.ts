import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/hooks/useUserRole';
import {
  createTenantInvitation,
  deleteTenantInvitation,
  listPendingTenantInvitations,
} from '@/lib/firebaseTenantCrud';

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function useTenantInvitations() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading, error } = useQuery({
    queryKey: ['tenant-invitations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await listPendingTenantInvitations(tenantId);
      return data as TenantInvitation[];
    },
    enabled: !!tenantId,
  });

  const createInvitation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');

      const { data: userData } = await backendClient.auth.getUser();
      if (!userData.user) throw new Error('Usuario nao autenticado');

      return await createTenantInvitation({
        tenant_id: tenantId,
        email,
        role,
        invited_by: userData.user.id,
      });
    },
    onSuccess: () => {
      toast({ title: 'Convite enviado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations', tenantId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar convite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      await deleteTenantInvitation(invitationId);
    },
    onSuccess: () => {
      toast({ title: 'Convite cancelado!' });
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations', tenantId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao cancelar convite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    invitations: invitations ?? [],
    isLoading,
    error,
    createInvitation,
    deleteInvitation,
  };
}

export function useAcceptInvitation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await backendClient.functions.invoke('accept-tenant-invitation', {
        body: { token },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Convite aceito com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aceitar convite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
