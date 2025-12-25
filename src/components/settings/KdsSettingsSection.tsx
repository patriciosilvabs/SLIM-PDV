import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useKdsSettings, KdsOperationMode } from '@/hooks/useKdsSettings';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useKdsDevice } from '@/hooks/useKdsDevice';
import { ChefHat, Printer, Monitor, Factory, Clock, Circle, X, Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function KdsSettingsSection() {
  const { settings, updateSettings, updateDeviceSettings, updateBottleneckSettings, updateStationOverride, isLoading } = useKdsSettings();
  const { activeStations } = useKdsStations();
  const { device, assignToStation, renameDevice } = useKdsDevice();
  const [newKeyword, setNewKeyword] = useState('');
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());

  const addBorderKeyword = () => {
    if (newKeyword.trim() && !settings.borderKeywords.includes(newKeyword.trim().toLowerCase())) {
      updateSettings({
        borderKeywords: [...settings.borderKeywords, newKeyword.trim().toLowerCase()]
      });
      setNewKeyword('');
    }
  };

  const removeBorderKeyword = (keyword: string) => {
    updateSettings({
      borderKeywords: settings.borderKeywords.filter(k => k !== keyword)
    });
  };

  const toggleStationExpanded = (stationId: string) => {
    setExpandedStations(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
      }
      return next;
    });
  };

  const queueSizeOptions = [3, 5, 8, 10, 15];
  const timeRatioOptions = [
    { value: 1.2, label: '1.2x (20% acima)' },
    { value: 1.3, label: '1.3x (30% acima)' },
    { value: 1.5, label: '1.5x (50% acima)' },
    { value: 1.8, label: '1.8x (80% acima)' },
    { value: 2.0, label: '2.0x (100% acima)' },
  ];

  return (
    <div className="space-y-6">
      {/* Modo de Operação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Modo de Operação
          </CardTitle>
          <CardDescription>
            Defina como o KDS irá organizar o fluxo de trabalho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateSettings({ operationMode: 'traditional' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.operationMode === 'traditional'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-5 w-5" />
                <span className="font-medium">Tradicional</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Todos os pedidos aparecem em uma única tela. Ideal para operações pequenas
                onde um único cozinheiro gerencia todo o processo.
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ operationMode: 'production_line' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.operationMode === 'production_line'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-5 w-5" />
                <span className="font-medium">Linha de Produção</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Cada dispositivo mostra apenas sua praça. O item avança conforme a etapa
                é concluída. Ideal para alta demanda.
              </p>
            </button>
          </div>

          {settings.operationMode === 'production_line' && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
              <div>
                <Label className="font-medium">Nome deste dispositivo</Label>
                <Input
                  value={settings.deviceName}
                  onChange={(e) => {
                    updateDeviceSettings({ deviceName: e.target.value });
                    renameDevice(e.target.value);
                  }}
                  placeholder="Ex: Tablet Cozinha 1"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {settings.deviceId.slice(0, 8)}...
                </p>
              </div>

              <div>
                <Label className="font-medium">Praça atribuída</Label>
                <Select
                  value={settings.assignedStationId || 'none'}
                  onValueChange={(value) => assignToStation(value === 'none' ? null : value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma praça" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (ver todas)</SelectItem>
                    {activeStations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        <div className="flex items-center gap-2">
                          <Circle 
                            className="h-3 w-3" 
                            style={{ color: station.color, fill: station.color }} 
                          />
                          {station.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando atribuído, este dispositivo mostrará apenas os itens desta praça.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas de Gargalo */}
      {settings.operationMode === 'production_line' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Gargalo
            </CardTitle>
            <CardDescription>
              Configure os limites para detecção de gargalos por praça
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Ativar alertas de gargalo</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações quando uma praça estiver com acúmulo de itens ou tempo elevado
                </p>
              </div>
              <Switch
                checked={settings.bottleneckSettings.enabled}
                onCheckedChange={(enabled) => updateBottleneckSettings({ enabled })}
              />
            </div>

            {settings.bottleneckSettings.enabled && (
              <>
                {/* Limites Padrão */}
                <div className="border-t pt-4">
                  <Label className="font-medium text-base mb-3 block">Limites Padrão</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Tamanho máximo de fila</Label>
                      <Select
                        value={String(settings.bottleneckSettings.defaultMaxQueueSize)}
                        onValueChange={(value) => updateBottleneckSettings({ defaultMaxQueueSize: Number(value) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {queueSizeOptions.map(n => (
                            <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta quando a fila exceder este número
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">Tempo máximo relativo</Label>
                      <Select
                        value={String(settings.bottleneckSettings.defaultMaxTimeRatio)}
                        onValueChange={(value) => updateBottleneckSettings({ defaultMaxTimeRatio: Number(value) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeRatioOptions.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta quando o tempo médio exceder este ratio da média geral
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuração por Praça */}
                {activeStations.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="font-medium text-base mb-3 block">Configuração por Praça</Label>
                    <div className="space-y-2">
                      {activeStations.map((station) => {
                        const override = settings.bottleneckSettings.stationOverrides[station.id];
                        const hasOverride = override && (override.maxQueueSize !== undefined || override.maxTimeRatio !== undefined);
                        const isExpanded = expandedStations.has(station.id);
                        const alertsEnabled = override?.alertsEnabled !== false;

                        return (
                          <Collapsible
                            key={station.id}
                            open={isExpanded}
                            onOpenChange={() => toggleStationExpanded(station.id)}
                          >
                            <div className="border rounded-lg overflow-hidden">
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Circle
                                      className="h-4 w-4"
                                      style={{ color: station.color, fill: station.color }}
                                    />
                                    <span className="font-medium">{station.name}</span>
                                    {hasOverride && (
                                      <Badge variant="secondary" className="text-xs">
                                        Personalizado
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={alertsEnabled}
                                      onCheckedChange={(checked) => {
                                        updateStationOverride(station.id, { alertsEnabled: checked });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform",
                                      isExpanded && "rotate-180"
                                    )} />
                                  </div>
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 border-t bg-muted/30 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      id={`override-${station.id}`}
                                      checked={hasOverride}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          updateStationOverride(station.id, {
                                            maxQueueSize: settings.bottleneckSettings.defaultMaxQueueSize,
                                            maxTimeRatio: settings.bottleneckSettings.defaultMaxTimeRatio,
                                          });
                                        } else {
                                          // Remove overrides but keep alertsEnabled
                                          const currentAlertsEnabled = override?.alertsEnabled;
                                          if (currentAlertsEnabled !== undefined && !currentAlertsEnabled) {
                                            updateStationOverride(station.id, { alertsEnabled: false });
                                          } else {
                                            updateStationOverride(station.id, null);
                                          }
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`override-${station.id}`} className="text-sm">
                                      Usar limites personalizados
                                    </Label>
                                  </div>

                                  {hasOverride && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Fila máx.</Label>
                                        <Select
                                          value={String(override?.maxQueueSize ?? settings.bottleneckSettings.defaultMaxQueueSize)}
                                          onValueChange={(value) => {
                                            updateStationOverride(station.id, { maxQueueSize: Number(value) });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {queueSizeOptions.map(n => (
                                              <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Tempo máx.</Label>
                                        <Select
                                          value={String(override?.maxTimeRatio ?? settings.bottleneckSettings.defaultMaxTimeRatio)}
                                          onValueChange={(value) => {
                                            updateStationOverride(station.id, { maxTimeRatio: Number(value) });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {timeRatioOptions.map(opt => (
                                              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* SLA Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SLA Visual (Semáforo)
          </CardTitle>
          <CardDescription>
            Configure os tempos para indicação visual de urgência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
                Verde (OK)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.slaGreenMinutes)}
                  onValueChange={(value) => updateSettings({ slaGreenMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8, 10, 12, 15].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                Amarelo (Atenção)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.slaYellowMinutes)}
                  onValueChange={(value) => updateSettings({ slaYellowMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[8, 10, 12, 15, 18, 20, 25, 30].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Acima de {settings.slaYellowMinutes} minutos, o pedido ficará <span className="text-red-500 font-medium">vermelho</span> (prioridade máxima).
          </p>
        </CardContent>
      </Card>

      {/* Destaque de Bordas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Circle className="h-5 w-5" />
            Destaque de Bordas (Pizzarias)
          </CardTitle>
          <CardDescription>
            Configure palavras-chave para destacar pedidos com bordas especiais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Ativar destaque de bordas</Label>
              <p className="text-sm text-muted-foreground">
                Pedidos com bordas especiais terão destaque visual agressivo
              </p>
            </div>
            <Switch
              checked={settings.highlightSpecialBorders}
              onCheckedChange={(highlightSpecialBorders) => updateSettings({ highlightSpecialBorders })}
            />
          </div>

          {settings.highlightSpecialBorders && (
            <div className="space-y-3">
              <Label className="font-medium">Palavras-chave de borda</Label>
              <div className="flex flex-wrap gap-2">
                {settings.borderKeywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeBorderKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Nova palavra-chave"
                  onKeyDown={(e) => e.key === 'Enter' && addBorderKeyword()}
                />
                <Button type="button" variant="outline" size="icon" onClick={addBorderKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações Tradicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Ajuste o comportamento do Kitchen Display System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Mostrar quantidade de pessoas</Label>
              <p className="text-sm text-muted-foreground">
                Exibe "X pessoas" das mesas no KDS
              </p>
            </div>
            <Switch 
              checked={settings.showPartySize ?? true}
              onCheckedChange={(showPartySize) => updateSettings({ showPartySize })} 
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Exibir coluna "Pendente"</Label>
                <p className="text-sm text-muted-foreground">
                  Quando desativado, pedidos entram direto em preparo. Útil para restaurantes
                  de alta demanda onde a produção inicia automaticamente.
                </p>
              </div>
              <Switch 
                checked={settings.showPendingColumn} 
                onCheckedChange={(showPendingColumn) => updateSettings({ showPendingColumn })} 
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Alertas de Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe notificações visuais e sonoras quando pedidos em produção são cancelados.
                </p>
              </div>
              <Switch 
                checked={settings.cancellationAlertsEnabled ?? true}
                onCheckedChange={(cancellationAlertsEnabled) => 
                  updateSettings({ cancellationAlertsEnabled })
                }
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Intervalo do Alerta de Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Com que frequência o som de alerta toca quando há pedidos cancelados.
                </p>
              </div>
              <Select
                value={String(settings.cancellationAlertInterval || 3)}
                onValueChange={(value) => updateSettings({ cancellationAlertInterval: Number(value) })}
                disabled={!(settings.cancellationAlertsEnabled ?? true)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 segundo</SelectItem>
                  <SelectItem value="2">2 segundos</SelectItem>
                  <SelectItem value="3">3 segundos</SelectItem>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Impressão Automática de Cancelamentos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, imprime automaticamente um comprovante de cancelamento.
                </p>
              </div>
              <Switch 
                checked={settings.autoPrintCancellations ?? true}
                onCheckedChange={(autoPrintCancellations) => 
                  updateSettings({ autoPrintCancellations })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
