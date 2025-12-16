import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageUpload } from '@/components/ImageUpload';
import { Package } from 'lucide-react';
import { ComplementOption } from '@/hooks/useComplementOptions';
import { ComplementGroup } from '@/hooks/useComplementGroups';

interface ComplementOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: Partial<ComplementOption> | null;
  linkedGroups: ComplementGroup[];
  onSave: (option: Partial<ComplementOption>) => void;
  isEditing: boolean;
}

export function ComplementOptionDialog({
  open,
  onOpenChange,
  option,
  linkedGroups,
  onSave,
  isEditing
}: ComplementOptionDialogProps) {
  const [form, setForm] = React.useState<Partial<ComplementOption>>({
    name: '',
    description: '',
    image_url: null,
    price: 0,
    cost_price: 0,
    internal_code: '',
    pdv_code: '',
    auto_calculate_cost: false,
    enable_stock_control: false,
    is_active: true,
  });

  React.useEffect(() => {
    if (option) {
      setForm({
        name: option.name || '',
        description: option.description || '',
        image_url: option.image_url || null,
        price: option.price ?? 0,
        cost_price: option.cost_price ?? 0,
        internal_code: option.internal_code || '',
        pdv_code: option.pdv_code || '',
        auto_calculate_cost: option.auto_calculate_cost ?? false,
        enable_stock_control: option.enable_stock_control ?? false,
        is_active: option.is_active ?? true,
      });
    } else {
      setForm({
        name: '',
        description: '',
        image_url: null,
        price: 0,
        cost_price: 0,
        internal_code: '',
        pdv_code: '',
        auto_calculate_cost: false,
        enable_stock_control: false,
        is_active: true,
      });
    }
  }, [option, open]);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Opção' : 'Nova Opção'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Main Form */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Image */}
              <div className="space-y-4">
                <Label>Imagem da Opção</Label>
                <div className="aspect-square">
                  <ImageUpload
                    value={form.image_url || undefined}
                    onChange={(url) => setForm({ ...form, image_url: url || null })}
                    folder="complement-options"
                  />
                </div>
              </div>

              {/* Right Column - Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Opção *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Bacon Extra"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Código Interno</Label>
                    <Input
                      value={form.internal_code || ''}
                      onChange={(e) => setForm({ ...form, internal_code: e.target.value })}
                      placeholder="INT001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código PDV</Label>
                    <Input
                      value={form.pdv_code || ''}
                      onChange={(e) => setForm({ ...form, pdv_code: e.target.value })}
                      placeholder="PDV001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço de Custo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.cost_price ?? 0}
                      onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preço de Venda</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.price ?? 0}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição da opção (suporta *negrito* e _itálico_)"
                    rows={3}
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Calcular preço de custo automaticamente</p>
                      <p className="text-xs text-muted-foreground">Baseado na ficha técnica</p>
                    </div>
                    <Switch
                      checked={form.auto_calculate_cost ?? false}
                      onCheckedChange={(checked) => setForm({ ...form, auto_calculate_cost: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Ativar controle de estoque</p>
                      <p className="text-xs text-muted-foreground">Monitorar quantidade disponível</p>
                    </div>
                    <Switch
                      checked={form.enable_stock_control ?? false}
                      onCheckedChange={(checked) => setForm({ ...form, enable_stock_control: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Opção ativa</p>
                      <p className="text-xs text-muted-foreground">Disponível para seleção</p>
                    </div>
                    <Switch
                      checked={form.is_active ?? true}
                      onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Linked Groups */}
          <div className="w-56 border-l pl-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              <span className="font-semibold text-sm">{linkedGroups.length} complemento(s)</span>
            </div>
            
            <p className="text-xs text-muted-foreground mb-3">
              Esta opção está vinculada aos seguintes grupos de complemento:
            </p>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {linkedGroups.length > 0 ? (
                  linkedGroups.map(group => (
                    <div key={group.id} className="p-2 text-sm border rounded bg-muted/50">
                      {group.name}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Não vinculada a nenhum complemento
                  </p>
                )}
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
