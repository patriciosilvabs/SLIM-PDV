import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/components/order/AddOrderItemsModal';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface CartItemListProps {
  items: CartItem[];
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity?: (itemId: string, delta: number) => void;
  onDuplicateItem?: (itemId: string) => void;
  duplicateItems?: boolean;
  showQuantityControls?: boolean;
  compact?: boolean;
  maxHeight?: string;
  className?: string;
}

export function CartItemList({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onDuplicateItem,
  duplicateItems = false,
  showQuantityControls = true,
  compact = false,
  maxHeight = 'flex-1',
  className,
}: CartItemListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("p-8 text-center text-muted-foreground", className)}>
        <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Adicione itens ao pedido</p>
      </div>
    );
  }

  const handleIncrement = (itemId: string) => {
    if (duplicateItems && onDuplicateItem) {
      onDuplicateItem(itemId);
    } else if (onUpdateQuantity) {
      onUpdateQuantity(itemId, 1);
    }
  };

  const handleDecrement = (itemId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      onRemoveItem(itemId);
    } else if (onUpdateQuantity) {
      onUpdateQuantity(itemId, -1);
    }
  };

  return (
    <ScrollArea className={cn(maxHeight, className)}>
      <div className={cn("space-y-2", compact ? "p-2" : "p-3")}>
        {items.map(item => (
          <div 
            key={item.id} 
            className={cn(
              "bg-background rounded-lg border space-y-2",
              compact ? "p-2" : "p-3"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
                  {item.product_name}
                </p>
                {item.variation_name && (
                  <p className="text-xs text-muted-foreground">{item.variation_name}</p>
                )}
                {item.combo_name && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    {item.combo_name}
                  </Badge>
                )}
                {item.complements.length > 0 && (
                  <div className="mt-1">
                    {item.complements.map((c, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        + {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.option_name}
                      </p>
                    ))}
                  </div>
                )}
                {item.subItems && item.subItems.length > 0 && (
                  <div className="mt-1 border-l-2 border-muted pl-2">
                    {item.subItems.map((subItem, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <span className="font-medium">Pizza {subItem.sub_item_index + 1}:</span>
                        {subItem.complements.map((c, i) => (
                          <span key={i}> {c.option_name}{i < subItem.complements.length - 1 ? ',' : ''}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    "{item.notes}"
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "text-muted-foreground hover:text-destructive",
                  compact ? "h-5 w-5" : "h-6 w-6"
                )}
                onClick={() => onRemoveItem(item.id)}
              >
                <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              {showQuantityControls ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className={compact ? "h-5 w-5" : "h-6 w-6"}
                    onClick={() => handleDecrement(item.id, item.quantity)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className={cn("w-6 text-center", compact ? "text-xs" : "text-sm")}>
                    {item.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className={compact ? "h-5 w-5" : "h-6 w-6"}
                    onClick={() => handleIncrement(item.id)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  x{item.quantity}
                </span>
              )}
              <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
                {formatCurrency(item.total_price)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function CartSummary({ 
  items, 
  className 
}: { 
  items: CartItem[]; 
  className?: string;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={cn("flex items-center justify-between text-lg font-bold", className)}>
      <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
      <span className="text-primary">{formatCurrency(subtotal)}</span>
    </div>
  );
}
