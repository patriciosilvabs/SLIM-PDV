import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  // Fetch integration config
  const { data: integration, isLoading, error } = useQuery({
    queryKey: ['cardapioweb-integration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_integrations')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as CardapioWebIntegration | null;
    },
  });

  // Save integration
  const saveIntegration = useMutation({
    mutationFn: async (values: {
      api_token: string;
      store_id?: string;
      webhook_secret?: string;
      is_active: boolean;
    }) => {
      // Get tenant_id
      const { data: tenantData } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .limit(1)
        .single();

      if (!tenantData?.tenant_id) {
        throw new Error('Tenant não encontrado');
      }

      const payload = {
        tenant_id: tenantData.tenant_id,
        api_token: values.api_token,
        store_id: values.store_id || null,
        webhook_secret: values.webhook_secret || null,
        is_active: values.is_active,
      };

      if (integration?.id) {
        const { error } = await supabase
          .from('cardapioweb_integrations')
          .update(payload)
          .eq('id', integration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cardapioweb_integrations')
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration'] });
      toast({ title: 'Integração salva com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao salvar integração', 
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete integration
  const deleteIntegration = useMutation({
    mutationFn: async () => {
      if (!integration?.id) return;

      const { error } = await supabase
        .from('cardapioweb_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapioweb-integration'] });
      toast({ title: 'Integração removida' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover integração', 
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test connection
  const testConnection = useMutation({
    mutationFn: async (apiToken: string) => {
      const response = await fetch(
        'https://integracao.cardapioweb.com/api/partner/v1/merchant',
        {
          headers: {
            'X-API-KEY': apiToken,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Conexão bem sucedida!', 
        description: `Loja: ${data.name || data.id}`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Falha na conexão', 
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

  // Fetch mappings
  const { data: mappings, isLoading } = useQuery({
    queryKey: ['cardapioweb-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_product_mappings')
        .select('*')
        .order('cardapioweb_item_name');

      if (error) throw error;
      return data as CardapioWebProductMapping[];
    },
  });

  // Update mapping
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
      const { error } = await supabase
        .from('cardapioweb_product_mappings')
        .update({ local_product_id, local_variation_id })
        .eq('id', id);

      if (error) throw error;
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

  // Delete mapping
  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cardapioweb_product_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
  const { data: logs, isLoading } = useQuery({
    queryKey: ['cardapioweb-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cardapioweb_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CardapioWebLog[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  return {
    logs: logs || [],
    isLoading,
  };
}

export function useSyncOrderStatus() {
  const { toast } = useToast();

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
      const { data, error } = await supabase.functions.invoke('cardapioweb-sync-status', {
        body: { order_id, new_status, cancellation_reason },
      });

      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      console.error('[CardápioWeb] Sync error:', error);
      // Don't show error toast - the local update succeeded
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
      const { data, error } = await supabase.functions.invoke('cardapioweb-sync-orders', {
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
        title: 'Sincronização concluída!',
        description: `${data.imported} pedidos importados, ${data.skipped} já existiam.`,
      });
    },
    onError: (error: Error) => {
      console.error('[CardápioWeb] Sync orders error:', error);
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
