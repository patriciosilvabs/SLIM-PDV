import { useAudioNotification } from '@/hooks/useAudioNotification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Bell, Volume2, Play, ShoppingBag, CalendarCheck, ChefHat } from 'lucide-react';

export function NotificationSettings() {
  const { settings, updateSettings, toggleSound, testSound } = useAudioNotification();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Sonoras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">Ativar notificações</Label>
            <p className="text-sm text-muted-foreground">
              Sons de alerta para novos pedidos e reservas
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSettings({ enabled })}
          />
        </div>

        {/* Volume control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Label>Volume: {Math.round(settings.volume * 100)}%</Label>
          </div>
          <Slider
            value={[settings.volume * 100]}
            onValueChange={([value]) => updateSettings({ volume: value / 100 })}
            max={100}
            step={5}
            disabled={!settings.enabled}
          />
        </div>

        {/* Individual sounds */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Sons por Evento</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Novo Pedido</p>
                  <p className="text-xs text-muted-foreground">
                    Alerta quando um novo pedido é criado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => testSound('newOrder')}
                  disabled={!settings.enabled}
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Switch
                  checked={settings.enabledSounds.newOrder}
                  onCheckedChange={() => toggleSound('newOrder')}
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-info/10">
                  <CalendarCheck className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="font-medium text-sm">Nova Reserva</p>
                  <p className="text-xs text-muted-foreground">
                    Alerta quando uma reserva é feita
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => testSound('newReservation')}
                  disabled={!settings.enabled}
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Switch
                  checked={settings.enabledSounds.newReservation}
                  onCheckedChange={() => toggleSound('newReservation')}
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-accent/10">
                  <ChefHat className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pedido Pronto</p>
                  <p className="text-xs text-muted-foreground">
                    Alerta quando um pedido está pronto
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => testSound('orderReady')}
                  disabled={!settings.enabled}
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Switch
                  checked={settings.enabledSounds.orderReady}
                  onCheckedChange={() => toggleSound('orderReady')}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
