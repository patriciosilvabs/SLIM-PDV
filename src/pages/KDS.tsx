import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, UtensilsCrossed, Store, Truck, Clock, Play, CheckCircle, ChefHat, Volume2, VolumeX, Maximize2, Minimize2, Filter, Timer, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Ban, History, Trash2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useScheduledAnnouncements } from '@/hooks/useScheduledAnnouncements';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

type OrderTypeFilter = 'all' | 'table' | 'takeaway' | 'delivery';

interface MetricDataPoint {
  time: string;
  avgWait: number;
}

interface CancellationHistoryItem {
  orderId: string;
  orderNumber: string;
  reason: string;
  cancelledAt: Date;
  confirmedAt: Date;
  items: Array<{ name: string; quantity: number; variation?: string }>;
  origin: string;
  customerName?: string;
}

const FILTER_STORAGE_KEY = 'kds-order-type-filter';
const CANCELLATION_HISTORY_KEY = 'kds-cancellation-history';
const MAX_WAIT_ALERT_THRESHOLD = 25; // minutes
const MAX_WAIT_ALERT_COOLDOWN = 300000; // 5 minutes in ms

type HistoryPeriodFilter = 'today' | '7days' | '30days' | 'all';

// Format time display in hours after 60 minutes
const formatTimeDisplay = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes} min`;
};

export default function KDS() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder, updateOrderItem } = useOrderMutations();
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [metricsHistory, setMetricsHistory] = useState<MetricDataPoint[]>([]);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [maxWaitAlertCooldown, setMaxWaitAlertCooldown] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>(() => {
    try {
      return (localStorage.getItem(FILTER_STORAGE_KEY) as OrderTypeFilter) || 'all';
    } catch {
      return 'all';
    }
  });
  const { playKdsNewOrderSound, playMaxWaitAlertSound, playOrderCancelledSound, settings } = useAudioNotification();
  const { settings: kdsSettings } = useKdsSettings();
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const previousOrdersRef = useRef<Order[]>([]);
  
  // Unconfirmed cancellations tracking - persists until kitchen confirms
  const [unconfirmedCancellations, setUnconfirmedCancellations] = useState<Map<string, Order>>(new Map());
  const cancelledSoundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cancellation history - persisted in localStorage
  const [cancellationHistory, setCancellationHistory] = useState<CancellationHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(CANCELLATION_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map((item: any) => ({
          ...item,
          cancelledAt: new Date(item.cancelledAt),
          confirmedAt: new Date(item.confirmedAt),
        }));
      }
    } catch (e) {
      console.error('Error loading cancellation history:', e);
    }
    return [];
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<HistoryPeriodFilter>('today');
  
  const canChangeStatus = hasPermission('kds_change_status');
  const lastMetricUpdateRef = useRef<string>('');

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('kds_view')) {
    return <AccessDenied permission="kds_view" />;
  }

  // Calculate order counts for condition-based announcements
  const getWaitTimeMinutes = (createdAt: string | null): number => {
    if (!createdAt) return 0;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  // List for display (includes ready) - only orders with items
  const activeOrdersList = orders.filter(o => 
    (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready') &&
    (o.order_items?.length ?? 0) > 0
  );
  
  // List for alerts (ONLY pending and preparing - ready orders should not trigger alerts)
  const ordersForAlerts = orders.filter(o => 
    (o.status === 'pending' || o.status === 'preparing') &&
    (o.order_items?.length ?? 0) > 0
  );
  
  // Use updated_at for wait time calculation - this resets when new items are added to a ready order
  const waitTimesForAlerts = ordersForAlerts.map(o => getWaitTimeMinutes(o.updated_at || o.created_at));
  const defaultDelayThreshold = 20; // Default minutes to consider order as delayed

  const orderCounts = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    total: activeOrdersList.length,
    avgWaitTimeMinutes: waitTimesForAlerts.length > 0 
      ? Math.round(waitTimesForAlerts.reduce((a, b) => a + b, 0) / waitTimesForAlerts.length) 
      : 0,
    maxWaitTimeMinutes: waitTimesForAlerts.length > 0 
      ? Math.max(...waitTimesForAlerts) 
      : 0,
    delayedOrdersCount: waitTimesForAlerts.filter(t => t > defaultDelayThreshold).length
  };

  // Helper function to get color status based on metric thresholds
  const getMetricStatus = (type: 'avg' | 'max' | 'delayed', value: number) => {
    if (type === 'avg') {
      if (value < 10) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
      if (value < 20) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
      return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
    }
    if (type === 'max') {
      if (value < 15) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
      if (value < 25) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
      return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
    }
    // delayed
    if (value === 0) return { color: 'text-green-500', bg: 'bg-green-500/10', status: 'ok' as const };
    if (value <= 3) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', status: 'warning' as const };
    return { color: 'text-red-500', bg: 'bg-red-500/10', status: 'critical' as const };
  };

  // Metrics Panel Component
  const MetricsPanel = () => {
    const avgStatus = getMetricStatus('avg', orderCounts.avgWaitTimeMinutes);
    const maxStatus = getMetricStatus('max', orderCounts.maxWaitTimeMinutes);
    const delayedStatus = getMetricStatus('delayed', orderCounts.delayedOrdersCount);

    if (activeOrdersList.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
        {/* Tempo Médio */}
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded", avgStatus.bg)}>
          <Clock className={cn("h-4 w-4", avgStatus.color)} />
          <span className="text-xs text-muted-foreground">Média:</span>
          <span className={cn("font-bold text-sm", avgStatus.color)}>
            {formatTimeDisplay(orderCounts.avgWaitTimeMinutes)}
          </span>
        </div>
        
        {/* Pedido Mais Antigo */}
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded", maxStatus.bg)}>
          <Timer className={cn("h-4 w-4", maxStatus.color)} />
          <span className="text-xs text-muted-foreground">Máx:</span>
          <span className={cn("font-bold text-sm", maxStatus.color)}>
            {formatTimeDisplay(orderCounts.maxWaitTimeMinutes)}
          </span>
        </div>
        
        {/* Pedidos Atrasados */}
        {orderCounts.delayedOrdersCount > 0 && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded",
            delayedStatus.bg,
            delayedStatus.status === 'critical' && "animate-pulse"
          )}>
            <AlertTriangle className={cn("h-4 w-4", delayedStatus.color)} />
            <span className={cn("font-bold text-sm", delayedStatus.color)}>
              {orderCounts.delayedOrdersCount} atrasado{orderCounts.delayedOrdersCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Metrics Chart Component
  const MetricsChart = () => {
    if (metricsHistory.length < 2) {
      return (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Aguardando dados... (mínimo 2 minutos)
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={metricsHistory}>
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10 }} 
            interval="preserveStartEnd"
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis 
            tick={{ fontSize: 10 }} 
            width={30}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number) => [`${value} min`, 'Tempo Médio']}
          />
          <Line 
            type="monotone" 
            dataKey="avgWait" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // Listen for scheduled announcements (now with order counts for demand-based triggers)
  useScheduledAnnouncements('kds', orderCounts);

  // Save filter preference
  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, orderTypeFilter);
  }, [orderTypeFilter]);

  // Filter active orders (pending, preparing, ready) - only orders with items
  const activeOrders = orders.filter(order => {
    const isActive = order.status === 'pending' || order.status === 'preparing' || order.status === 'ready';
    if (!isActive) return false;
    
    // Don't show orders without items (table just opened)
    if ((order.order_items?.length ?? 0) === 0) return false;

    if (orderTypeFilter === 'all') return true;
    if (orderTypeFilter === 'table') return order.order_type === 'dine_in';
    if (orderTypeFilter === 'takeaway') return order.order_type === 'takeaway';
    if (orderTypeFilter === 'delivery') return order.order_type === 'delivery';
    return true;
  });

  // Count by type (unfiltered) - only orders with items
  const allActiveOrders = orders.filter(
    order => (order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') &&
             (order.order_items?.length ?? 0) > 0
  );
  const tableCount = allActiveOrders.filter(o => o.order_type === 'dine_in').length;
  const takeawayCount = allActiveOrders.filter(o => o.order_type === 'takeaway').length;
  const deliveryCount = allActiveOrders.filter(o => o.order_type === 'delivery').length;

  const pendingOrders = activeOrders.filter(o => o.status === 'pending');
  // When showPendingColumn is false, merge pending into preparing
  const preparingOrders = kdsSettings.showPendingColumn 
    ? activeOrders.filter(o => o.status === 'preparing')
    : activeOrders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const readyOrders = activeOrders.filter(o => o.status === 'ready');

  // Real-time clock and metrics update
  useEffect(() => {
    // Update every second for clock display in fullscreen
    const clockTimer = isFullscreen ? setInterval(() => {
      setCurrentTime(new Date());
    }, 1000) : null;
    
    // Update every minute for metrics recalculation (even when not fullscreen)
    const metricsTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => {
      if (clockTimer) clearInterval(clockTimer);
      clearInterval(metricsTimer);
    };
  }, [isFullscreen]);

  // Update metrics history every minute
  useEffect(() => {
    const timeKey = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Only add a new point if the minute changed
    if (timeKey !== lastMetricUpdateRef.current) {
      lastMetricUpdateRef.current = timeKey;
      
      setMetricsHistory(prev => {
        const newPoint: MetricDataPoint = {
          time: timeKey,
          avgWait: orderCounts.avgWaitTimeMinutes
        };
        const updated = [...prev, newPoint];
        // Keep only last 120 minutes (2 hours)
        return updated.slice(-120);
      });
    }
  }, [currentTime, orderCounts.avgWaitTimeMinutes]);

  // Max wait alert sound
  useEffect(() => {
    if (
      orderCounts.maxWaitTimeMinutes > MAX_WAIT_ALERT_THRESHOLD && 
      !maxWaitAlertCooldown && 
      soundEnabled && 
      settings.enabled &&
      ordersForAlerts.length > 0
    ) {
      playMaxWaitAlertSound();
      toast.warning(`⚠️ Pedido esperando há mais de ${MAX_WAIT_ALERT_THRESHOLD} minutos!`, { duration: 5000 });
      setMaxWaitAlertCooldown(true);
      setTimeout(() => setMaxWaitAlertCooldown(false), MAX_WAIT_ALERT_COOLDOWN);
    }
  }, [orderCounts.maxWaitTimeMinutes, maxWaitAlertCooldown, soundEnabled, settings.enabled, activeOrdersList.length, playMaxWaitAlertSound]);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('kds-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Sound notification for new orders + visual sync notifications + cancellation alerts
  useEffect(() => {
    // Detect status changes from other screens
    if (previousOrdersRef.current.length > 0) {
      orders.forEach(order => {
        const prevOrder = previousOrdersRef.current.find(o => o.id === order.id);
        if (prevOrder && prevOrder.status !== order.status) {
          const statusLabels: Record<string, string> = {
            pending: 'Novo',
            preparing: 'Em Preparo',
            ready: 'Pronto',
            delivered: 'Entregue',
            cancelled: 'Cancelado'
          };
          
          // Check for cancellation - only notify if order was still in production
          // Orders that were ready/delivered don't need to alert the kitchen anymore
          if (order.status === 'cancelled' && prevOrder.status !== 'cancelled') {
            const wasInProduction = prevOrder.status === 'pending' || prevOrder.status === 'preparing';
            
            // Only show cancellation alerts if enabled in settings
            if (wasInProduction && kdsSettings.cancellationAlertsEnabled !== false) {
              // Add to unconfirmed cancellations map - will persist until confirmed
              setUnconfirmedCancellations(prev => {
                const newMap = new Map(prev);
                newMap.set(order.id, order);
                return newMap;
              });
              
              // Persistent toast until confirmed
              toast.error(`🚫 PEDIDO #${order.id.slice(-4).toUpperCase()} CANCELADO!`, { 
                description: (order as any).cancellation_reason || 'Confirme que viu este cancelamento',
                duration: Infinity,
                id: `cancel-${order.id}`,
              });
            }
          } else if (!notifiedOrdersRef.current.has(`${order.id}-${order.status}`)) {
            // Only notify for non-cancellation status changes we didn't trigger
            toast.info(`Pedido #${order.id.slice(-4).toUpperCase()} → ${statusLabels[order.status] || order.status}`);
          }
        }
      });
    }

    // Sound + visual for new orders (pending or preparing depending on settings)
    const targetStatus = kdsSettings.showPendingColumn ? 'pending' : 'preparing';
    const newOrders = orders.filter(
      o => o.status === targetStatus && !notifiedOrdersRef.current.has(o.id)
    );

    if (newOrders.length > 0) {
      if (soundEnabled && settings.enabled) {
        playKdsNewOrderSound();
      }
      toast.success(`🔔 ${newOrders.length} novo(s) pedido(s)!`, { duration: 4000 });
      newOrders.forEach(o => notifiedOrdersRef.current.add(o.id));
    }

    previousOrdersRef.current = [...orders];
  }, [orders, soundEnabled, settings.enabled, playKdsNewOrderSound, kdsSettings.showPendingColumn]);

  // Sound loop for unconfirmed cancellations
  useEffect(() => {
    // If there are unconfirmed cancellations, alerts are enabled, and sound is enabled
    if (
      kdsSettings.cancellationAlertsEnabled !== false &&
      unconfirmedCancellations.size > 0 && 
      soundEnabled && 
      settings.enabled
    ) {
      // Play immediately
      playOrderCancelledSound();
      
      // Use configurable interval (convert seconds to ms)
      const intervalMs = (kdsSettings.cancellationAlertInterval || 3) * 1000;
      
      // Start loop
      cancelledSoundIntervalRef.current = setInterval(() => {
        if (unconfirmedCancellations.size > 0) {
          playOrderCancelledSound();
        }
      }, intervalMs);
    }
    
    // Cleanup: stop sound when no more unconfirmed cancellations
    return () => {
      if (cancelledSoundIntervalRef.current) {
        clearInterval(cancelledSoundIntervalRef.current);
        cancelledSoundIntervalRef.current = null;
      }
    };
  }, [unconfirmedCancellations.size, soundEnabled, settings.enabled, playOrderCancelledSound, kdsSettings.cancellationAlertInterval, kdsSettings.cancellationAlertsEnabled]);

  // Handler to confirm cancellation was acknowledged
  const handleConfirmCancellation = (orderId: string) => {
    const order = unconfirmedCancellations.get(orderId);
    
    // Save to history before removing
    if (order) {
      const origin = order.order_type === 'delivery' 
        ? 'DELIVERY' 
        : order.order_type === 'takeaway' 
          ? 'BALCÃO' 
          : `MESA ${order.table?.number || '?'}`;
          
      const historyItem: CancellationHistoryItem = {
        orderId: order.id,
        orderNumber: order.id.slice(-4).toUpperCase(),
        reason: (order as any).cancellation_reason || 'Não informado',
        cancelledAt: new Date(order.updated_at || order.created_at),
        confirmedAt: new Date(),
        items: order.order_items?.map(item => ({
          name: item.product?.name || 'Produto',
          quantity: item.quantity,
          variation: item.variation?.name
        })) || [],
        origin,
        customerName: order.customer_name || undefined
      };
      
      setCancellationHistory(prev => {
        const updated = [historyItem, ...prev].slice(0, 100); // Keep max 100 items
        // Persist to localStorage
        try {
          localStorage.setItem(CANCELLATION_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving cancellation history:', e);
        }
        return updated;
      });
    }
    
    setUnconfirmedCancellations(prev => {
      const newMap = new Map(prev);
      newMap.delete(orderId);
      return newMap;
    });
    
    // Dismiss the corresponding toast
    toast.dismiss(`cancel-${orderId}`);
    toast.success('Cancelamento confirmado', { duration: 2000 });
  };

  // Cancellation History Panel Component with filters
  const CancellationHistoryPanel = () => {
    if (cancellationHistory.length === 0) return null;
    
    // Filter history by period
    const getFilteredHistory = () => {
      const now = new Date();
      return cancellationHistory.filter(item => {
        const itemDate = new Date(item.confirmedAt);
        switch (historyPeriodFilter) {
          case 'today':
            return itemDate.toDateString() === now.toDateString();
          case '7days':
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return itemDate >= sevenDaysAgo;
          case '30days':
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return itemDate >= thirtyDaysAgo;
          default:
            return true;
        }
      });
    };
    
    const filteredHistory = getFilteredHistory();
    
    const handleClearHistory = () => {
      setCancellationHistory([]);
      try {
        localStorage.removeItem(CANCELLATION_HISTORY_KEY);
      } catch (e) {
        console.error('Error clearing cancellation history:', e);
      }
      toast.success('Histórico limpo');
    };
    
    const periodLabels: Record<HistoryPeriodFilter, string> = {
      today: 'Hoje',
      '7days': '7 dias',
      '30days': '30 dias',
      all: 'Todos',
    };
    
    return (
      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <Badge variant="secondary" className="text-xs">
              {cancellationHistory.length}
            </Badge>
            {isHistoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-[420px]">
          <Card className="border shadow-lg">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Cancelamentos Confirmados</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={handleClearHistory}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Limpar</span>
                </Button>
              </div>
              <div className="flex gap-1 mt-2">
                {(Object.keys(periodLabels) as HistoryPeriodFilter[]).map((period) => (
                  <Button
                    key={period}
                    variant={historyPeriodFilter === period ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setHistoryPeriodFilter(period)}
                  >
                    {periodLabels[period]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum cancelamento neste período
                </div>
              ) : (
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-2">
                    {filteredHistory.map((item, idx) => (
                      <div 
                        key={`${item.orderId}-${idx}`}
                        className="flex flex-col p-2.5 bg-muted/50 rounded text-sm border"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">#{item.orderNumber}</span>
                            <Badge variant="outline" className="text-xs">{item.origin}</Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {item.confirmedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        {item.customerName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Cliente: {item.customerName}
                          </div>
                        )}
                        <div className="text-xs text-destructive mt-1 font-medium">
                          Motivo: {item.reason}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 bg-background/50 p-1.5 rounded">
                          {item.items.map((i, iIdx) => (
                            <div key={iIdx}>
                              {i.quantity}x {i.name}{i.variation ? ` (${i.variation})` : ''}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-muted">
                          <span>Cancelado: {item.cancelledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Confirmado: {item.confirmedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const handleStartPreparation = async (orderId: string) => {
    try {
      notifiedOrdersRef.current.add(`${orderId}-preparing`);
      await updateOrder.mutateAsync({ id: orderId, status: 'preparing' });
      toast.success('Preparo iniciado!');
    } catch (error) {
      toast.error('Erro ao iniciar preparo');
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      notifiedOrdersRef.current.add(`${orderId}-ready`);
      
      // Mark ALL items in this order as 'delivered' so they don't appear again
      // if the customer adds more items later
      await supabase
        .from('order_items')
        .update({ status: 'delivered' })
        .eq('order_id', orderId);
      
      // Record ready_at timestamp when marking as ready
      await updateOrder.mutateAsync({ 
        id: orderId, 
        status: 'ready',
        ready_at: new Date().toISOString()
      } as any);
      toast.success('Pedido marcado como pronto!');
    } catch (error) {
      toast.error('Erro ao marcar pedido como pronto');
    }
  };

  const getOrderOrigin = (order: Order) => {
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY', color: 'text-purple-500 bg-purple-500/10' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: Store, label: 'BALCÃO', color: 'text-orange-500 bg-orange-500/10' };
    }
    return { 
      icon: UtensilsCrossed, 
      label: `MESA ${order.table?.number || '?'}`, 
      color: 'text-blue-500 bg-blue-500/10' 
    };
  };

  const getTimeInfo = (createdAt: string | null) => {
    if (!createdAt) return { text: '--', color: 'text-muted-foreground', bgColor: '' };
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    const timeText = formatTimeDisplay(minutes);
    
    if (minutes < 10) return { text: timeText, color: 'text-green-500', bgColor: 'bg-green-500/10' };
    if (minutes < 20) return { text: timeText, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    return { text: timeText, color: 'text-red-500', bgColor: 'bg-red-500/10 animate-pulse' };
  };

  const OrderCard = ({ order, showStartButton, showReadyButton }: { 
    order: Order; 
    showStartButton?: boolean;
    showReadyButton?: boolean;
  }) => {
    const origin = getOrderOrigin(order);
    const timeInfo = getTimeInfo(order.updated_at || order.created_at);
    const OriginIcon = origin.icon;

    return (
      <Card className="mb-3 shadow-md">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <Badge className={cn("py-1 px-2 text-xs font-bold", origin.color)}>
              <OriginIcon className="h-3.5 w-3.5 mr-1" />
              {origin.label}
            </Badge>
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-sm", timeInfo.bgColor)}>
              <Clock className={cn("h-3.5 w-3.5", timeInfo.color)} />
              <span className={cn("font-bold", timeInfo.color)}>{timeInfo.text}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="font-mono">#{order.id.slice(-4).toUpperCase()}</span>
            {order.customer_name && (
              <span className="font-medium text-primary">• {order.customer_name}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2 mb-3 border rounded-lg p-2 bg-background/50">
            {/* Filter to show only items that still need to be prepared (pending/preparing) */}
            {order.order_items
              ?.filter(item => item.status === 'pending' || item.status === 'preparing')
              .map((item, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex items-start gap-1">
                  <span className="font-bold text-primary">{item.quantity}x</span>
                  <div className="flex-1">
                    <span className="font-medium">{item.product?.name || 'Produto'}</span>
                    {item.variation?.name && (
                      <span className="text-muted-foreground ml-1">({item.variation.name})</span>
                    )}
                  </div>
                </div>
                {/* Extras/Complementos */}
                {item.extras && item.extras.length > 0 && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 ml-5 mt-0.5">
                    + {item.extras.map(e => 
                        e.extra_name.includes(': ') 
                          ? e.extra_name.split(': ').slice(1).join(': ')
                          : e.extra_name
                      ).join(', ')}
                  </div>
                )}
                {/* Observações do item */}
                {item.notes && (
                  <div className="text-xs text-orange-500 ml-5 mt-0.5">📝 {item.notes}</div>
                )}
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded p-2 mb-3">
              <strong>Obs:</strong> {order.notes}
            </div>
          )}
          <div className="flex gap-2">
            {showStartButton && (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => handleStartPreparation(order.id)}
              >
                <Play className="h-4 w-4 mr-1" />
                Iniciar
              </Button>
            )}
            {showReadyButton && (
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleMarkReady(order.id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Pronto
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Cancelled Order Card with blinking animation
  const CancelledOrderCard = ({ order, onConfirm }: { order: Order; onConfirm: () => void }) => {
    const origin = getOrderOrigin(order);
    const OriginIcon = origin.icon;

    return (
      <Card className="mb-3 shadow-lg border-2 border-destructive animate-blink-cancel">
        <CardHeader className="pb-2 pt-3 px-4 bg-destructive/20">
          <div className="flex items-center justify-between">
            <Badge className="bg-destructive text-destructive-foreground py-1 px-2 text-xs font-bold">
              <Ban className="h-3.5 w-3.5 mr-1" />
              CANCELADO
            </Badge>
            <Badge className={cn("py-1 px-2 text-xs font-bold", origin.color)}>
              <OriginIcon className="h-3.5 w-3.5 mr-1" />
              {origin.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="font-mono font-bold">#{order.id.slice(-4).toUpperCase()}</span>
            {order.customer_name && (
              <span className="font-medium">• {order.customer_name}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {/* Cancellation reason */}
          <div className="text-sm text-destructive bg-destructive/10 rounded p-2 mb-3">
            <strong>Motivo:</strong> {(order as any).cancellation_reason || 'Não informado'}
          </div>
          
          {/* Cancelled items */}
          <div className="space-y-1 mb-3 border rounded-lg p-2 bg-background/50 text-sm opacity-75">
            <p className="text-xs text-muted-foreground mb-1">Itens cancelados:</p>
            {order.order_items?.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="font-bold text-muted-foreground">{item.quantity}x</span>
                <span>{item.product?.name || 'Produto'}</span>
                {item.variation?.name && (
                  <span className="text-muted-foreground">({item.variation.name})</span>
                )}
              </div>
            ))}
            {(order.order_items?.length || 0) > 4 && (
              <p className="text-xs text-muted-foreground">
                +{(order.order_items?.length || 0) - 4} mais...
              </p>
            )}
          </div>
          
          {/* Confirmation button */}
          <Button 
            size="lg" 
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            onClick={onConfirm}
          >
            ✓ CIENTE - CONFIRMAR
          </Button>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ 
    title, 
    orders, 
    icon: Icon, 
    headerColor,
    showStartButton,
    showReadyButton
  }: { 
    title: string; 
    orders: Order[]; 
    icon: React.ElementType;
    headerColor: string;
    showStartButton?: boolean;
    showReadyButton?: boolean;
  }) => (
    <div className="flex-1 min-w-[280px] lg:min-w-[320px]">
      <div className={cn("rounded-t-lg p-3 flex items-center justify-between", headerColor)}>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <span className="font-bold">{title}</span>
        </div>
        <Badge variant="secondary" className="text-base px-2.5 py-0.5">
          {orders.length}
        </Badge>
      </div>
      <ScrollArea className={cn(
        "bg-muted/30 rounded-b-lg p-2",
        isFullscreen ? "h-[calc(100vh-200px)]" : "h-[calc(100vh-280px)]"
      )}>
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">Nenhum pedido</p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              showStartButton={showStartButton}
              showReadyButton={showReadyButton}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );

  const KDSContent = () => (
    <div className={cn("p-4 h-full", isFullscreen && "p-6")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <ChefHat className={cn("text-primary", isFullscreen ? "h-10 w-10" : "h-7 w-7")} />
          <div>
            <h1 className={cn("font-bold", isFullscreen ? "text-3xl" : "text-2xl")}>KDS - Cozinha</h1>
            <p className="text-muted-foreground text-sm">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} ativo{activeOrders.length !== 1 ? 's' : ''}
              {orderTypeFilter !== 'all' && ` (filtrado)`}
            </p>
          </div>
          
          {/* Metrics Panel - Desktop inline */}
          <div className="hidden lg:block">
            <MetricsPanel />
          </div>
        </div>
        
        {/* Real-time clock (fullscreen only) */}
        {isFullscreen && (
          <div className="text-center">
            <div className="text-3xl font-mono font-bold tracking-wider">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 relative">
          {/* Cancellation History Panel */}
          <CancellationHistoryPanel />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "gap-1.5",
              soundEnabled ? "text-green-600 border-green-600/50" : "text-muted-foreground"
            )}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Som ON' : 'Som OFF'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Metrics Panel - Mobile */}
      <div className="lg:hidden mb-4">
        <MetricsPanel />
      </div>

      {/* Metrics Chart (Collapsible) */}
      {activeOrdersList.length > 0 && (
        <Collapsible open={isChartOpen} onOpenChange={setIsChartOpen} className="mb-4">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Evolução do Tempo Médio (últimas 2h)</span>
              </div>
              {isChartOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded-lg border">
            <MetricsChart />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Order Type Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Button
          variant={orderTypeFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOrderTypeFilter('all')}
          className="gap-1.5"
        >
          Todos
          <Badge variant="secondary" className="ml-1 text-xs">
            {allActiveOrders.length}
          </Badge>
        </Button>
        <Button
          variant={orderTypeFilter === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOrderTypeFilter('table')}
          className="gap-1.5"
        >
          <UtensilsCrossed className="h-3.5 w-3.5" />
          Mesa
          <Badge variant="secondary" className="ml-1 text-xs">
            {tableCount}
          </Badge>
        </Button>
        <Button
          variant={orderTypeFilter === 'takeaway' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOrderTypeFilter('takeaway')}
          className="gap-1.5"
        >
          <Store className="h-3.5 w-3.5" />
          Balcão
          <Badge variant="secondary" className="ml-1 text-xs">
            {takeawayCount}
          </Badge>
        </Button>
        <Button
          variant={orderTypeFilter === 'delivery' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOrderTypeFilter('delivery')}
          className="gap-1.5"
        >
          <Truck className="h-3.5 w-3.5" />
          Delivery
          <Badge variant="secondary" className="ml-1 text-xs">
            {deliveryCount}
          </Badge>
        </Button>
      </div>

      {/* Unconfirmed Cancellations Alert - Urgent Section */}
      {unconfirmedCancellations.size > 0 && (
        <div className="mb-4 p-3 bg-destructive/10 border-2 border-destructive rounded-lg animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-6 w-6 text-destructive animate-bounce" />
            <h2 className="text-lg font-bold text-destructive">
              ⚠️ PEDIDO(S) CANCELADO(S) - ATENÇÃO!
            </h2>
            <Badge variant="destructive" className="ml-auto text-base">
              {unconfirmedCancellations.size}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(unconfirmedCancellations.values()).map(order => (
              <CancelledOrderCard 
                key={order.id} 
                order={order}
                onConfirm={() => handleConfirmCancellation(order.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kdsSettings.showPendingColumn && (
            <KanbanColumn 
              title="PENDENTE" 
              orders={pendingOrders} 
              icon={Clock}
              headerColor="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
              showStartButton
            />
          )}
          <KanbanColumn 
            title="EM PREPARO" 
            orders={preparingOrders} 
            icon={ChefHat}
            headerColor="bg-blue-500/20 text-blue-700 dark:text-blue-400"
            showReadyButton
            showStartButton={!kdsSettings.showPendingColumn}
          />
          <KanbanColumn 
            title="PRONTO" 
            orders={readyOrders} 
            icon={CheckCircle}
            headerColor="bg-green-500/20 text-green-700 dark:text-green-400"
          />
        </div>
      )}
    </div>
  );

  // Fullscreen mode - render without PDVLayout
  if (isFullscreen) {
    return (
      <div className="min-h-screen bg-background">
        <KDSContent />
      </div>
    );
  }

  // Normal mode - render with PDVLayout
  return (
    <PDVLayout>
      <KDSContent />
    </PDVLayout>
  );
}
