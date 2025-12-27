import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Send, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { CartItemList } from './CartItemList';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface PendingCartPanelProps {
  items: CartItem[];
  tableNumber?: number;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onDuplicateItem: (itemId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  duplicateItems?: boolean;
  className?: string;
}

export function PendingCartPanel({
  items,
  tableNumber,
  onRemoveItem,
  onUpdateQuantity,
  onDuplicateItem,
  onConfirm,
  onCancel,
  isSubmitting = false,
  duplicateItems = false,
  className,
}: PendingCartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={cn("flex flex-col h-full bg-muted/20", className)}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">
            {tableNumber ? `Mesa ${tableNumber}` : 'Carrinho'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Badge>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-hidden">
        <CartItemList
          items={items}
          onRemoveItem={onRemoveItem}
          onUpdateQuantity={onUpdateQuantity}
          onDuplicateItem={onDuplicateItem}
          duplicateItems={duplicateItems}
          showQuantityControls={true}
          compact={true}
          maxHeight="h-full"
        />
      </div>

      {/* Footer */}
      <div className="border-t p-3 space-y-3 flex-shrink-0 bg-background">
        {/* Total */}
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button 
            className="w-full"
            size="lg"
            onClick={onConfirm}
            disabled={isSubmitting || items.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Enviando...' : 'Enviar para Cozinha'}
          </Button>
          
          {items.length > 0 && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
