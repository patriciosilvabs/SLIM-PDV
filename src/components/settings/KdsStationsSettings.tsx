import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKdsStations, KdsStation, STATION_TYPE_LABELS, StationType } from '@/hooks/useKdsStations';
import { Factory, Plus, Pencil, Trash2, GripVertical, Circle, Layers, Flame, ChefHat } from 'lucide-react';

const STATION_ICONS = [
  { value: 'Circle', icon: Circle, label: 'Círculo' },
  { value: 'Layers', icon: Layers, label: 'Camadas' },
  { value: 'Flame', icon: Flame, label: 'Chama' },
  { value: 'ChefHat', icon: ChefHat, label: 'Chef' },
];

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

interface StationFormData {
  name: string;
  station_type: StationType;
  description: string;
  color: string;
  icon: string;
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

export function KdsStationsSettings() {
  const { stations, isLoading, createStation, updateStation, deleteStation, toggleStationActive } = useKdsStations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<KdsStation | null>(null);
  const [formData, setFormData] = useState<StationFormData>(defaultFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openNewDialog = () => {
    setEditingStation(null);
    setFormData(defaultFormData);
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

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingStation) {
      updateStation.mutate({
        id: editingStation.id,
        ...formData,
      });
    } else {
      createStation.mutate({
        ...formData,
        sort_order: stations.length,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteStation.mutate(id);
    setDeleteConfirmId(null);
  };

  const IconComponent = (iconName: string) => {
    const found = STATION_ICONS.find(i => i.value === iconName);
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
                Praças de Produção
              </CardTitle>
              <CardDescription>
                Configure as estações de trabalho para o modo Linha de Produção
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova Praça
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : stations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma praça configurada. Clique em "Nova Praça" para começar.
            </p>
          ) : (
            <div className="space-y-2">
              {stations.map((station) => {
                const Icon = IconComponent(station.icon);
                return (
                  <div
                    key={station.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-opacity ${
                      station.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: station.color + '20' }}
                    >
                      <Icon className="h-4 w-4" style={{ color: station.color }} />
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
                    </div>

                    <Switch
                      checked={station.is_active}
                      onCheckedChange={(is_active) => toggleStationActive.mutate({ id: station.id, is_active })}
                    />

                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(station)}>
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(station.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criar/editar praça */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStation ? 'Editar Praça' : 'Nova Praça'}
            </DialogTitle>
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
                placeholder="Descrição da praça"
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

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Praça</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir esta praça? Esta ação não pode ser desfeita.
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
