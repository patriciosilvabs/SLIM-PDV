import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Clock, Store, Truck, XCircle, PackageCheck } from 'lucide-react';
import { KdsSlaIndicator } from './KdsSlaIndicator';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number; kds_category?: string }>;
}

interface Order {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  order_type: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
  order_items?: OrderItem[];
}

interface KdsReadOnlyOrderCardProps {
  order: Order;
  onMarkDelivered?: (orderId: string) => void;
  onCancel?: (order: Order) => void;
  canCancel?: boolean;
  isDelivering?: boolean;
}

// Extrair sabores dos extras usando kds_category
const getFlavors = (extras?: Array<{ extra_name: string; kds_category?: string }>): string[] => {
  if (!extras || extras.length === 0) return [];
  
  // Primeiro por kds_category
  const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
  if (flavorExtras.length > 0) {
    return flavorExtras.map(e => {
      const parts = e.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : e.extra_name;
    });
  }
  
  // Fallback: por texto
  return extras
    .filter(e => {
      const lower = e.extra_name.toLowerCase();
      return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
    })
    .map(e => {
      const parts = e.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : e.extra_name;
    });
};

export function KdsReadOnlyOrderCard({
  order,
  onMarkDelivered,
  onCancel,
  canCancel,
  isDelivering,
}: KdsReadOnlyOrderCardProps) {
  const isDelivery = order.order_type === 'delivery';
  const isTakeaway = order.order_type === 'takeaway';
  const isReady = order.status === 'ready';
  const isDelivered = order.status === 'delivered';
  
  // Mostrar botão "Marcar Entregue" apenas para pedidos de balcão que estão prontos
  const showDeliverButton = isTakeaway && isReady && onMarkDelivered;

  return (
    <Card className={cn(
      "shadow-md transition-all hover:shadow-lg",
      isDelivered && "opacity-60"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">#{order.id.slice(-4).toUpperCase()}</span>
            {isDelivery ? (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                <Truck className="h-3 w-3 mr-1" />
                Delivery
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                <Store className="h-3 w-3 mr-1" />
                Balcão
              </Badge>
            )}
          </div>
          <KdsSlaIndicator createdAt={order.created_at || ''} size="md" showBackground />
        </div>
        
        {/* Customer info */}
        {order.customer_name && (
          <p className="text-sm font-medium mb-1">{order.customer_name}</p>
        )}
        {isDelivery && order.customer_phone && (
          <p className="text-xs text-muted-foreground mb-1">{order.customer_phone}</p>
        )}
        {isDelivery && order.customer_address && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{order.customer_address}</p>
        )}
        
        {/* Items */}
        <div className="border-t border-border pt-2 mt-2">
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {order.order_items?.slice(0, 5).map((item, idx) => {
              const flavors = getFlavors(item.extras);
              
              return (
                <div key={idx} className="text-sm">
                  <p className="font-medium text-foreground">
                    {item.quantity}x {item.product?.name || 'Produto'}
                    {item.variation?.name && (
                      <span className="text-muted-foreground"> ({item.variation.name})</span>
                    )}
                  </p>
                  {/* Sabores */}
                  {flavors.length > 0 && (
                    <p className="text-xs text-blue-600 pl-2">
                      🍕 {flavors.join(' + ')}
                    </p>
                  )}
                  {/* Outros extras */}
                  {item.extras && item.extras.length > 0 && flavors.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-2">
                      {item.extras.map(e => 
                        e.extra_name.split(': ').slice(1).join(': ')
                      ).join(', ')}
                    </p>
                  )}
                  {/* Observações */}
                  {item.notes && (
                    <p className="text-xs text-amber-600 pl-2 italic">📝 {item.notes}</p>
                  )}
                </div>
              );
            })}
            {order.order_items && order.order_items.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{order.order_items.length - 5} itens...
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary text-lg">
              R$ {(order.total || 0).toFixed(2)}
            </span>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Botão Marcar Entregue - apenas para Balcão + Pronto */}
            {showDeliverButton && (
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => onMarkDelivered(order.id)}
                disabled={isDelivering}
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                {isDelivering ? 'Processando...' : 'Marcar Entregue'}
              </Button>
            )}
            
            {/* Botão Cancelar */}
            {canCancel && !isDelivered && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => onCancel(order)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar Pedido
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
