import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKdsDevice, KdsDevice } from '@/hooks/useKdsDevice';
import { useKdsStations } from '@/hooks/useKdsStations';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Monitor, 
  Pencil, 
  Trash2, 
  Circle, 
  Wifi, 
  WifiOff, 
  Clock, 
  Tablet,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function isDeviceOnline(lastSeenAt: string): boolean {
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  return diffMinutes < 3; // Online se visto nos últimos 3 minutos
}

export function KdsDevicesSettings() {
  const { allDevices, device: currentDevice } = useKdsDevice();
  const { activeStations } = useKdsStations();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [editingDevice, setEditingDevice] = useState<KdsDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editStationId, setEditStationId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const updateDeviceMutation = useMutation({
    mutationFn: async ({ id, name, station_id }: { id: string; name: string; station_id: string | null }) => {
      const { error } = await supabase
        .from('kds_devices')
        .update({ name, station_id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all'] });
      toast.success('Dispositivo atualizado');
      setEditingDevice(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kds_devices')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all'] });
      toast.success('Dispositivo removido');
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  const openEdit = (device: KdsDevice) => {
    setEditingDevice(device);
    setEditName(device.name);
    setEditStationId(device.station_id);
  };

  const handleSaveEdit = () => {
    if (!editingDevice || !editName.trim()) return;
    updateDeviceMutation.mutate({
      id: editingDevice.id,
      name: editName,
      station_id: editStationId,
    });
  };

  const getStationInfo = (stationId: string | null) => {
    if (!stationId) return null;
    return activeStations.find(s => s.id === stationId);
  };

  const onlineDevices = allDevices.filter(d => isDeviceOnline(d.last_seen_at));
  const offlineDevices = allDevices.filter(d => !isDeviceOnline(d.last_seen_at));

  return (
    <>
      <div className="space-y-6">
        {/* Resumo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tablet className="h-5 w-5" />
              Dispositivos KDS
            </CardTitle>
            <CardDescription>
              Gerencie os tablets e dispositivos conectados ao KDS. Dispositivos se registram automaticamente ao acessar a tela do KDS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{allDevices.length}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">{onlineDevices.length}</div>
                <div className="text-xs text-muted-foreground">Online</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-muted-foreground">{offlineDevices.length}</div>
                <div className="text-xs text-muted-foreground">Offline</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de dispositivos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dispositivos Registrados</CardTitle>
              <p className="text-xs text-muted-foreground">
                Novos dispositivos aparecem automaticamente ao abrir o KDS
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {allDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum dispositivo registrado</p>
                <p className="text-sm mt-1">
                  Abra a tela do KDS em um tablet ou computador para registrá-lo automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Online first, then offline */}
                {[...onlineDevices, ...offlineDevices].map((dev) => {
                  const online = isDeviceOnline(dev.last_seen_at);
                  const station = getStationInfo(dev.station_id);
                  const isCurrentDevice = currentDevice?.id === dev.id;

                  return (
                    <div
                      key={dev.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                        online ? "bg-card" : "bg-muted/30 opacity-70",
                        isCurrentDevice && "ring-2 ring-primary/30"
                      )}
                    >
                      {/* Status indicator */}
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        online ? "bg-green-500/10" : "bg-muted"
                      )}>
                        {online ? (
                          <Wifi className="h-5 w-5 text-green-600" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{dev.name}</span>
                          {isCurrentDevice && (
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              Este dispositivo
                            </Badge>
                          )}
                          <Badge variant={online ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                            {online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {station ? (
                            <span className="flex items-center gap-1">
                              <Circle className="h-2.5 w-2.5" style={{ color: station.color, fill: station.color }} />
                              {station.name}
                            </span>
                          ) : (
                            <span className="text-amber-600">Sem praça atribuída</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(dev.last_seen_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          ID: {dev.device_id.slice(0, 8)}...
                        </p>
                      </div>

                      {/* Actions */}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(dev)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!isCurrentDevice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(dev.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mapa de praças e dispositivos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapa de Praças × Dispositivos</CardTitle>
            <CardDescription>
              Visualize quais dispositivos estão atribuídos a cada praça
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeStations.map((station) => {
                const assignedDevices = allDevices.filter(d => d.station_id === station.id);
                const onlineCount = assignedDevices.filter(d => isDeviceOnline(d.last_seen_at)).length;

                return (
                  <div
                    key={station.id}
                    className="p-3 rounded-lg border"
                    style={{ borderColor: station.color + '40' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Circle className="h-3 w-3" style={{ color: station.color, fill: station.color }} />
                      <span className="font-medium text-sm">{station.name}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {assignedDevices.length} dispositivo{assignedDevices.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {assignedDevices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum dispositivo atribuído</p>
                    ) : (
                      <div className="space-y-1">
                        {assignedDevices.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            <div className={cn(
                              "h-2 w-2 rounded-full",
                              isDeviceOnline(d.last_seen_at) ? "bg-green-500" : "bg-muted-foreground"
                            )} />
                            <span className="truncate">{d.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Sem praça */}
              {(() => {
                const unassigned = allDevices.filter(d => !d.station_id);
                if (unassigned.length === 0) return null;
                return (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Circle className="h-3 w-3 text-amber-500" />
                      <span className="font-medium text-sm text-amber-700">Sem Praça</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {unassigned.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {unassigned.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            isDeviceOnline(d.last_seen_at) ? "bg-green-500" : "bg-muted-foreground"
                          )} />
                          <span className="truncate">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de edição */}
      <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Tablet Cozinha 1"
              />
            </div>
            <div>
              <Label>Praça Atribuída</Label>
              <Select
                value={editStationId || 'none'}
                onValueChange={(v) => setEditStationId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma praça" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-muted-foreground" />
                      Nenhuma (ver todas)
                    </div>
                  </SelectItem>
                  {activeStations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      <div className="flex items-center gap-2">
                        <Circle className="h-3 w-3" style={{ color: station.color, fill: station.color }} />
                        {station.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDevice(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || updateDeviceMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Dispositivo</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja remover este dispositivo? Ele será registrado novamente automaticamente se acessar o KDS.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteDeviceMutation.mutate(deleteConfirmId)}
              disabled={deleteDeviceMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
