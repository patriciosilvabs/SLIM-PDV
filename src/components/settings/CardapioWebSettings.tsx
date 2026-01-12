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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Zap,
  Download,
  Calendar,
} from 'lucide-react';
import { useCardapioWebIntegration, useCardapioWebMappings, useCardapioWebLogs, useSyncOrders } from '@/hooks/useCardapioWebIntegration';
import { useProducts } from '@/hooks/useProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cardapioweb-webhook`;

function IntegrationHealthStatus({ logs, integration }: { logs: any[]; integration: any }) {
  const lastLog = logs[0];
  const hasRecentActivity = lastLog && differenceInHours(new Date(), new Date(lastLog.created_at)) < 24;
  const successfulLogs = logs.filter(l => l.status === 'success');
  const errorLogs = logs.filter(l => l.status === 'error');
  
  if (!integration) {
    return null;
  }

  return (
    <Card className={hasRecentActivity ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Status da Integração
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{successfulLogs.length}</div>
            <div className="text-xs text-muted-foreground">Eventos OK</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-destructive">{errorLogs.length}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{lastLog ? format(new Date(lastLog.created_at), "dd/MM HH:mm", { locale: ptBR }) : '—'}</div>
            <div className="text-xs text-muted-foreground">Último Evento</div>
          </div>
        </div>
        
        {!hasRecentActivity && logs.length === 0 && (
          <Alert variant="default" className="mt-4 border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Nenhum webhook recebido</AlertTitle>
            <AlertDescription className="text-amber-600">
              Configure a URL do webhook no Portal do CardápioWeb para começar a receber pedidos.
            </AlertDescription>
          </Alert>
        )}
        
        {!hasRecentActivity && logs.length > 0 && (
          <Alert variant="default" className="mt-4 border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Sem atividade recente</AlertTitle>
            <AlertDescription className="text-amber-600">
              Nenhum webhook recebido nas últimas 24 horas. Verifique se a integração está ativa no CardápioWeb.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SetupGuide() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Guia de Configuração
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {isOpen ? 'Clique para fechar' : 'Clique para expandir'}
            </Badge>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Copie a URL do Webhook</p>
                  <p className="text-sm text-muted-foreground">
                    Use o botão de copiar no campo "URL do Webhook" abaixo.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Acesse o Portal do CardápioWeb</p>
                  <p className="text-sm text-muted-foreground">
                    Faça login no seu painel administrativo do CardápioWeb.
                  </p>
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-sm" 
                    asChild
                  >
                    <a href="https://cardapioweb.com.br" target="_blank" rel="noopener noreferrer">
                      Abrir CardápioWeb <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Configure o Webhook</p>
                  <p className="text-sm text-muted-foreground">
                    No CardápioWeb, vá em <strong>Configurações → Integrações → Webhook</strong> e cole a URL copiada.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Preencha as credenciais aqui</p>
                  <p className="text-sm text-muted-foreground">
                    Insira seu API Token e ID da Loja (merchant_id) nos campos abaixo.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                  5
                </div>
                <div>
                  <p className="font-medium">Faça um pedido de teste</p>
                  <p className="text-sm text-muted-foreground">
                    Crie um pedido no CardápioWeb para verificar se está funcionando. O pedido deve aparecer automaticamente.
                  </p>
                </div>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                O <strong>ID da Loja (merchant_id)</strong> deve corresponder exatamente ao ID configurado no CardápioWeb. 
                Se não souber o ID, verifique nas configurações da sua loja no painel do CardápioWeb.
              </AlertDescription>
            </Alert>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function CardapioWebSettings() {
  const { integration, isLoading, saveIntegration, deleteIntegration, testConnection } = useCardapioWebIntegration();
  const { mappings, isLoading: mappingsLoading, updateMapping, deleteMapping } = useCardapioWebMappings();
  const { logs, isLoading: logsLoading } = useCardapioWebLogs();
  const { data: products } = useProducts();
  const syncOrders = useSyncOrders();

  const [apiToken, setApiToken] = useState('');
  const [storeId, setStoreId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState('today');

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

  const handleSync = () => {
    const today = new Date();
    let start_date: string;
    let end_date = today.toISOString().split('T')[0];
    
    switch (syncPeriod) {
      case 'today':
        start_date = end_date;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start_date = yesterday.toISOString().split('T')[0];
        end_date = start_date;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start_date = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        start_date = monthAgo.toISOString().split('T')[0];
        break;
      default:
        start_date = end_date;
    }
    
    syncOrders.mutate({ start_date, end_date });
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

      {/* Setup Guide */}
      <SetupGuide />

      {/* Health Status */}
      {integration && !logsLoading && (
        <IntegrationHealthStatus logs={logs} integration={integration} />
      )}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="sync">
            Sincronizar
          </TabsTrigger>
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
            <CardContent className="space-y-3">
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
                  title="Copiar URL"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Cole esta URL exatamente como está no campo de webhook do CardápioWeb.
              </p>
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
                  ID da Loja (merchant_id) *
                </Label>
                <Input
                  id="store-id"
                  placeholder="Ex: 12345"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Este ID deve corresponder exatamente ao merchant_id enviado pelo CardápioWeb nos webhooks.
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

        <TabsContent value="sync" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Sincronizar Pedidos
              </CardTitle>
              <CardDescription>
                Importe pedidos anteriores do CardápioWeb que não foram recebidos via webhook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!integration ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Integração não configurada</AlertTitle>
                  <AlertDescription>
                    Configure a integração na aba "Configuração" antes de sincronizar pedidos.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sync-period" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Período
                    </Label>
                    <Select value={syncPeriod} onValueChange={setSyncPeriod}>
                      <SelectTrigger id="sync-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="yesterday">Ontem</SelectItem>
                        <SelectItem value="week">Últimos 7 dias</SelectItem>
                        <SelectItem value="month">Últimos 30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecione o período para buscar pedidos do CardápioWeb
                    </p>
                  </div>

                  <Button 
                    onClick={handleSync}
                    disabled={syncOrders.isPending}
                    className="w-full"
                  >
                    {syncOrders.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Sincronizar Agora
                      </>
                    )}
                  </Button>

                  {syncOrders.data && (
                    <Alert className={syncOrders.data.errors > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-green-500/50 bg-green-500/10'}>
                      {syncOrders.data.errors > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <AlertTitle>
                        {syncOrders.data.errors > 0 ? 'Sincronização parcial' : 'Sincronização concluída'}
                      </AlertTitle>
                      <AlertDescription>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>• {syncOrders.data.total} pedidos encontrados</li>
                          <li>• {syncOrders.data.imported} importados</li>
                          <li>• {syncOrders.data.skipped} já existiam</li>
                          {syncOrders.data.errors > 0 && (
                            <li className="text-amber-600">• {syncOrders.data.errors} erros</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Como funciona</AlertTitle>
                    <AlertDescription>
                      Esta função busca pedidos diretamente da API do CardápioWeb. 
                      Pedidos que já existem no sistema serão ignorados automaticamente.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
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
                  <p className="font-medium">Nenhum webhook recebido ainda</p>
                  <p className="text-sm mt-1">
                    Verifique se a URL do webhook foi configurada corretamente no CardápioWeb.
                  </p>
                  <p className="text-sm mt-2 text-amber-600">
                    Dica: Faça um pedido de teste no CardápioWeb para verificar se a integração está funcionando.
                  </p>
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