import { useAudioNotification } from '@/hooks/useAudioNotification';
import { SoundSelector } from '@/components/SoundSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Bell, Volume2, Play, ShoppingBag, CalendarCheck, ChefHat, Store, Clock } from 'lucide-react';
import { SoundType } from '@/hooks/useCustomSounds';

const SOUND_EVENTS: { 
  type: SoundType; 
  icon: React.ElementType; 
  iconColor: string;
  label: string; 
  description: string 
}[] = [
  {
    type: 'newOrder',
    icon: ShoppingBag,
    iconColor: 'text-primary',
    label: 'Novo Pedido',
    description: 'Alerta quando um novo pedido é criado'
  },
  {
    type: 'newReservation',
    icon: CalendarCheck,
    iconColor: 'text-info',
    label: 'Nova Reserva',
    description: 'Alerta quando uma reserva é feita'
  },
  {
    type: 'orderReady',
    icon: ChefHat,
    iconColor: 'text-accent-foreground',
    label: 'Pedido Pronto',
    description: 'Alerta quando um pedido está pronto'
  },
  {
    type: 'kdsNewOrder',
    icon: Store,
    iconColor: 'text-orange-500',
    label: 'Novo Pedido (KDS)',
    description: 'Som específico para a tela da cozinha'
  },
  {
    type: 'tableWaitAlert',
    icon: Clock,
    iconColor: 'text-amber-500',
    label: 'Alerta de Espera de Mesa',
    description: 'Som quando mesa ultrapassa tempo limite'
  }
];

export function NotificationSettings() {
  const { settings, updateSettings, toggleSound, setSelectedSound, testSound } = useAudioNotification();

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
            {SOUND_EVENTS.map(event => {
              const Icon = event.icon;
              return (
                <div 
                  key={event.type}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <Icon className={`h-4 w-4 ${event.iconColor}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SoundSelector
                      soundType={event.type}
                      selectedSound={settings.selectedSounds[event.type]}
                      onSelect={(soundId, soundUrl) => setSelectedSound(event.type, soundId, soundUrl)}
                      disabled={!settings.enabled}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => testSound(event.type)}
                      disabled={!settings.enabled}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={settings.enabledSounds[event.type]}
                      onCheckedChange={() => toggleSound(event.type)}
                      disabled={!settings.enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
