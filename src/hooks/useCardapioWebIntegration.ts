import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  deleteCardapioWebIntegration as deleteIntegrationDoc,
  deleteCardapioWebMapping,
  getCardapioWebIntegration,
  listCardapioWebLogs,
  listCardapioWebMappings,
  upsertCardapioWebIntegration,
  updateCardapioWebMapping,
} from '@/lib/firebaseTenantCrud';

export interface CardapioWebIntegration {
  id: string;
  tenant_id: string;
  api_token: string;
  webhook_secret: string | null;
  store_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardapioWebProductMapping {
  id: string;
  tenant_id: string;
  cardapioweb_item_id: number;
  cardapioweb_item_name: string;
  local_product_id: string | null;
  local_variation_id: string | null;
  created_at: string;
}

export interface CardapioWebLog {
  id: string;
  tenant_id: string;
  event_type: string;
  external_order_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useCardapioWebIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: integration, isLoading, error } = useQuery({
    queryKey: ['cardapioweb-integration', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return (await getCardapioWebIntegration(tenantId)) as CardapioWebIntegration | null;
    },
    enabled: !!tenantId,
  });

  const saveIntegration = useMutation({
    mutationFn: async (values: {
      api_token: string;
      store_id?: string;
      webhook_secret?: string;
      is_active: boolean;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await upsertCardapioWebIntegration(
        tenantId,
        {
          api_token: values.api_token,
          store_id: values.store_id || null,
          webhook_secret: values.webhook_secret || null,
          is_active: values.is_active,
        },
        integration?.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration'] });
      toast({ title: 'Integracao salva com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar integracao',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async () => {
      if (!tenantId || !integration?.id) return;
      await deleteIntegrationDoc(tenantId, integration.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration'] });
      toast({ title: 'Integracao removida' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover integracao',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (apiToken: string) => {
      const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
        headers: {
          'X-API-KEY': apiToken,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Conexao bem sucedida!',
        description: `Loja: ${data.name || data.id}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Falha na conexao',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    integration,
    isLoading,
    error,
    saveIntegration,
    deleteIntegration,
    testConnection,
  };
}

export function useCardapioWebMappings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['cardapioweb-mappings', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listCardapioWebMappings(tenantId)) as CardapioWebProductMapping[];
    },
    enabled: !!tenantId,
  });

  const updateMapping = useMutation({
    mutationFn: async ({
      id,
      local_product_id,
      local_variation_id,
    }: {
      id: string;
      local_product_id: string | null;
      local_variation_id: string | null;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateCardapioWebMapping(tenantId, id, { local_product_id, local_variation_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast({ title: 'Mapeamento atualizado' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar mapeamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteCardapioWebMapping(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast({ title: 'Mapeamento removido' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover mapeamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
    updateMapping,
    deleteMapping,
  };
}

export function useCardapioWebLogs() {
  const { tenantId } = useTenant();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['cardapioweb-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listCardapioWebLogs(tenantId, 50)) as CardapioWebLog[];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  return {
    logs: logs || [],
    isLoading,
  };
}

export function useSyncOrderStatus() {
  return useMutation({
    mutationFn: async ({
      order_id,
      new_status,
      cancellation_reason,
    }: {
      order_id: string;
      new_status: string;
      cancellation_reason?: string;
    }) => {
      const { data, error } = await backendClient.functions.invoke('cardapioweb-sync-status', {
        body: { order_id, new_status, cancellation_reason },
      });

      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      console.error('[CardapioWeb] Sync error:', error);
    },
  });
}

export interface SyncOrdersResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export function useSyncOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      start_date,
      end_date,
    }: {
      start_date: string;
      end_date: string;
    }): Promise<SyncOrdersResult> => {
      const { data, error } = await backendClient.functions.invoke('cardapioweb-sync-orders', {
        body: { start_date, end_date },
      });

      if (error) throw error;
      return data as SyncOrdersResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-logs'] });
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-mappings'] });
      toast({
        title: 'Sincronizacao concluida!',
        description: `${data.imported} pedidos importados, ${data.skipped} ja existiam.`,
      });
    },
    onError: (error: Error) => {
      console.error('[CardapioWeb] Sync orders error:', error);
      toast({
        title: 'Erro na sincronizacao',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
