import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, GripVertical, Lock, ChevronDown, Settings2, Edit } from 'lucide-react';
import { ComplementGroup } from '@/hooks/useComplementGroups';
import { ComplementOption } from '@/hooks/useComplementOptions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ComplementGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Partial<ComplementGroup> | null;
  options: ComplementOption[];
  linkedOptionIds: string[];
  onSave: (group: Partial<ComplementGroup>, optionIds: string[]) => void;
  onCreateOption?: (option: { name: string; price: number }) => Promise<ComplementOption | undefined>;
  onEditOption?: (option: ComplementOption) => void;
  onToggleOptionActive?: (optionId: string, active: boolean) => void;
  isEditing: boolean;
}

const SELECTION_TYPES = [
  { value: 'single', label: 'Apenas uma', description: 'Cliente escolhe uma opção' },
  { value: 'multiple', label: 'Mais de uma sem repetição', description: 'Múltiplas opções diferentes' },
  { value: 'multiple_repeat', label: 'Mais de uma com repetição', description: 'Mesma opção várias vezes' },
];

const VISIBILITY_OPTIONS = [
  { value: 'visible', label: 'Visível' },
  { value: 'hidden', label: 'Oculto' },
];

const CHANNEL_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'counter', label: 'Balcão' },
  { value: 'table', label: 'Mesa' },
];

const PRICE_CALCULATION_TYPES = [
  { value: 'sum', label: 'A soma dos preços', description: 'das opções escolhidas' },
  { value: 'average', label: 'A média dos preços', description: 'das opções escolhidas' },
  { value: 'highest', label: 'O preço da opção', description: 'mais cara escolhida' },
  { value: 'lowest', label: 'O preço da opção', description: 'mais barata escolhida' },
];

interface SortableOptionProps {
  option: ComplementOption;
  onRemove: () => void;
  onEdit?: () => void;
  onToggleActive?: (active: boolean) => void;
}

function SortableOption({ option, onRemove, onEdit, onToggleActive }: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Lock className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 font-medium">{option.name}</span>
      <span className="text-sm text-muted-foreground">
        R$ {option.price.toFixed(2)}
      </span>
      <Switch 
        checked={option.is_active ?? true} 
        onCheckedChange={onToggleActive}
        disabled={!onToggleActive}
      />
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ComplementGroupDialog({
  open,
  onOpenChange,
  group,
  options,
  linkedOptionIds,
  onSave,
  onCreateOption,
  onEditOption,
  onToggleOptionActive,
  isEditing
}: ComplementGroupDialogProps) {
  const [form, setForm] = React.useState<Partial<ComplementGroup>>({
    name: '',
    description: '',
    selection_type: 'single',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    visibility: 'visible',
    channels: ['delivery', 'counter', 'table'],
    is_active: true,
    price_calculation_type: 'sum',
    applies_per_unit: false,
    unit_count: 1,
  });
  const [selectedOptionIds, setSelectedOptionIds] = React.useState<string[]>([]);
  const [localOptions, setLocalOptions] = React.useState<ComplementOption[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const [showOptionPicker, setShowOptionPicker] = React.useState(false);
  const [showNewOptionForm, setShowNewOptionForm] = React.useState(false);
  const [newOptionName, setNewOptionName] = React.useState('');
  const [newOptionPrice, setNewOptionPrice] = React.useState('');
  const [isCreatingOption, setIsCreatingOption] = React.useState(false);
  
  // Merge options from props with locally created options
  const allOptions = React.useMemo(() => {
    const optionMap = new Map<string, ComplementOption>();
    options.forEach(o => optionMap.set(o.id, o));
    localOptions.forEach(o => optionMap.set(o.id, o));
    return Array.from(optionMap.values());
  }, [options, localOptions]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (open) {
      if (group) {
        setForm({
          name: group.name || '',
          description: group.description || '',
          selection_type: group.selection_type || 'single',
          is_required: group.is_required ?? false,
          min_selections: group.min_selections ?? 0,
          max_selections: group.max_selections ?? 1,
          visibility: group.visibility || 'visible',
          channels: group.channels || ['delivery', 'counter', 'table'],
          is_active: group.is_active ?? true,
          price_calculation_type: group.price_calculation_type || 'sum',
          applies_per_unit: group.applies_per_unit ?? false,
          unit_count: group.unit_count ?? 1,
        });
        setIsAdvancedOpen(
          (group.price_calculation_type !== 'sum' && group.price_calculation_type !== null) ||
          group.applies_per_unit === true
        );
      }
      setSelectedOptionIds(linkedOptionIds);
      setLocalOptions([]);
    }
  }, [group, linkedOptionIds, open]);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave(form, selectedOptionIds);
  };

  const toggleOption = (optionId: string) => {
    setSelectedOptionIds(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const toggleChannel = (channel: string) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels?.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...(prev.channels || []), channel]
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedOptionIds(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleCreateNewOption = async () => {
    if (!newOptionName.trim() || !onCreateOption) return;
    
    setIsCreatingOption(true);
    try {
      const price = parseFloat(newOptionPrice) || 0;
      const newOption = await onCreateOption({ name: newOptionName.trim(), price });
      if (newOption) {
        // Add to local options so it appears immediately
        setLocalOptions(prev => [...prev, newOption as ComplementOption]);
        setSelectedOptionIds(prev => [...prev, newOption.id]);
        setNewOptionName('');
        setNewOptionPrice('');
        setShowNewOptionForm(false);
      }
    } finally {
      setIsCreatingOption(false);
    }
  };

  const selectedOptions = selectedOptionIds
    .map(id => allOptions.find(o => o.id === id))
    .filter((o): o is ComplementOption => !!o);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Complemento' : 'Novo Complemento'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome do Complemento</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Recheio > Borda"
            />
          </div>

          {/* Channels & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disponível nos links de</Label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map(channel => (
                  <Badge
                    key={channel.value}
                    variant={form.channels?.includes(channel.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleChannel(channel.value)}
                  >
                    {channel.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select
                value={form.visibility || 'visible'}
                onValueChange={(v) => setForm({ ...form, visibility: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Opções</Label>
              <div className="flex gap-2">
                {onCreateOption && (
                  <Button variant="outline" size="sm" onClick={() => setShowNewOptionForm(!showNewOptionForm)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Criar Opção
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowOptionPicker(!showOptionPicker)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Existente
                </Button>
              </div>
            </div>

            {/* New Option Form */}
            {showNewOptionForm && (
              <div className="border rounded-lg p-3 bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Nome da opção</Label>
                    <Input
                      placeholder="Ex: Calabresa"
                      value={newOptionName}
                      onChange={(e) => setNewOptionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newOptionPrice}
                      onChange={(e) => setNewOptionPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setShowNewOptionForm(false);
                      setNewOptionName('');
                      setNewOptionPrice('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleCreateNewOption}
                    disabled={!newOptionName.trim() || isCreatingOption}
                  >
                    {isCreatingOption ? 'Criando...' : 'Criar e Adicionar'}
                  </Button>
                </div>
              </div>
            )}

            {showOptionPicker && (
              <div className="border rounded-lg p-3 bg-muted/50 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {allOptions.filter(o => !selectedOptionIds.includes(o.id)).map(option => (
                    <div
                      key={option.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleOption(option.id)}
                    >
                      <Checkbox checked={false} />
                      <span className="text-sm">{option.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        R$ {option.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {allOptions.filter(o => !selectedOptionIds.includes(o.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Todas as opções já foram adicionadas
                  </p>
                )}
              </div>
            )}

            {/* Selected Options List with Drag and Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedOptionIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {selectedOptions.map(option => (
                    <SortableOption
                      key={option.id}
                      option={option}
                      onRemove={() => toggleOption(option.id)}
                      onEdit={onEditOption ? () => onEditOption(option) : undefined}
                      onToggleActive={onToggleOptionActive ? (active) => onToggleOptionActive(option.id, active) : undefined}
                    />
                  ))}
                  {selectedOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                      Nenhuma opção adicionada
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Selection Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">O cliente poderá escolher</Label>
            <div className="grid grid-cols-3 gap-2">
              {SELECTION_TYPES.map(type => (
                <Button
                  key={type.value}
                  type="button"
                  variant={form.selection_type === type.value ? 'default' : 'outline'}
                  className="h-auto py-3 flex flex-col items-start text-left"
                  onClick={() => setForm({ ...form, selection_type: type.value as ComplementGroup['selection_type'] })}
                >
                  <span className="font-medium">{type.label}</span>
                  <span className="text-xs opacity-70 font-normal">{type.description}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Required Toggle */}
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <Switch
              checked={form.is_required ?? false}
              onCheckedChange={(checked) => setForm({ ...form, is_required: checked })}
            />
            <div>
              <p className="font-medium">Obrigatório</p>
              <p className="text-sm text-muted-foreground">
                O cliente precisa escolher uma das opções
              </p>
            </div>
          </div>

          {/* Min/Max Selections */}
          {form.selection_type !== 'single' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mínimo de seleções</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_selections ?? 0}
                  onChange={(e) => setForm({ ...form, min_selections: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de seleções</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_selections ?? 1}
                  onChange={(e) => setForm({ ...form, max_selections: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          {/* Advanced Configuration */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span className="font-medium">Configurações avançadas</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              {/* Aplicar por unidade */}
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                <Switch
                  checked={form.applies_per_unit ?? false}
                  onCheckedChange={(checked) => setForm({ ...form, applies_per_unit: checked })}
                />
                <div className="flex-1">
                  <p className="font-medium">Aplicar por unidade</p>
                  <p className="text-sm text-muted-foreground">
                    Permite configurar cada unidade individualmente (ex: cada pizza de um combo)
                  </p>
                </div>
              </div>

              {/* Quantidade de unidades - só aparece se applies_per_unit estiver ativado */}
              {form.applies_per_unit && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                  <Label>Quantidade de unidades</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.unit_count ?? 1}
                    onChange={(e) => setForm({ ...form, unit_count: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantas unidades o cliente poderá configurar individualmente
                  </p>
                </div>
              )}

              {/* Tipo de cálculo de preço */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">O preço do complemento será:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_CALCULATION_TYPES.map(type => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={form.price_calculation_type === type.value ? 'default' : 'outline'}
                      className="h-auto py-3 flex flex-col items-start text-left"
                      onClick={() => setForm({ ...form, price_calculation_type: type.value as ComplementGroup['price_calculation_type'] })}
                    >
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs opacity-70 font-normal">{type.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.name?.trim()}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}