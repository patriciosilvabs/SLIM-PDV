import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Pizza } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface PizzaFlavorCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productPrice: number;
  maxFlavors: number;
  onSelect: (flavorCount: number) => void;
}

export function PizzaFlavorCountDialog({
  open,
  onOpenChange,
  productName,
  productPrice,
  maxFlavors,
  onSelect,
}: PizzaFlavorCountDialogProps) {
  const options = Array.from({ length: maxFlavors }, (_, i) => i + 1);

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
          {options.map((count) => (
            <Card
              key={count}
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => {
                onSelect(count);
                onOpenChange(false);
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="relative">
                  <Pizza className="h-12 w-12 text-primary" />
                  {count > 1 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[1px] h-full bg-primary rotate-45" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {count === 1 ? '1 Sabor' : `${count} Sabores`}
                  </p>
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
