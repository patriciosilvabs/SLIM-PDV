import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { ShoppingCart } from 'lucide-react';

export function OrderSettingsSection() {
  const { duplicateItems, toggleDuplicateItems } = useOrderSettings();
  const { settings: tableWaitSettings, updateSettings: updateTableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings, updateSettings: updateIdleTableSettings } = useIdleTableSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Configurações de Pedido
        </CardTitle>
        <CardDescription>
          Ajuste o comportamento do sistema de pedidos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Duplicar itens em vez de somar quantidade</Label>
            <p className="text-sm text-muted-foreground">
              Quando ativo, adicionar o mesmo produto cria um novo item separado no pedido.
              Facilita a visualização de múltiplos itens na comanda da cozinha.
            </p>
          </div>
          <Switch 
            checked={duplicateItems} 
            onCheckedChange={toggleDuplicateItems} 
          />
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Alerta de tempo de espera de mesa</Label>
              <p className="text-sm text-muted-foreground">
                Tocar som quando uma mesa ocupada ultrapassar o tempo limite configurado
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={tableWaitSettings.thresholdMinutes.toString()}
                onValueChange={(v) => updateTableWaitSettings({ thresholdMinutes: Number(v) })}
                disabled={!tableWaitSettings.enabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="25">25 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
              <Switch 
                checked={tableWaitSettings.enabled} 
                onCheckedChange={(enabled) => updateTableWaitSettings({ enabled })} 
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Mesa ociosa (sem itens)</Label>
              <p className="text-sm text-muted-foreground">
                Alertar ou fechar mesas abertas sem pedidos após tempo limite
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={idleTableSettings.thresholdMinutes.toString()}
                onValueChange={(v) => updateIdleTableSettings({ thresholdMinutes: Number(v) })}
                disabled={!idleTableSettings.enabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Auto-fechar</Label>
                <Switch 
                  checked={idleTableSettings.autoClose} 
                  onCheckedChange={(autoClose) => updateIdleTableSettings({ autoClose })}
                  disabled={!idleTableSettings.enabled}
                />
              </div>
              <Switch 
                checked={idleTableSettings.enabled} 
                onCheckedChange={(enabled) => updateIdleTableSettings({ enabled })} 
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
            <div className="space-y-0.5">
              <Label className="text-sm">Incluir pedidos entregues</Label>
              <p className="text-xs text-muted-foreground">
                Também alertar quando o pedido já foi servido
              </p>
            </div>
            <Switch 
              checked={idleTableSettings.includeDeliveredOrders} 
              onCheckedChange={(includeDeliveredOrders) => updateIdleTableSettings({ includeDeliveredOrders })}
              disabled={!idleTableSettings.enabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
