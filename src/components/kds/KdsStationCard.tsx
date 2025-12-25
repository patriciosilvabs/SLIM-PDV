import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KdsSlaIndicator } from './KdsSlaIndicator';
import { KdsBorderBadge } from './KdsBorderHighlight';
import { KdsItemCounter } from './KdsItemCounter';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, Layers, Flame, ChefHat, ArrowRight, Clock } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';

// Timer visual para tempo na estação
function StationTimer({ 
  startedAt, 
  createdAt,
  greenMinutes = 5,
  yellowMinutes = 10
}: { 
  startedAt?: string | null; 
  createdAt: string;
  greenMinutes?: number;
  yellowMinutes?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  
  const referenceTime = startedAt || createdAt;
  
  useEffect(() => {
    if (!referenceTime) return;
    
    const updateElapsed = () => {
      const minutes = differenceInMinutes(new Date(), new Date(referenceTime));
      setElapsed(Math.max(0, minutes));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [referenceTime]);
  
  const colorClass = elapsed < greenMinutes 
    ? 'text-green-600 bg-green-500/10' 
    : elapsed < yellowMinutes 
      ? 'text-yellow-600 bg-yellow-500/10' 
      : 'text-red-600 bg-red-500/10';
  
  return (
    <div className={cn("inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded", colorClass)}>
      <Clock className="h-3 w-3" />
      <span>{elapsed}min</span>
    </div>
  );
}

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
  onMoveToNext: (itemId: string) => void;
  onSkipItem?: (itemId: string) => void;
  isProcessing?: boolean;
  compact?: boolean;
}

const STATION_ICONS = {
  prep_start: Circle,
  item_assembly: Layers,
  assembly: ChefHat,
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
  onMoveToNext,
  onSkipItem,
  isProcessing,
  compact = false,
}: KdsStationCardProps) {
  const { hasSpecialBorder, settings } = useKdsSettings();
  
  const StationIcon = STATION_ICONS[stationType as keyof typeof STATION_ICONS] || ChefHat;
  
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
    
    // Em preparação (prep_start): Mostra tamanho + borda + observações PISCANDO
    if (stationType === 'prep_start') {
      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary">{item.quantity}x</span>
              <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
              {item.variation?.name && (
                <span className="text-xs text-muted-foreground">({item.variation.name})</span>
              )}
            </div>
            <StationTimer 
              startedAt={item.station_started_at} 
              createdAt={item.created_at} 
              greenMinutes={settings.timerGreenMinutes}
              yellowMinutes={settings.timerYellowMinutes}
            />
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
          {/* Observações do item */}
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
    
    // Item em montagem (item_assembly): Mostra sabores + observações PISCANDO
    if (stationType === 'item_assembly') {
      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary">{item.quantity}x</span>
              <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
              {item.variation?.name && (
                <span className="text-xs text-muted-foreground">({item.variation.name})</span>
              )}
            </div>
            <StationTimer 
              startedAt={item.station_started_at} 
              createdAt={item.created_at} 
              greenMinutes={settings.timerGreenMinutes}
              yellowMinutes={settings.timerYellowMinutes}
            />
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
    
    // Finalização (oven_expedite): Mostra resumo de confirmação destacado
    if (stationType === 'oven_expedite') {
      return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary">{item.quantity}x</span>
              <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
              {item.variation?.name && (
                <span className="text-xs text-muted-foreground">({item.variation.name})</span>
              )}
            </div>
            <StationTimer 
              startedAt={item.station_started_at} 
              createdAt={item.created_at} 
              greenMinutes={settings.timerGreenMinutes}
              yellowMinutes={settings.timerYellowMinutes}
            />
          </div>
          
          {/* RESUMO DE CONFIRMAÇÃO */}
          <div className="mt-2 p-2 bg-muted/50 rounded border-l-4 border-amber-500">
            <p className="text-xs font-semibold text-muted-foreground mb-1">📋 CONFIRME ANTES DE FINALIZAR:</p>
            
            {/* Borda */}
            {borderInfo && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-amber-600 font-medium">🟡 Borda:</span>
                <span className="font-bold">{borderInfo}</span>
              </div>
            )}
            
            {/* Sabores */}
            {flavors.length > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-blue-600 font-medium">🍕 Sabores:</span>
                <span className="font-bold">{flavors.join(' + ')}</span>
              </div>
            )}
            
            {/* Observações */}
            {item.notes && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-orange-600 font-medium">📝 Obs:</span>
                <span className="font-bold">{item.notes}</span>
              </div>
            )}
            
            {/* Se não tem nada especial */}
            {!borderInfo && flavors.length === 0 && !item.notes && (
              <p className="text-sm text-muted-foreground">Sem complementos ou observações</p>
            )}
          </div>
        </div>
      );
    }
    
    // Outros tipos de estação: Mostra tudo sem piscar
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-primary">{item.quantity}x</span>
            <span className="font-medium truncate">{item.product?.name || 'Produto'}</span>
            {item.variation?.name && (
              <span className="text-xs text-muted-foreground">({item.variation.name})</span>
            )}
            <KdsBorderBadge text={itemText} />
          </div>
            <StationTimer 
              startedAt={item.station_started_at} 
              createdAt={item.created_at} 
              greenMinutes={settings.timerGreenMinutes}
              yellowMinutes={settings.timerYellowMinutes}
            />
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
        {/* Itens */}
        <div className={cn("space-y-2", compact && "space-y-1")}>
          {(compact ? items.slice(0, 3) : items).map((item) => (
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
                onClick={() => onMoveToNext(item.id)}
                className={cn("w-full mt-3", compact && "h-8 text-xs mt-2")}
                style={{ backgroundColor: stationColor }}
              >
                {isLastStation ? (
                  <>
                    <CheckCircle className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                    Pronto
                  </>
                ) : (
                  <>
                    <ArrowRight className={cn("h-4 w-4 mr-2", compact && "h-3 w-3 mr-1")} />
                    Próximo
                  </>
                )}
              </Button>
            </div>
          ))}
          {compact && items.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">+{items.length - 3} mais...</p>
          )}
        </div>
        
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