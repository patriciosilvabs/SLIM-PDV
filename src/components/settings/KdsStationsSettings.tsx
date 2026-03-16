import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKdsStations, KdsStation, STATION_TYPE_LABELS, StationType } from '@/hooks/useKdsStations';
import { backendClient } from '@/integrations/backend/client';
import { useTenant } from '@/hooks/useTenant';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Factory, Plus, Pencil, Trash2, GripVertical, Circle, Layers, Flame, ChefHat, Tablet } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STATION_ICONS = [
  { value: 'Circle', icon: Circle, label: 'Círculo' },
  { value: 'Layers', icon: Layers, label: 'Camadas' },
  { value: 'Flame', icon: Flame, label: 'Chama' },
  { value: 'ChefHat', icon: ChefHat, label: 'Chef' },
];

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];
const KDS_STATION_DRAFT_KEY = 'kdsStationDraft';

interface StationFormData {
  name: string;
  station_type: StationType;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
}

interface StationDevice {
  id: string;
  device_id: string;
  name: string;
  station_id: string | null;
  last_seen_at: string;
  is_active: boolean;
}

const defaultFormData: StationFormData = {
  name: '',
  station_type: 'custom',
  description: '',
  color: '#3B82F6',
  icon: 'ChefHat',
  is_active: true,
};

function SortableStation({
  station,
  IconComponent,
  linkedDeviceCount,
  onEdit,
  onDelete,
  onToggle,
  onManageDevices,
}: {
  station: KdsStation;
  IconComponent: React.ElementType;
  linkedDeviceCount: number;
  onEdit: (station: KdsStation) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, is_active: boolean) => void;
  onManageDevices: (station: KdsStation) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: station.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-opacity ${
        station.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
      }`}
    >
      <GripVertical
        {...attributes}
        {...listeners}
        className="h-4 w-4 text-muted-foreground cursor-grab"
      />

      <div
        className="h-8 w-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: station.color + '20' }}
      >
        <IconComponent className="h-4 w-4" style={{ color: station.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{station.name}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {STATION_TYPE_LABELS[station.station_type as StationType] || station.station_type}
          </span>
        </div>
        {station.description && (
          <p className="text-sm text-muted-foreground truncate">{station.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {linkedDeviceCount === 0
            ? 'Nenhum dispositivo vinculado'
            : `${linkedDeviceCount} dispositivo${linkedDeviceCount === 1 ? '' : 's'} vinculado${linkedDeviceCount === 1 ? '' : 's'}`}
        </p>
      </div>

      <Switch
        checked={station.is_active}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(is_active) => onToggle(station.id, is_active)}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onManageDevices(station);
        }}
        title="Vincular dispositivos"
      >
        <Tablet className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onEdit(station);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(station.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function KdsStationsSettings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { stations, isLoading, createStation, updateStation, deleteStation, toggleStationActive, reorderStations } = useKdsStations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<KdsStation | null>(null);
  const [formData, setFormData] = useState<StationFormData>(defaultFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bindingStation, setBindingStation] = useState<KdsStation | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ['kds-station-devices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as StationDevice[];
      const { data, error } = await backendClient.functions.invoke('kds-data', {
        body: {
          action: 'list_devices',
          tenant_id: tenantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.devices ?? []) as StationDevice[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30,
  });

  const setDeviceStation = useMutation({
    mutationFn: async ({ deviceId, stationId }: { deviceId: string; stationId: string | null }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data, error } = await backendClient.functions.invoke('kds-data', {
        body: {
          action: 'set_device_station',
          tenant_id: tenantId,
          device_id: deviceId,
          station_id: stationId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kds-station-devices', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['kds-devices-all', tenantId] });
      const bindingLabel = variables.stationId ? 'Dispositivo vinculado ao setor' : 'Dispositivo desvinculado do setor';
      toast.success(bindingLabel);
      if (variables.stationId) {
        setSelectedDeviceId('');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar vinculo: ${error.message}`);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!dialogOpen || editingStation) return;

    window.localStorage.setItem(KDS_STATION_DRAFT_KEY, JSON.stringify(formData));
  }, [dialogOpen, editingStation, formData]);

  const loadDraftFormData = () => {
    if (typeof window === 'undefined') return defaultFormData;

    const rawDraft = window.localStorage.getItem(KDS_STATION_DRAFT_KEY);
    if (!rawDraft) return defaultFormData;

    try {
      return { ...defaultFormData, ...JSON.parse(rawDraft) } as StationFormData;
    } catch {
      return defaultFormData;
    }
  };

  const clearDraftFormData = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(KDS_STATION_DRAFT_KEY);
  };

  const stationNameById = useMemo(
    () => new Map(stations.map((station) => [station.id, station.name])),
    [stations]
  );

  const boundDevices = useMemo(() => {
    if (!bindingStation) return [] as StationDevice[];
    return devices.filter((device) => device.station_id === bindingStation.id);
  }, [bindingStation, devices]);

  const selectableDevices = useMemo(() => {
    if (!bindingStation) return [] as StationDevice[];

    return [...devices]
      .filter((device) => device.station_id !== bindingStation.id)
      .sort((left, right) => {
        const leftUnassigned = left.station_id ? 1 : 0;
        const rightUnassigned = right.station_id ? 1 : 0;
        if (leftUnassigned !== rightUnassigned) return leftUnassigned - rightUnassigned;
        return left.name.localeCompare(right.name);
      });
  }, [bindingStation, devices]);

  const openBindingsDialog = (station: KdsStation) => {
    setBindingStation(station);
    setSelectedDeviceId('');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = stations.findIndex((s) => s.id === active.id);
      const newIndex = stations.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(stations, oldIndex, newIndex);
      reorderStations.mutate(newOrder.map((s) => s.id));
    }
  };

  const openNewDialog = () => {
    setEditingStation(null);
    setFormData(loadDraftFormData());
    setDialogOpen(true);
  };

  const openEditDialog = (station: KdsStation) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      station_type: station.station_type as StationType,
      description: station.description || '',
      color: station.color,
      icon: station.icon,
      is_active: station.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const normalizedName = formData.name.trim();
    if (!normalizedName) return;

    const payload = {
      ...formData,
      name: normalizedName,
      description: formData.description.trim() || null,
    };

    try {
      if (editingStation) {
        await updateStation.mutateAsync({
          id: editingStation.id,
          ...payload,
        });
      } else {
        await createStation.mutateAsync({
          ...payload,
          sort_order: stations.length,
        });
      }

      clearDraftFormData();
      setDialogOpen(false);
      setEditingStation(null);
      setFormData(defaultFormData);
    } catch {
      // Error feedback is handled by the mutation toast; keep the dialog open.
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStation.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      // Keep the dialog open so the user can see the error toast and try again.
    }
  };

  const getIconComponent = (iconName: string) => {
    const found = STATION_ICONS.find((i) => i.value === iconName);
    return found ? found.icon : ChefHat;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Setores de Producao
              </CardTitle>
              <CardDescription>
                Configure as etapas do fluxo. Os dispositivos operam dentro de um setor.
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo Setor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : stations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum setor configurado. Clique em "Novo Setor" para comecar.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stations.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stations.map((station) => {
                    const Icon = getIconComponent(station.icon);
                    return (
                      <SortableStation
                        key={station.id}
                        station={station}
                        IconComponent={Icon}
                        linkedDeviceCount={devices.filter((device) => device.station_id === station.id).length}
                        onEdit={openEditDialog}
                        onDelete={setDeleteConfirmId}
                        onToggle={(id, is_active) => toggleStationActive.mutate({ id, is_active })}
                        onManageDevices={openBindingsDialog}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criar/editar setor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStation ? 'Editar Setor' : 'Novo Setor'}
            </DialogTitle>
            <DialogDescription>
              Configure o nome, tipo e visual do setor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Forno Principal"
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.station_type}
                onValueChange={(value) => setFormData({ ...formData, station_type: value as StationType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao do setor"
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Ícone</Label>
              <div className="flex gap-2 mt-1">
                {STATION_ICONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: value })}
                    className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                      formData.icon === value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={label}
                  >
                    <Icon className="h-5 w-5" style={{ color: formData.color }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name.trim() || createStation.isPending || updateStation.isPending}
            >
              {editingStation ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bindingStation} onOpenChange={() => setBindingStation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Dispositivos</DialogTitle>
            <DialogDescription>
              Crie primeiro o dispositivo. Depois, vincule ou desvincule os dispositivos deste setor aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Setor</Label>
              <div className="mt-2 rounded-md border p-3 text-sm font-medium">
                {bindingStation?.name ?? '-'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dispositivos vinculados</Label>
              {isLoadingDevices ? (
                <p className="text-sm text-muted-foreground">Carregando dispositivos...</p>
              ) : boundDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dispositivo vinculado a este setor.</p>
              ) : (
                <div className="space-y-2">
                  {boundDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.is_active === false ? 'Inativo' : 'Ativo'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeviceStation.mutate({ deviceId: device.id, stationId: null })}
                        disabled={setDeviceStation.isPending}
                      >
                        Desvincular
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vincular dispositivo</Label>
              <Select value={selectedDeviceId || 'none'} onValueChange={(value) => setSelectedDeviceId(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione um dispositivo</SelectItem>
                  {selectableDevices.map((device) => {
                    const currentStationName = device.station_id ? stationNameById.get(device.station_id) : null;
                    const suffix = currentStationName ? ` - atualmente em ${currentStationName}` : ' - sem setor';
                    return (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name + suffix}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se o dispositivo ja estiver vinculado a outro setor, ele sera movido para este.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBindingStation(null)}>
              Fechar
            </Button>
            <Button
              onClick={() =>
                bindingStation &&
                selectedDeviceId &&
                setDeviceStation.mutate({ deviceId: selectedDeviceId, stationId: bindingStation.id })
              }
              disabled={!bindingStation || !selectedDeviceId || setDeviceStation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Setor</DialogTitle>
            <DialogDescription>
              O setor sera removido e os itens ativos serao redistribuidos quando houver outro setor compativel.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir este setor? Esta acao nao pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteStation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
