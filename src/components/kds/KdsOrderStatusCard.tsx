import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, MapPin, Truck, User, UtensilsCrossed } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useKdsSettings } from '@/hooks/useKdsSettings';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number }>;
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
  isProcessing?: boolean;
}

export function KdsOrderStatusCard({
  order,
  items,
  stationColor,
  onFinalize,
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

  // Agrupar itens por produto
  const itemSummary = items.reduce((acc, item) => {
    const key = item.product?.name || 'Item';
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key] += item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card 
      className={cn(
        "overflow-hidden border-2 transition-all duration-300",
        compact ? "text-sm" : ""
      )}
      style={{ borderColor: stationColor + '40' }}
    >
      <CardHeader 
        className={cn(
          "py-3 px-4 flex flex-row items-center justify-between space-y-0",
          compact && "py-2 px-3"
        )}
        style={{ backgroundColor: stationColor + '10' }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle 
            className={cn("h-5 w-5", compact && "h-4 w-4")} 
            style={{ color: stationColor }} 
          />
          <div className="flex items-center gap-2">
            <OriginIcon className={cn("h-4 w-4 text-muted-foreground", compact && "h-3 w-3")} />
            <span className={cn("font-bold", compact && "text-sm")} style={{ color: stationColor }}>
              {origin.label}
            </span>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn("font-mono", compact && "text-xs")}
        >
          #{order.id.slice(-4).toUpperCase()}
        </Badge>
      </CardHeader>

      <CardContent className={cn("p-4 space-y-4", compact && "p-3 space-y-3")}>
        {/* Tempo total de preparo */}
        {prepTimeMinutes !== null && (
          <div 
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-lg",
              compact && "py-2"
            )}
            style={{ backgroundColor: stationColor + '15' }}
          >
            <Clock className={cn("h-5 w-5", compact && "h-4 w-4")} style={{ color: stationColor }} />
            <span className={cn("font-bold text-lg", compact && "text-base")} style={{ color: stationColor }}>
              {prepTimeMinutes} min
            </span>
            <span className={cn("text-muted-foreground text-sm", compact && "text-xs")}>
              tempo total
            </span>
          </div>
        )}

        {/* Tempo desde que ficou pronto */}
        {order.ready_at && (
          <div className="text-center text-sm text-muted-foreground">
            Pronto há {formatDistanceToNow(new Date(order.ready_at), { locale: ptBR })}
          </div>
        )}

        {/* Resumo dos itens */}
        <div className={cn("border-t pt-3", compact && "pt-2")}>
          <div className={cn("space-y-1", compact && "space-y-0.5")}>
            {Object.entries(itemSummary).map(([productName, qty]) => (
              <div 
                key={productName} 
                className={cn(
                  "flex items-center justify-between text-sm",
                  compact && "text-xs"
                )}
              >
                <span className="text-muted-foreground truncate max-w-[70%]">
                  {productName}
                </span>
                <Badge variant="secondary" className={cn("text-xs", compact && "text-[10px] px-1")}>
                  x{qty}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Nome do cliente se houver */}
        {order.customer_name && !order.table && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{order.customer_name}</span>
          </div>
        )}

        {/* Botão finalizar */}
        <Button
          size={compact ? "sm" : "default"}
          onClick={() => onFinalize(order.id)}
          disabled={isProcessing}
          className={cn("w-full", compact && "h-8 text-xs")}
          style={{ backgroundColor: stationColor }}
        >
          <CheckCircle className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
          Finalizar
        </Button>
      </CardContent>
    </Card>
  );
}
