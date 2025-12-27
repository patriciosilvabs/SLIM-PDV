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
          <DialogTitle>{isEditing ? 'Editar opção' : 'Nova Opção'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Left Column - Image Upload */}
          <div className="w-40 shrink-0">
            <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
              <ImageUpload
                value={form.image_url || undefined}
                onChange={(url) => setForm({ ...form, image_url: url || null })}
                folder="complement-options"
              />
            </div>
          </div>

          {/* Center Column - Form Fields */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Nome da Opção */}
            <div className="space-y-2">
              <Label>Nome da opção *</Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Portuguesa (Grande)"
              />
            </div>

            {/* Código Interno, Código PDV, Preço de custo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Código interno</Label>
                <Input
                  value={form.internal_code || ''}
                  onChange={(e) => setForm({ ...form, internal_code: e.target.value })}
                  placeholder="2375136"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Código PDV</Label>
                <Input
                  value={form.pdv_code || ''}
                  onChange={(e) => setForm({ ...form, pdv_code: e.target.value })}
                  placeholder=""
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preço de custo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.cost_price ?? 0}
                    onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do produto"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Estilize a descrição com <strong>*negrito*</strong> (*texto*), <em>itálico</em> (_texto_) ou <del>riscado</del> (~texto~).
              </p>
            </div>

            {/* Toggle - Ativar controle de estoque */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.enable_stock_control ?? false}
                onCheckedChange={(checked) => setForm({ ...form, enable_stock_control: checked })}
              />
              <Label className="font-normal">Ativar controle de estoque</Label>
            </div>
          </div>

          {/* Right Sidebar - Linked Groups */}
          <div className="w-48 shrink-0 border-l pl-4 flex flex-col">
            <ScrollArea className="flex-1">
              {linkedGroups.length > 0 ? (
                <div className="space-y-2">
                  {linkedGroups.map(group => (
                    <div key={group.id} className="p-2 text-sm border rounded bg-muted/50">
                      {group.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Package className="h-16 w-16 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum complemento usa esta opção
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCELAR
          </Button>
          <Button onClick={handleSave} disabled={!form.name?.trim()}>
            SALVAR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
