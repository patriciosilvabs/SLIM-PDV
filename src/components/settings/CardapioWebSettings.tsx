import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Globe, 
  Key, 
  Store, 
  Shield, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2,
  Link,
  Unlink,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useCardapioWebIntegration, useCardapioWebMappings, useCardapioWebLogs } from '@/hooks/useCardapioWebIntegration';
import { useProducts } from '@/hooks/useProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cardapioweb-webhook`;

export function CardapioWebSettings() {
  const { integration, isLoading, saveIntegration, deleteIntegration, testConnection } = useCardapioWebIntegration();
  const { mappings, isLoading: mappingsLoading, updateMapping, deleteMapping } = useCardapioWebMappings();
  const { logs, isLoading: logsLoading } = useCardapioWebLogs();
  const { data: products } = useProducts();

  const [apiToken, setApiToken] = useState('');
  const [storeId, setStoreId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (integration) {
      setApiToken(integration.api_token);
      setStoreId(integration.store_id || '');
      setWebhookSecret(integration.webhook_secret || '');
      setIsActive(integration.is_active);
    }
  }, [integration]);

  const handleSave = () => {
    saveIntegration.mutate({
      api_token: apiToken,
      store_id: storeId,
      webhook_secret: webhookSecret,
      is_active: isActive,
    });
  };

  const handleTest = () => {
    testConnection.mutate(apiToken);
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja remover a integração?')) {
      deleteIntegration.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">CardápioWeb</h2>
            <p className="text-sm text-muted-foreground">
              Receba pedidos do seu cardápio digital
            </p>
          </div>
        </div>
        {integration && (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="mappings">
            Mapeamento de Produtos
            {mappings.length > 0 && (
              <Badge variant="secondary" className="ml-2">{mappings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">
            Logs
            {logs.length > 0 && (
              <Badge variant="secondary" className="ml-2">{logs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-4">
          {/* Webhook URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link className="h-4 w-4" />
                URL do Webhook
              </CardTitle>
              <CardDescription>
                Configure este URL no Portal do CardápioWeb para receber pedidos automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input 
                  value={WEBHOOK_URL} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyWebhook}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Token */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Credenciais da API
              </CardTitle>
              <CardDescription>
                Obtenha estas informações no Portal do CardápioWeb
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-token">API Token *</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Seu token de API do CardápioWeb"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-id" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  ID da Loja (merchant_id)
                </Label>
                <Input
                  id="store-id"
                  placeholder="Ex: 12345"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Necessário para receber webhooks. Encontre no Portal do CardápioWeb.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Webhook Secret (opcional)
                </Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder="Token de segurança para validar webhooks"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Configure o mesmo valor no CardápioWeb para maior segurança.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="is-active">Integração ativa</Label>
                </div>

                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={!apiToken || testConnection.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${testConnection.isPending ? 'animate-spin' : ''}`} />
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            {integration && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleteIntegration.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover Integração
              </Button>
            )}
            <Button 
              onClick={handleSave}
              disabled={!apiToken || saveIntegration.isPending}
              className="ml-auto"
            >
              {saveIntegration.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="mappings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapeamento de Produtos</CardTitle>
              <CardDescription>
                Associe produtos do CardápioWeb aos seus produtos locais para controle de estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : mappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Unlink className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum produto para mapear ainda.</p>
                  <p className="text-sm">Os produtos aparecerão aqui quando receberem pedidos.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {mappings.map((mapping) => (
                      <div 
                        key={mapping.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{mapping.cardapioweb_item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {mapping.cardapioweb_item_id}
                          </p>
                        </div>
                        <Select
                          value={mapping.local_product_id || 'none'}
                          onValueChange={(value) => {
                            updateMapping.mutate({
                              id: mapping.id,
                              local_product_id: value === 'none' ? null : value,
                              local_variation_id: null,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecionar produto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMapping.mutate(mapping.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Logs de Webhooks
              </CardTitle>
              <CardDescription>
                Últimos 50 eventos recebidos do CardápioWeb
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum log registrado ainda.</p>
                  <p className="text-sm">Os webhooks aparecerão aqui quando receberem eventos.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div 
                        key={log.id}
                        className="flex items-center gap-3 p-3 border rounded-lg text-sm"
                      >
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : log.status === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.event_type}
                            </Badge>
                            {log.external_order_id && (
                              <span className="text-muted-foreground">
                                Pedido #{log.external_order_id}
                              </span>
                            )}
                          </div>
                          {log.error_message && (
                            <p className="text-destructive text-xs mt-1 truncate">
                              {log.error_message}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
