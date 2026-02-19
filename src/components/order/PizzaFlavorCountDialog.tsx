import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Pizza } from 'lucide-react';
import type { FlavorOption } from '@/hooks/useComplementGroups';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface PizzaFlavorCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productPrice: number;
  maxFlavors: number;
  flavorOptions?: FlavorOption[];
  onSelect: (flavorCount: number) => void;
}

export function PizzaFlavorCountDialog({
  open,
  onOpenChange,
  productName,
  productPrice,
  maxFlavors,
  flavorOptions,
  onSelect,
}: PizzaFlavorCountDialogProps) {
  // Use custom flavor options if provided, otherwise generate defaults
  const options: FlavorOption[] = flavorOptions && flavorOptions.length > 0
    ? flavorOptions.filter(o => o.count <= maxFlavors)
    : Array.from({ length: maxFlavors }, (_, i) => ({
        count: i + 1,
        label: i === 0 ? '1 Sabor' : `${i + 1} Sabores`,
        description: '',
      }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{productName}</DialogTitle>
          <DialogDescription className="text-center">
            Escolha o tipo de pizza
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {options.map((opt) => (
            <Card
              key={opt.count}
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => {
                onSelect(opt.count);
                onOpenChange(false);
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="relative">
                  <Pizza className="h-12 w-12 text-primary" />
                  {opt.count > 1 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[1px] h-full bg-primary rotate-45" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    A partir de {formatCurrency(productPrice)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
