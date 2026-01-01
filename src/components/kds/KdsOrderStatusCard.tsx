import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Truck, User, UtensilsCrossed, Package, Check } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useKdsSettings } from '@/hooks/useKdsSettings';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number }>;
  served_at?: string | null;
}

interface Order {
  id: string;
  status: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  created_at: string;
  ready_at?: string | null;
}

interface KdsOrderStatusCardProps {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  onFinalize: (orderId: string) => void;
  onServeItem?: (itemId: string) => void;
  isProcessing?: boolean;
}

export function KdsOrderStatusCard({
  order,
  items,
  stationColor,
  onFinalize,
  onServeItem,
  isProcessing,
}: KdsOrderStatusCardProps) {
  const { settings } = useKdsSettings();
  const compact = settings.compactMode;

  // Calcular tempo total de preparo
  const calculatePrepTime = () => {
    if (!order.ready_at) return null;
    const createdAt = new Date(order.created_at);
    const readyAt = new Date(order.ready_at);
    return differenceInMinutes(readyAt, createdAt);
  };

  const prepTimeMinutes = calculatePrepTime();

  // Determinar origem do pedido
  const getOrderOrigin = () => {
    if (order.table?.number) {
      return { icon: UtensilsCrossed, label: `MESA ${order.table.number}` };
    }
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: MapPin, label: 'BALCÃO' };
    }
    return { icon: User, label: order.customer_name || 'CLIENTE' };
  };

  const origin = getOrderOrigin();
  const OriginIcon = origin.icon;

  // Contar itens servidos
  const servedCount = items.filter(item => item.served_at).length;
  const totalCount = items.length;
  const allServed = servedCount === totalCount;

  return (
    <Card 
      className={cn(
        "overflow-hidden border-2 transition-all duration-300 opacity-90",
        compact ? "text-sm" : "",
        "bg-muted/30"
      )}
      style={{ borderColor: stationColor + '40' }}
    >
      <CardHeader 
        className={cn(
          "py-3 px-4 flex flex-row items-center justify-between space-y-0",
          compact && "py-2 px-3"
        )}
        style={{ backgroundColor: stationColor + '15' }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 
            className={cn("h-5 w-5 fill-current", compact && "h-4 w-4")} 
            style={{ color: stationColor }} 
          />
          <div className="flex items-center gap-2">
            <OriginIcon className={cn("h-4 w-4 text-muted-foreground", compact && "h-3 w-3")} />
            <span className={cn("font-bold", compact && "text-sm")} style={{ color: stationColor }}>
              {origin.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            className={cn("text-xs font-semibold", compact && "text-[10px] px-1.5")}
            style={{ backgroundColor: stationColor, color: 'white' }}
          >
            {servedCount}/{totalCount} servidos
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("font-mono", compact && "text-xs")}
          >
            #{order.id.slice(-4).toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={cn("p-4 space-y-3", compact && "p-3 space-y-2")}>
        {/* Tempo total de preparo */}
        {prepTimeMinutes !== null && (
          <div 
            className={cn(
              "flex items-center justify-center gap-2 py-2 rounded-lg",
              compact && "py-1.5"
            )}
            style={{ backgroundColor: stationColor + '20' }}
          >
            <Clock className={cn("h-4 w-4", compact && "h-3 w-3")} style={{ color: stationColor }} />
            <span className={cn("font-bold text-base", compact && "text-sm")} style={{ color: stationColor }}>
              {prepTimeMinutes} min
            </span>
            <span className={cn("text-muted-foreground text-xs", compact && "text-[10px]")}>
              preparo
            </span>
          </div>
        )}

        {/* Tempo desde que ficou pronto */}
        {order.ready_at && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" style={{ color: stationColor }} />
            <span>Pronto há {formatDistanceToNow(new Date(order.ready_at), { locale: ptBR })}</span>
          </div>
        )}

        {/* Lista de itens individuais */}
        <div className={cn("border-t border-border/50 pt-3 space-y-2", compact && "pt-2 space-y-1.5")}>
          {items.map((item) => (
            <div 
              key={item.id}
              className={cn(
                "flex items-center justify-between gap-2 p-2 rounded-lg border",
                item.served_at 
                  ? "bg-green-500/10 border-green-500/30" 
                  : "bg-background/50 border-border/50",
                compact && "p-1.5"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className={cn("flex items-center gap-1.5", compact && "gap-1")}>
                  <Badge variant="secondary" className={cn("text-xs shrink-0", compact && "text-[10px] px-1")}>
                    x{item.quantity}
                  </Badge>
                  <span className={cn(
                    "font-medium truncate text-sm",
                    compact && "text-xs",
                    item.served_at && "text-green-700 dark:text-green-400"
                  )}>
                    {item.product?.name || 'Item'}
                  </span>
                </div>
                {item.variation && (
                  <span className={cn("text-xs text-muted-foreground ml-6", compact && "text-[10px] ml-5")}>
                    {item.variation.name}
                  </span>
                )}
              </div>

              {item.served_at ? (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-green-600 border-green-500/50 bg-green-500/10 shrink-0",
                    compact && "text-[10px] px-1.5"
                  )}
                >
                  <Check className={cn("h-3 w-3 mr-1", compact && "h-2.5 w-2.5")} />
                  {format(new Date(item.served_at), 'HH:mm')}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onServeItem?.(item.id)}
                  disabled={isProcessing}
                  className={cn(
                    "shrink-0 h-7 px-2 text-xs",
                    compact && "h-6 px-1.5 text-[10px]"
                  )}
                  style={{ borderColor: stationColor, color: stationColor }}
                >
                  Servir
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Nome do cliente se houver */}
        {order.customer_name && !order.table && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{order.customer_name}</span>
          </div>
        )}

        {/* Botão finalizar pedido */}
        <Button
          size={compact ? "sm" : "default"}
          onClick={() => onFinalize(order.id)}
          disabled={isProcessing || !allServed}
          className={cn(
            "w-full",
            compact && "h-8 text-xs",
            !allServed && "opacity-50"
          )}
          style={{ backgroundColor: allServed ? stationColor : undefined }}
          variant={allServed ? "default" : "outline"}
        >
          <Package className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
          {allServed ? 'Finalizar Pedido' : `Servir ${totalCount - servedCount} itens restantes`}
        </Button>
      </CardContent>
    </Card>
  );
}
