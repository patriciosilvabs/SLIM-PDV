import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { KdsBorderBadge } from './KdsBorderHighlight';
import { KdsItemCounter } from './KdsItemCounter';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { cn } from '@/lib/utils';
import { Play, CheckCircle, SkipForward, Circle, Layers, Flame, ChefHat, ArrowRight } from 'lucide-react';

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  current_station_id?: string | null;
  station_status?: string;
  station_started_at?: string | null;
  created_at: string;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number }>;
}

interface Order {
  id: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface KdsStationCardProps {
  order: Order;
  items: OrderItem[];
  stationColor: string;
  stationName: string;
  stationType: string;
  isFirstStation?: boolean;
  isLastStation?: boolean;
  onStartItem: (itemId: string) => void;
  onCompleteItem: (itemId: string) => void;
  onSkipItem?: (itemId: string) => void;
  isProcessing?: boolean;
}

const STATION_ICONS = {
  prep_start: Circle,
  assembly: Layers,
  oven_expedite: Flame,
  custom: ChefHat,
};

export function KdsStationCard({
  order,
  items,
  stationColor,
  stationName,
  stationType,
  isFirstStation,
  isLastStation,
  onStartItem,
  onCompleteItem,
  onSkipItem,
  isProcessing,
}: KdsStationCardProps) {
  const { hasSpecialBorder } = useKdsSettings();
  
  const StationIcon = STATION_ICONS[stationType as keyof typeof STATION_ICONS] || ChefHat;
  
  // Separar itens por status
  const waitingItems = items.filter(i => i.station_status === 'waiting' || !i.station_status);
  const inProgressItems = items.filter(i => i.station_status === 'in_progress');
  
  // Verificar se há borda especial
  const hasSpecialBorderInItems = items.some(item => {
    const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
    return hasSpecialBorder(itemText);
  });

  const getOrderOriginLabel = () => {
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${order.table?.number || '?'}`;
  };

  return (
    <Card className={cn(
      "shadow-md transition-all",
      hasSpecialBorderInItems && "ring-2 ring-amber-500 animate-pulse"
    )}>
      <CardHeader 
        className="pb-2 pt-3 px-4"
        style={{ borderTop: `3px solid ${stationColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="h-7 w-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: stationColor + '20' }}
            >
              <StationIcon className="h-4 w-4" style={{ color: stationColor }} />
            </div>
            <div>
              <span className="font-semibold text-sm">{stationName}</span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{getOrderOriginLabel()}</span>
                <span>•</span>
                <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <KdsSlaIndicator createdAt={order.created_at} size="sm" />
        </div>
        
        {order.customer_name && (
          <p className="text-xs text-primary font-medium mt-1">{order.customer_name}</p>
        )}
        
        <KdsItemCounter currentIndex={1} totalItems={items.length} />
      </CardHeader>
      
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Itens aguardando */}
        {waitingItems.length > 0 && (
          <div className="space-y-2">
            {waitingItems.map((item, idx) => {
              const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
              
              return (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-primary">{item.quantity}x</span>
                      <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
                      {item.variation?.name && (
                        <span className="text-xs text-muted-foreground">({item.variation.name})</span>
                      )}
                      <KdsBorderBadge text={itemText} />
                    </div>
                    {item.extras && item.extras.length > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5 truncate">
                        + {item.extras.map(e => e.extra_name.split(': ').pop()).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-orange-500 mt-0.5">📝 {item.notes}</p>
                    )}
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onStartItem(item.id)}
                    disabled={isProcessing}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Itens em progresso */}
        {inProgressItems.length > 0 && (
          <div className="space-y-2">
            {inProgressItems.map((item) => {
              const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
              
              return (
                <div 
                  key={item.id} 
                  className="p-2 rounded-lg border-2"
                  style={{ borderColor: stationColor, backgroundColor: stationColor + '10' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs">Em andamento</Badge>
                        <span className="font-bold">{item.quantity}x</span>
                        <span className="font-medium">{item.product?.name}</span>
                        <KdsBorderBadge text={itemText} />
                      </div>
                      {item.station_started_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Iniciado há {Math.floor((Date.now() - new Date(item.station_started_at).getTime()) / 60000)} min
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    {onSkipItem && !isLastStation && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onSkipItem(item.id)}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        <SkipForward className="h-3 w-3 mr-1" />
                        Pular
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      onClick={() => onCompleteItem(item.id)}
                      disabled={isProcessing}
                      className="flex-1"
                      style={{ backgroundColor: stationColor }}
                    >
                      {isLastStation ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Concluir
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Próxima
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Observações do pedido */}
        {order.notes && (
          <div className="text-xs text-orange-600 bg-orange-500/10 rounded p-2">
            <strong>Obs pedido:</strong> {order.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
