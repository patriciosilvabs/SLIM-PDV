import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, GripVertical, Lock, Package } from 'lucide-react';
import { ComplementGroup } from '@/hooks/useComplementGroups';
import { ComplementOption } from '@/hooks/useComplementOptions';
import { Product } from '@/hooks/useProducts';
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
  products: Product[];
  linkedOptionIds: string[];
  linkedProductIds: string[];
  onSave: (group: Partial<ComplementGroup>, optionIds: string[], productIds: string[]) => void;
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

interface SortableOptionProps {
  option: ComplementOption;
  onRemove: () => void;
}

function SortableOption({ option, onRemove }: SortableOptionProps) {
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
      <Switch checked={option.is_active ?? true} disabled />
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
  products,
  linkedOptionIds,
  linkedProductIds,
  onSave,
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
  });
  const [selectedOptionIds, setSelectedOptionIds] = React.useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [showOptionPicker, setShowOptionPicker] = React.useState(false);
  const [showProductPicker, setShowProductPicker] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
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
      });
    }
    setSelectedOptionIds(linkedOptionIds);
    setSelectedProductIds(linkedProductIds);
  }, [group, linkedOptionIds, linkedProductIds, open]);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave(form, selectedOptionIds, selectedProductIds);
  };

  const toggleOption = (optionId: string) => {
    setSelectedOptionIds(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
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

  const selectedOptions = selectedOptionIds
    .map(id => options.find(o => o.id === id))
    .filter((o): o is ComplementOption => !!o);
  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Complemento' : 'Novo Complemento'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Main Form */}
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
                <Button variant="outline" size="sm" onClick={() => setShowOptionPicker(!showOptionPicker)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Opção
                </Button>
              </div>

              {showOptionPicker && (
                <div className="border rounded-lg p-3 bg-muted/50 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {options.filter(o => !selectedOptionIds.includes(o.id)).map(option => (
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
                  {options.filter(o => !selectedOptionIds.includes(o.id)).length === 0 && (
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
          </div>

          {/* Right Sidebar - Products */}
          <div className="w-64 border-l pl-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              <span className="font-semibold">{selectedProductIds.length} produto(s)</span>
            </div>
            
            <Button variant="outline" size="sm" className="mb-3" onClick={() => setShowProductPicker(!showProductPicker)}>
              <Plus className="h-4 w-4 mr-1" />
              Vincular Produtos
            </Button>

            {showProductPicker && (
              <ScrollArea className="h-48 border rounded-lg mb-3">
                <div className="p-2 space-y-1">
                  {products.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleProduct(product.id)}
                    >
                      <Checkbox checked={selectedProductIds.includes(product.id)} />
                      <span className="text-sm truncate">{product.name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {selectedProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-2 text-sm border rounded">
                    <span className="truncate">{product.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleProduct(product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
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
