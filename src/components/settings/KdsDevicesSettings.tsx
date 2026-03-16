import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKdsDevice, KdsDevice } from '@/hooks/useKdsDevice';
import { useKdsStations } from '@/hooks/useKdsStations';
import { backendClient } from '@/integrations/backend/client';
import { deactivateKdsDevice, updateKdsDevice } from '@/lib/firebaseTenantCrud';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Monitor, 
  Pencil, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Clock, 
  Tablet,
  Plus,
  KeyRound,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function isDeviceOnline(lastSeenAt: string): boolean {
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  return diffMs < 30 * 1000;
}

export function KdsDevicesSettings() {
  const { allDevices, device: currentDevice, clearCurrentDeviceRegistration } = useKdsDevice();
  const { stations } = useKdsStations();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [editingDevice, setEditingDevice] = useState<KdsDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // New device registration
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');

  // Show codes dialog
  const [showCodesDialog, setShowCodesDialog] = useState(false);
  const [codesData, setCodesData] = useState<{ verification_code: string; auth_code: string; deviceName: string } | null>(null);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);

  // Inline codes visibility per device
  const [visibleCodesDeviceId, setVisibleCodesDeviceId] = useState<string | null>(null);
  const [inlineCodes, setInlineCodes] = useState<Record<string, { verification_code: string; auth_code: string }>>({});

  const createDeviceMutation = useMutation({
    mutationFn: async (params: { name: string }) => {
      const { data, error } = await backendClient.functions.invoke('kds-device-auth', {
        body: {
          action: 'register',
          name: params.name,
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all'] });
      setShowCreateDialog(false);
      setNewName('');
      // Show codes dialog
      setCodesData({
        verification_code: data.verification_code,
        auth_code: data.auth_code,
        deviceName: data.device.name,
      });
      setShowCodesDialog(true);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cadastrar dispositivo');
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: async ({
      id,
      name,
    }: {
      id: string;
      name: string;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateKdsDevice(tenantId, id, {
        name,
      });
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
    mutationFn: async ({ id }: { id: string; isCurrentDevice: boolean }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deactivateKdsDevice(tenantId, id);
    },
    onSuccess: (_, variables) => {
      if (variables.isCurrentDevice) {
        clearCurrentDeviceRegistration();
      }
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all'] });
      toast.success('Dispositivo removido');
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  const regenerateCodesMutation = useMutation({
    mutationFn: async (device_id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data, error } = await backendClient.functions.invoke('kds-device-auth', {
        body: { action: 'regenerate_codes', device_id, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, device_id) => {
      const dev = allDevices.find(d => d.id === device_id);
      setCodesData({
        verification_code: data.verification_code,
        auth_code: data.auth_code,
        deviceName: dev?.name || 'Dispositivo',
      });
      setShowCodesDialog(true);
      toast.success('CÃ³digos regenerados com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao regenerar cÃ³digos');
    },
  });

  const handleToggleInlineCodes = async (device: KdsDevice) => {
    if (visibleCodesDeviceId === device.id) {
      setVisibleCodesDeviceId(null);
      return;
    }
    if (inlineCodes[device.id]) {
      setVisibleCodesDeviceId(device.id);
      return;
    }
    setIsLoadingCodes(true);
    try {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data, error } = await backendClient.functions.invoke('kds-device-auth', {
        body: { action: 'get_codes', device_id: device.id, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInlineCodes(prev => ({ ...prev, [device.id]: { verification_code: data.verification_code, auth_code: data.auth_code } }));
      setVisibleCodesDeviceId(device.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar cÃ³digos');
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const handleViewCodes = async (device: KdsDevice) => {
    setIsLoadingCodes(true);
    try {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data, error } = await backendClient.functions.invoke('kds-device-auth', {
        body: { action: 'get_codes', device_id: device.id, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCodesData({
        verification_code: data.verification_code,
        auth_code: data.auth_code,
        deviceName: device.name,
      });
      setShowCodesDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar cÃ³digos');
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openEdit = (device: KdsDevice) => {
    setEditingDevice(device);
    setEditName(device.name);
  };

  const handleSaveEdit = () => {
    if (!editingDevice || !editName.trim()) return;
    updateDeviceMutation.mutate({
      id: editingDevice.id,
      name: editName,
    });
  };

  const handleCreateDevice = () => {
    if (!newName.trim()) return;
    createDeviceMutation.mutate({
      name: newName,
    });
  };

  const onlineDevices = allDevices.filter((d) => isDeviceOnline(d.last_seen_at));
  const offlineDevices = allDevices.filter((d) => !isDeviceOnline(d.last_seen_at));
  const orderedDevices = allDevices;
  const stationsById = new Map(stations.map((station) => [station.id, station]));

  return (
    <>
      <div className="space-y-6">
        {/* Resumo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tablet className="h-5 w-5" />
                  Dispositivos KDS
                </CardTitle>
                <CardDescription>
                  Cadastre os terminais do KDS. O fluxo sai dos setores; cada dispositivo apenas executa o setor vinculado.
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Dispositivo
              </Button>
            </div>
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
            <CardTitle className="text-base">Dispositivos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {allDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum dispositivo cadastrado</p>
                <p className="text-sm mt-1">
                  Clique em "Novo Dispositivo" para cadastrar um tablet ou computador.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderedDevices.map((dev) => {
                  const online = isDeviceOnline(dev.last_seen_at);
                  const isCurrentDevice = currentDevice?.id === dev.id;
                  const linkedStation = dev.station_id ? stationsById.get(dev.station_id) ?? null : null;
                  const linkedStationLabel = linkedStation?.name || 'Sem setor vinculado';

                  return (
                    <div key={dev.id} className="space-y-0">
                      <div
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all",
                          online ? "bg-card" : "bg-muted/30 opacity-70",
                          isCurrentDevice && "ring-2 ring-primary/30"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          online ? "bg-green-500/10" : "bg-muted"
                        )}>
                          {online ? (
                            <Wifi className="h-5 w-5 text-green-600" />
                          ) : (
                            <WifiOff className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

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
                            <span>{linkedStationLabel}</span>
                            {dev.last_seen_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(dev.last_seen_at), { locale: ptBR, addSuffix: true })}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <Badge variant="outline">
                              Setor: {linkedStationLabel}
                            </Badge>
                          </div>
                        </div>

                        {/* Actions */}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dev)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleInlineCodes(dev)}
                          title="Ver cÃ³digos"
                          disabled={isLoadingCodes}
                        >
                          <KeyRound className={cn("h-4 w-4", visibleCodesDeviceId === dev.id && "text-primary")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(dev.id)}
                          title={isCurrentDevice ? 'Excluir este dispositivo' : 'Excluir'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Inline codes */}
                      {visibleCodesDeviceId === dev.id && inlineCodes[dev.id] && (
                        <div className="flex items-center gap-4 px-3 py-2 ml-13 text-sm border border-t-0 rounded-b-lg bg-muted/20">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Verificador:</span>
                            <span className="font-mono font-bold tracking-wider">{inlineCodes[dev.id].verification_code}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(inlineCodes[dev.id].verification_code, 'CÃ³digo verificador')}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">AutenticaÃ§Ã£o:</span>
                            <span className="font-mono font-bold tracking-wider">{inlineCodes[dev.id].auth_code}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(inlineCodes[dev.id].auth_code, 'CÃ³digo de autenticaÃ§Ã£o')}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1 ml-auto"
                            onClick={() => {
                              regenerateCodesMutation.mutate(dev.id);
                              // Clear cached codes so they get refetched
                              setInlineCodes(prev => { const copy = { ...prev }; delete copy[dev.id]; return copy; });
                              setVisibleCodesDeviceId(null);
                            }}
                            disabled={regenerateCodesMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de cadastro de novo dispositivo */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Dispositivo</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Tablet Cozinha 1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Os codigos de acesso serao gerados automaticamente apos o cadastro. Depois, vincule o dispositivo ao setor correto em <strong>Setores</strong>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateDevice}
              disabled={!newName.trim() || createDeviceMutation.isPending}
            >
              {createDeviceMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de cÃ³digos */}
      <Dialog open={showCodesDialog} onOpenChange={setShowCodesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CÃ³digos de Acesso â€” {codesData?.deviceName}</DialogTitle>
          </DialogHeader>
          {codesData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Anote estes cÃ³digos. Eles serÃ£o necessÃ¡rios para conectar o dispositivo ao KDS.
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">CÃ³digo Verificador</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => copyToClipboard(codesData.verification_code, 'CÃ³digo verificador')}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <div className="text-3xl font-mono font-bold tracking-[0.3em] text-center">
                    {codesData.verification_code}
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">CÃ³digo de AutenticaÃ§Ã£o</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => copyToClipboard(codesData.auth_code, 'CÃ³digo de autenticaÃ§Ã£o')}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <div className="text-3xl font-mono font-bold tracking-[0.3em] text-center">
                    {codesData.auth_code}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    const dev = allDevices.find(d => d.name === codesData.deviceName);
                    if (dev) regenerateCodesMutation.mutate(dev.id);
                  }}
                  disabled={regenerateCodesMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerar CÃ³digos
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCodesDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de ediÃ§Ã£o */}
      <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dispositivo</DialogTitle>
            <DialogDescription>
              Altere o nome do terminal. O setor e o fluxo sao configurados em <strong>Setores</strong>.
            </DialogDescription>
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
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              Este terminal nao define mais a etapa do fluxo. Ele so executa o setor vinculado em <strong>Setores</strong>.
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

      {/* Dialog de confirmaÃ§Ã£o de exclusÃ£o */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Dispositivo</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {currentDevice?.id === deleteConfirmId
              ? 'Tem certeza que deseja excluir este dispositivo? Este navegador sera desvinculado do KDS e nao sera registrado novamente automaticamente.'
              : 'Tem certeza que deseja remover este dispositivo? Ele nao podera mais fazer login no KDS.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId &&
                deleteDeviceMutation.mutate({
                  id: deleteConfirmId,
                  isCurrentDevice: currentDevice?.id === deleteConfirmId,
                })
              }
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






