import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { KdsBorderBadge } from './KdsBorderHighlight';
import { KdsItemCounter } from './KdsItemCounter';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, Layers, Flame, ChefHat, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

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
  compact?: boolean;
}

const STATION_ICONS = {
  prep_start: Circle,
  assembly: Layers,
  oven_expedite: Flame,
  order_status: CheckCircle,
  custom: ChefHat,
};

// Extrair informação da borda dos extras
const getBorderInfo = (extras?: Array<{ extra_name: string }>): string | null => {
  if (!extras || extras.length === 0) return null;
  
  const borderExtra = extras.find(e => {
    const lower = e.extra_name.toLowerCase();
    return lower.includes('borda') || lower.includes('massa');
  });
  
  if (!borderExtra) return null;
  
  // "Massa & Borda: Borda de Chocolate" → "Borda de Chocolate"
  const parts = borderExtra.extra_name.split(':');
  return parts.length > 1 ? parts[1].trim() : borderExtra.extra_name;
};

// Extrair sabores dos extras
const getFlavors = (extras?: Array<{ extra_name: string }>): string[] => {
  if (!extras || extras.length === 0) return [];
  
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
  compact = false,
}: KdsStationCardProps) {
  const { hasSpecialBorder, settings } = useKdsSettings();
  
  const StationIcon = STATION_ICONS[stationType as keyof typeof STATION_ICONS] || ChefHat;
  
  // Separar itens por status
  const waitingItems = items.filter(i => i.station_status === 'waiting' || !i.station_status);
  const inProgressItems = items.filter(i => i.station_status === 'in_progress');
  
  // Verificar se há borda especial
  const hasSpecialBorderInItems = items.some(item => {
    const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
    return hasSpecialBorder(itemText);
  });

  // Filtrar "X pessoas" das observações se a configuração estiver desativada
  const displayOrderNotes = useMemo(() => {
    if (!order.notes) return null;
    if (settings.showPartySize) return order.notes;
    // Remover "X pessoas" ou "X pessoa" das observações
    return order.notes.replace(/\d+\s*pessoas?/gi, '').trim() || null;
  }, [order.notes, settings.showPartySize]);

  const getOrderOriginLabel = () => {
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
    return `MESA ${order.table?.number || '?'}`;
  };

  // Renderização contextual de item baseada no tipo da estação
  const renderItemContent = (item: OrderItem, isInProgress: boolean = false) => {
    const borderInfo = getBorderInfo(item.extras);
    const flavors = getFlavors(item.extras);
    const itemText = `${item.product?.name || ''} ${item.notes || ''} ${item.extras?.map(e => e.extra_name).join(' ') || ''}`;
    
    // Em preparação (prep_start): Mostra tamanho + borda PISCANDO, esconde sabores e observações
    if (stationType === 'prep_start') {
      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-primary">{item.quantity}x</span>
            <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
            {item.variation?.name && (
              <span className="text-xs text-muted-foreground">({item.variation.name})</span>
            )}
          </div>
          {/* Borda - APENAS o fundo da tarja pisca */}
          {borderInfo && (
            <div className="mt-1">
              <span className="inline-flex px-2 py-1 rounded font-bold text-sm relative overflow-hidden">
                <span className="absolute inset-0 bg-amber-500 animate-pulse"></span>
                <span className="relative z-10 text-amber-950">🟡 {borderInfo}</span>
              </span>
            </div>
          )}
          {/* NÃO mostra sabores e NÃO mostra observações na estação de início */}
        </div>
      );
    }
    
    // Produzindo (assembly): Mostra sabores + observações PISCANDO
    if (stationType === 'assembly') {
      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-primary">{item.quantity}x</span>
            <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
            {item.variation?.name && (
              <span className="text-xs text-muted-foreground">({item.variation.name})</span>
            )}
          </div>
          {/* Sabores */}
          {flavors.length > 0 && (
            <p className="text-sm text-blue-600 mt-0.5">
              🍕 {flavors.join(' + ')}
            </p>
          )}
          {/* Observações - APENAS o fundo da tarja pisca */}
          {item.notes && (
            <div className="mt-1">
              <span className="inline-flex px-2 py-1 rounded font-bold text-sm relative overflow-hidden">
                <span className="absolute inset-0 bg-orange-500 animate-pulse"></span>
                <span className="relative z-10 text-orange-950">📝 {item.notes}</span>
              </span>
            </div>
          )}
        </div>
      );
    }
    
    // Finalização (oven_expedite) e outros: Mostra tudo sem piscar
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-primary">{item.quantity}x</span>
          <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
          {item.variation?.name && (
            <span className="text-xs text-muted-foreground">({item.variation.name})</span>
          )}
          <KdsBorderBadge text={itemText} />
        </div>
        {/* Sabores */}
        {flavors.length > 0 && (
          <p className="text-sm text-blue-600 mt-0.5">
            🍕 {flavors.join(' + ')}
          </p>
        )}
        {item.extras && item.extras.length > 0 && flavors.length === 0 && (
          <p className="text-xs text-blue-600 mt-0.5 truncate">
            + {item.extras.map(e => e.extra_name.split(': ').pop()).join(', ')}
          </p>
        )}
        {item.notes && (
          <p className="text-xs text-orange-500 mt-0.5">📝 {item.notes}</p>
        )}
      </div>
    );
  };

  return (
    <Card className={cn(
      "shadow-md transition-all",
      hasSpecialBorderInItems && "ring-2 ring-amber-500",
      compact && "shadow-sm"
    )}>
      <CardHeader 
        className={cn("pb-2 pt-3 px-4", compact && "pb-1 pt-2 px-3")}
        style={{ borderTop: `3px solid ${stationColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className={cn("h-7 w-7 rounded-full flex items-center justify-center", compact && "h-5 w-5")}
              style={{ backgroundColor: stationColor + '20' }}
            >
              <StationIcon className={cn("h-4 w-4", compact && "h-3 w-3")} style={{ color: stationColor }} />
            </div>
            <div>
              <span className={cn("font-semibold text-sm", compact && "text-xs")}>{getOrderOriginLabel()}</span>
              <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", compact && "hidden")}>
                <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <KdsSlaIndicator createdAt={order.created_at} size={compact ? "sm" : "md"} showBackground />
        </div>
        
        {!compact && order.customer_name && (
          <p className="text-xs text-primary font-medium mt-1">{order.customer_name}</p>
        )}
        
        {!compact && <KdsItemCounter currentIndex={1} totalItems={items.length} />}
        {compact && items.length > 1 && (
          <span className="text-xs text-muted-foreground">{items.length} itens</span>
        )}
      </CardHeader>
      
      <CardContent className={cn("px-4 pb-3 space-y-3", compact && "px-3 pb-2 space-y-2")}>
        {/* Itens aguardando */}
        {waitingItems.length > 0 && (
          <div className={cn("space-y-2", compact && "space-y-1")}>
            {(compact ? waitingItems.slice(0, 2) : waitingItems).map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "p-2 bg-muted/50 rounded-lg border",
                  compact && "p-1.5"
                )}
              >
                {renderItemContent(item)}
                
                <Button 
                  size={compact ? "sm" : "default"}
                  onClick={() => onStartItem(item.id)}
                  disabled={isProcessing}
                  className={cn("w-full mt-3", compact && "h-8 text-xs mt-2")}
                  style={{ backgroundColor: stationColor }}
                >
                  <ArrowRight className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                  Próxima
                </Button>
              </div>
            ))}
            {compact && waitingItems.length > 2 && (
              <p className="text-xs text-muted-foreground text-center">+{waitingItems.length - 2} mais...</p>
            )}
          </div>
        )}
        
        {/* Itens em progresso */}
        {inProgressItems.length > 0 && (
          <div className={cn("space-y-2", compact && "space-y-1")}>
            {inProgressItems.map((item) => (
              <div 
                key={item.id} 
                className={cn("p-2 rounded-lg border-2", compact && "p-1.5")}
                style={{ borderColor: stationColor, backgroundColor: stationColor + '10' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renderItemContent(item, true)}
                    {!compact && item.station_started_at && (
                      <div className="flex items-center gap-1 mt-1">
                        <KdsSlaIndicator createdAt={item.station_started_at} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
                
                <Button 
                  size={compact ? "sm" : "default"}
                  onClick={() => onCompleteItem(item.id)}
                  disabled={isProcessing}
                  className={cn("w-full mt-3", compact && "h-8 text-xs mt-2")}
                  style={{ backgroundColor: stationColor }}
                >
                  {isLastStation ? (
                    <>
                      <CheckCircle className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                      Concluir
                    </>
                  ) : (
                    <>
                      <ArrowRight className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                      Próxima
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {/* Observações do pedido */}
        {!compact && displayOrderNotes && (
          <div className="text-xs text-orange-600 bg-orange-500/10 rounded p-2">
            <strong>Obs pedido:</strong> {displayOrderNotes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}