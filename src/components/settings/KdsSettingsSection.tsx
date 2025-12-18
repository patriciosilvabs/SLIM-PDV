import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { ChefHat } from 'lucide-react';

export function KdsSettingsSection() {
  const { settings: kdsSettings, updateSettings: updateKdsSettings } = useKdsSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          Configurações do KDS
        </CardTitle>
        <CardDescription>
          Ajuste o comportamento do Kitchen Display System
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Exibir coluna "Pendente"</Label>
            <p className="text-sm text-muted-foreground">
              Quando desativado, pedidos entram direto em preparo. Útil para restaurantes
              de alta demanda onde a produção inicia automaticamente.
            </p>
          </div>
          <Switch 
            checked={kdsSettings.showPendingColumn} 
            onCheckedChange={(showPendingColumn) => updateKdsSettings({ showPendingColumn })} 
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Alertas de Cancelamento</Label>
              <p className="text-sm text-muted-foreground">
                Exibe notificações visuais e sonoras quando pedidos em produção são cancelados.
                Desative para restaurantes com alto volume de cancelamentos.
              </p>
            </div>
            <Switch 
              checked={kdsSettings.cancellationAlertsEnabled ?? true}
              onCheckedChange={(cancellationAlertsEnabled) => 
                updateKdsSettings({ cancellationAlertsEnabled })
              }
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Intervalo do Alerta de Cancelamento</Label>
              <p className="text-sm text-muted-foreground">
                Com que frequência o som de alerta toca quando há pedidos cancelados não confirmados.
              </p>
            </div>
            <Select
              value={String(kdsSettings.cancellationAlertInterval || 3)}
              onValueChange={(value) => updateKdsSettings({ cancellationAlertInterval: Number(value) })}
              disabled={!(kdsSettings.cancellationAlertsEnabled ?? true)}
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
      </CardContent>
    </Card>
  );
}
