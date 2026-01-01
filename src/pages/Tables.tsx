import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTables, useTableMutations, Table, TableStatus } from '@/hooks/useTables';
import { useOrders, useOrderMutations, Order, OrderItemStation } from '@/hooks/useOrders';
import { useReservations, useReservationMutations, Reservation } from '@/hooks/useReservations';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { AddOrderItemsModal, CartItem } from '@/components/order/AddOrderItemsModal';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check, ChevronLeft, ShoppingBag, Bell, Banknote, Smartphone, ArrowLeft, Trash2, UserPlus, Minus, ArrowRightLeft, XCircle, Printer, RotateCcw, Ban, ArrowRight, Wallet } from 'lucide-react';
import { printKitchenOrderTicket } from '@/components/kitchen/KitchenOrderTicket';
import { printCustomerReceipt, printPartialPaymentReceipt, propsToReceiptData } from '@/components/receipt/CustomerReceipt';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { mobileAwareToast as toast, setMobileDevice } from '@/lib/mobileToast';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { KitchenTicketData, CancellationTicketData } from '@/utils/escpos';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useProfile } from '@/hooks/useProfile';
import {
  OpenTableDialog,
  ReservationDialog,
  PaymentModal,
  ReopenOrderDialog,
  CustomerNameInput,
  DiscountInput,
  ServiceChargeInput,
  CustomSplitInput,
  OrderDrawer,
  CartReviewSheet,
  ProductSelector,
  PendingCartPanel,
} from '@/components/tables';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Session storage keys for cooldown persistence
const WAIT_COOLDOWN_KEY = 'table-wait-cooldowns';
const IDLE_COOLDOWN_KEY = 'idle-table-cooldowns';

// Helper function to load cooldowns from sessionStorage (defined outside component to avoid hooks issues)
function loadCooldowns(key: string): Map<string, number> {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = Date.now();
      // Filter out expired entries (older than 1 hour)
      const filtered = Object.entries(parsed).filter(([_, time]) => now - (time as number) < 3600000);
      return new Map(filtered.map(([k, v]) => [k, v as number]));
    }
  } catch (e) {
    console.error('Error loading cooldowns:', e);
  }
  return new Map();
}

// Helper function to save cooldowns to sessionStorage
function saveCooldowns(key: string, map: Map<string, number>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch (e) {
    console.error('Error saving cooldowns:', e);
  }
}

const statusLabels: Record<TableStatus, string> = {
  available: 'Livre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  bill_requested: 'Conta Pedida',
};

const statusColors: Record<TableStatus, string> = {
  available: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  occupied: 'bg-red-500 hover:bg-red-600 text-white',
  reserved: 'bg-amber-500 hover:bg-amber-600 text-white',
  bill_requested: 'bg-sky-500 hover:bg-sky-600 text-white',
};

const reservationStatusLabels: Record<string, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
  no_show: 'Não compareceu',
};

const timeSlots = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'Pix',
};

const paymentMethodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  debit_card: <CreditCard className="h-5 w-5" />,
  pix: <Smartphone className="h-5 w-5" />,
};

interface RegisteredPayment {
  method: PaymentMethod;
  amount: number;
  observation?: string;
}

export default function Tables() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasAnyRole, isAdmin } = useUserRole();
  const { hasPermission } = useUserPermissions();
  
  // Granular permission checks
  const canDeleteItems = hasPermission('tables_cancel_items');
  const canReopenTable = hasPermission('tables_reopen');
  const canSwitchTable = hasPermission('tables_switch');
  const canManagePayments = hasPermission('tables_manage_payments');
  const canCloseBill = hasPermission('tables_close');
  const canCancelOrder = hasPermission('tables_cancel_order');
  const canChangeFees = hasPermission('tables_change_fees');
  
  const { settings: tableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings } = useIdleTableSettings();
  const { playOrderReadySound, playTableWaitAlertSound, playIdleTableAlertSound, settings: audioSettings } = useAudioNotification();
  const { getInitialOrderStatus, settings: kdsSettings } = useKdsSettings();
  const { autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket, duplicateItems } = useOrderSettings();
  const printer = usePrinterOptional();
  const centralPrinting = useCentralizedPrinting();
  const { data: printSectors } = usePrintSectors();
  const { profile } = useProfile();
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready', 'delivered']);
  const { data: allOrders } = useOrders(['pending', 'preparing', 'ready', 'delivered', 'cancelled']);
  const { createTable, updateTable } = useTableMutations();
  const { createOrder, updateOrder, addOrderItem, addOrderItemExtras, addOrderItemSubItems } = useOrderMutations();
  
  // Cash register hooks
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  
  // Refs for tracking order status changes
  const previousOrdersRef = useRef<Order[]>([]);
  const tableWaitAlertCooldownRef = useRef<Map<string, number>>(loadCooldowns(WAIT_COOLDOWN_KEY));
  const idleTableCooldownRef = useRef<Map<string, number>>(loadCooldowns(IDLE_COOLDOWN_KEY));
  const notifiedReadyOrdersRef = useRef<Set<string>>(new Set());
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: reservations } = useReservations(selectedDate);
  const { createReservation, cancelReservation, updateReservation } = useReservationMutations();
  
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [isOpenTableDialogOpen, setIsOpenTableDialogOpen] = useState(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableViewMode, setTableViewMode] = useState<'consumo' | 'resumo'>('consumo');
  const [isServingItem, setIsServingItem] = useState<string | null>(null);
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [openTableData, setOpenTableData] = useState({ people: 2, identification: '' });

  // Bill closing flow states
  const [isClosingBill, setIsClosingBill] = useState(false);
  const [registeredPayments, setRegisteredPayments] = useState<RegisteredPayment[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentObservation, setPaymentObservation] = useState('');
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false);
  
  // Discount states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  
  // Service charge states
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  
  // Bill splitting states
  const [splitBillEnabled, setSplitBillEnabled] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<number[]>([]);

  // Switch table states
  const [isSwitchTableDialogOpen, setIsSwitchTableDialogOpen] = useState(false);
  const [isSwitchingTable, setIsSwitchingTable] = useState(false);

  // Reopen table states
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [closedOrderToReopen, setClosedOrderToReopen] = useState<Order | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  

  // Cancel order states
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const MIN_REASON_LENGTH = 10;

  // Loading states for better UX feedback
  const [isClosingEmptyTable, setIsClosingEmptyTable] = useState(false);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [isOpeningTable, setIsOpeningTable] = useState(false);
  const [isFinalizingBill, setIsFinalizingBill] = useState(false);

  // New order flow states - pending items before sending to kitchen
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);

  // Pending cart helper functions
  const addToPendingCart = useCallback((item: CartItem) => {
    setPendingCartItems(prev => [...prev, item]);
  }, []);

  const removeFromPendingCart = useCallback((itemId: string) => {
    setPendingCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updatePendingCartQuantity = useCallback((itemId: string, delta: number) => {
    setPendingCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  }, []);

  const duplicatePendingCartItem = useCallback((itemId: string) => {
    setPendingCartItems(prev => {
      const itemToDuplicate = prev.find(item => item.id === itemId);
      if (!itemToDuplicate) return prev;
      const newItem: CartItem = {
        ...itemToDuplicate,
        id: `${itemToDuplicate.product_id}-${Date.now()}`,
        quantity: 1,
        total_price: itemToDuplicate.unit_price,
      };
      return [...prev, newItem];
    });
  }, []);

  const clearPendingCart = useCallback(() => {
    setPendingCartItems([]);
    setIsAddingMode(false);
  }, []);

  const pendingCartTotal = useMemo(() => {
    return pendingCartItems.reduce((sum, item) => sum + item.total_price, 0);
  }, [pendingCartItems]);

  // Mobile order flow states
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isCartReviewOpen, setIsCartReviewOpen] = useState(false);

  // Handler to send pending cart items to kitchen (mobile flow)
  const handleSendPendingCartToKitchen = async () => {
    if (pendingCartItems.length === 0) return;
    
    // Use the existing handleAddOrderItems function
    await handleAddOrderItems(pendingCartItems);
    
    // Clear pending cart and close drawers
    setPendingCartItems([]);
    setIsOrderDrawerOpen(false);
    setIsCartReviewOpen(false);
    setIsAddingMode(false);
  };

  // Set mobile device flag for toast suppression
  useEffect(() => {
    setMobileDevice(isMobile);
  }, [isMobile]);

  // Reset adding mode when table status changes from occupied
  useEffect(() => {
    if (selectedTable && selectedTable.status !== 'occupied') {
      setIsAddingMode(false);
      setPendingCartItems([]);
      setIsOrderDrawerOpen(false);
      setIsCartReviewOpen(false);
    }
  }, [selectedTable?.status]);

  // Reset tableViewMode to 'consumo' when changing tables
  useEffect(() => {
    setTableViewMode('consumo');
  }, [selectedTable?.id]);

  // Handle serving individual order item
  const handleServeOrderItem = async (itemId: string) => {
    try {
      setIsServingItem(itemId);
      const { error } = await supabase
        .from('order_items')
        .update({ served_at: new Date().toISOString() })
        .eq('id', itemId);
      
      if (error) throw error;
      toast.success('Item marcado como servido');
    } catch (error) {
      console.error('Error serving item:', error);
      toast.error('Erro ao marcar item como servido');
    } finally {
      setIsServingItem(null);
    }
  };

  // Realtime subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('tables-orders-ready')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Detect when table orders change to "ready" and play sound
  // Uses robust detection: checks for recently ready orders even if page wasn't open
  useEffect(() => {
    if (!orders) return;

    const now = Date.now();
    const RECENT_THRESHOLD_MS = 60000; // 60 seconds - consider orders ready within this window

    orders.forEach(order => {
      // Only table orders (dine_in) that are ready
      if (order.order_type !== 'dine_in' || order.status !== 'ready') return;
      
      // Skip if already notified
      if (notifiedReadyOrdersRef.current.has(order.id)) return;

      // Method 1: Detect status change from previous state
      const prevOrder = previousOrdersRef.current.find(o => o.id === order.id);
      const justChangedToReady = prevOrder && prevOrder.status !== 'ready';

      // Method 2: Detect recently ready orders (using ready_at timestamp)
      // This catches orders that became ready while page wasn't active
      let isRecentlyReady = false;
      if (order.ready_at) {
        const readyTime = new Date(order.ready_at).getTime();
        isRecentlyReady = (now - readyTime) < RECENT_THRESHOLD_MS;
      }

      // Trigger notification if either condition is met
      if (justChangedToReady || (isRecentlyReady && previousOrdersRef.current.length > 0)) {
        // Play alert sound
        if (audioSettings.enabled) {
          playOrderReadySound();
        }
        
        // Show toast with table info
        const table = tables?.find(t => t.id === order.table_id);
        const tableNumber = table?.number || '?';
        toast.success(
          `🔔 Mesa ${tableNumber} - Pedido Pronto!`,
          { 
            description: 'A cozinha finalizou o preparo',
            duration: 8000,
            action: {
              label: 'Ver Mesa',
              onClick: () => {
                const targetTable = tables?.find(t => t.id === order.table_id);
                if (targetTable) {
                  setSelectedTable(targetTable);
                }
              }
            }
          }
        );
        
        // Mark as notified to avoid repetition
        notifiedReadyOrdersRef.current.add(order.id);
      }
    });

    previousOrdersRef.current = orders;
  }, [orders, tables, playOrderReadySound, audioSettings.enabled]);

  // Check table wait times and trigger alert if threshold exceeded
  useEffect(() => {
    if (!tableWaitSettings.enabled || !orders || !audioSettings.enabled) return;

    const checkTableWaitTimes = () => {
      const now = Date.now();
      
      orders.forEach(order => {
        // Only table orders (dine_in) that are not ready/delivered
        if (order.order_type !== 'dine_in') return;
        if (order.status === 'ready' || order.status === 'delivered' || order.status === 'cancelled') return;
        
        // Verificar se a mesa ainda está ocupada - se não estiver, ignorar o pedido
        const table = tables?.find(t => t.id === order.table_id);
        if (!table || table.status !== 'occupied') return;
        
        const orderTime = new Date(order.created_at!).getTime();
        const waitMinutes = Math.floor((now - orderTime) / 60000);
        
        // If exceeded threshold
        if (waitMinutes >= tableWaitSettings.thresholdMinutes) {
          const lastAlert = tableWaitAlertCooldownRef.current.get(order.id) || 0;
          const cooldownMs = tableWaitSettings.cooldownMinutes * 60000;
          
          // Check cooldown
          if (now - lastAlert >= cooldownMs) {
            // Play alert sound
            playTableWaitAlertSound();
            
            // Show toast
            const table = tables?.find(t => t.id === order.table_id);
            toast.warning(
              `⏰ Mesa ${table?.number || '?'} - ${waitMinutes} minutos!`,
              { 
                description: `Tempo de espera ultrapassou ${tableWaitSettings.thresholdMinutes} minutos`,
                duration: 8000 
              }
            );
            
            // Update cooldown and persist
            tableWaitAlertCooldownRef.current.set(order.id, now);
            saveCooldowns(WAIT_COOLDOWN_KEY, tableWaitAlertCooldownRef.current);
          }
        }
      });
    };

    // Check immediately and every minute
    checkTableWaitTimes();
    const interval = setInterval(checkTableWaitTimes, 60000);
    
    return () => clearInterval(interval);
  }, [orders, tables, tableWaitSettings, audioSettings.enabled, playTableWaitAlertSound]);

  // Check for idle tables (opened without items OR delivered orders) and alert/auto-close
  useEffect(() => {
    if (!idleTableSettings.enabled || !orders || !tables) return;

    const checkIdleTables = async () => {
      const now = Date.now();
      
      // Get occupied tables
      const occupiedTables = tables.filter(t => t.status === 'occupied');
      
      for (const table of occupiedTables) {
        // Scenario 1: Order WITHOUT items (empty) - ignora drafts
        const emptyOrder = orders.find(o => 
          o.table_id === table.id && 
          o.status !== 'delivered' && 
          o.status !== 'cancelled' &&
          o.is_draft !== true && // Ignorar pedidos em rascunho
          (!o.order_items || o.order_items.length === 0)
        );
        
        // Scenario 2: DELIVERED order (if setting is enabled)
        const deliveredOrder = idleTableSettings.includeDeliveredOrders 
          ? orders.find(o => 
              o.table_id === table.id && 
              o.status === 'delivered'
            )
          : null;
        
        // Determine which order to check and reference time
        let orderToCheck = emptyOrder;
        let referenceTime: number | null = null;
        let idleReason = 'sem pedidos';
        
        if (emptyOrder) {
          referenceTime = new Date(emptyOrder.created_at!).getTime();
          idleReason = 'sem pedidos';
        } else if (deliveredOrder) {
          orderToCheck = deliveredOrder;
          referenceTime = new Date(deliveredOrder.updated_at!).getTime();
          idleReason = 'pedido entregue';
        }
        
        if (!orderToCheck || !referenceTime) continue;
        
        // Calculate idle time
        const idleMinutes = Math.floor((now - referenceTime) / 60000);
        
        // If exceeded threshold
        if (idleMinutes >= idleTableSettings.thresholdMinutes) {
          const lastAlert = idleTableCooldownRef.current.get(table.id) || 0;
          const cooldownMs = 5 * 60000; // 5 minutes cooldown
          
          // Check cooldown
          if (now - lastAlert >= cooldownMs) {
            // Update cooldown and persist FIRST to prevent re-alerts
            idleTableCooldownRef.current.set(table.id, now);
            saveCooldowns(IDLE_COOLDOWN_KEY, idleTableCooldownRef.current);
            
            if (idleTableSettings.autoClose) {
              // AUTO-CLOSE: Update table to available and cancel/update order
              try {
                await updateTable.mutateAsync({ id: table.id, status: 'available' });
                if (emptyOrder) {
                  await updateOrder.mutateAsync({ id: orderToCheck.id, status: 'cancelled' });
                }
                
                toast.info(
                  `🔄 Mesa ${table.number} fechada automaticamente`,
                  { description: `Ociosa por ${idleMinutes} minutos (${idleReason})` }
                );
              } catch (error) {
                console.error('Error auto-closing idle table:', error);
              }
            } else {
              // ALERT ONLY
              if (audioSettings.enabled) {
                playIdleTableAlertSound();
              }
              
              toast.warning(
                `⚠️ Mesa ${table.number} ociosa - ${idleMinutes} min`,
                { 
                  description: `Mesa aberta (${idleReason})`,
                  duration: 10000,
                  action: {
                    label: 'Fechar Mesa',
                    onClick: async () => {
                      try {
                        await updateTable.mutateAsync({ id: table.id, status: 'available' });
                        if (emptyOrder) {
                          await updateOrder.mutateAsync({ id: orderToCheck.id, status: 'cancelled' });
                        }
                        toast.success(`Mesa ${table.number} fechada`);
                      } catch (error) {
                        console.error('Error closing idle table:', error);
                      }
                    }
                  }
                }
              );
            }
            
            idleTableCooldownRef.current.set(table.id, now);
          }
        }
      }
    };

    checkIdleTables();
    const interval = setInterval(checkIdleTables, 60000);
    
    return () => clearInterval(interval);
  }, [orders, tables, idleTableSettings, audioSettings.enabled, playIdleTableAlertSound, updateTable, updateOrder]);

  const getTableOrder = (tableId: string) => {
    // Buscar a mesa para verificar se ainda está ocupada
    const table = tables?.find(t => t.id === tableId);
    
    return orders?.find(o => 
      o.table_id === tableId && 
      o.status !== 'cancelled' &&
      // Se a mesa está ocupada, mostrar mesmo pedidos 'delivered' até fechar a conta
      // Se a mesa está livre, excluir pedidos 'delivered' (são histórico)
      (table?.status !== 'available' || o.status !== 'delivered') &&
      // Ignorar drafts sem itens
      !(o.is_draft === true && (!o.order_items || o.order_items.length === 0))
    );
  };

  // Mark order as delivered (closes the order)
  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ 
        id: orderId, 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      } as any);
      toast.success('Pedido marcado como entregue!', {
        description: 'O pedido foi entregue na mesa.',
      });
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Erro ao marcar pedido como entregue');
    }
  };

  // Mark order as served (just visual marker, keeps order active)
  const handleMarkAsServed = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ 
        id: orderId, 
        served_at: new Date().toISOString()
      });
      toast.success('Itens marcados como servidos!', {
        description: 'O cliente pode continuar pedindo ou fechar a conta.',
      });
    } catch (error) {
      console.error('Error marking order as served:', error);
      toast.error('Erro ao marcar como servido');
    }
  };

  const getTableReservation = (tableId: string) => {
    return reservations?.find(r => r.table_id === tableId && r.status === 'confirmed');
  };

  // Get closed (delivered) orders for a table in the last 24 hours
  const getClosedTableOrders = (tableId: string) => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return allOrders?.filter(o => 
      o.table_id === tableId && 
      o.status === 'delivered' &&
      o.order_items && 
      o.order_items.length > 0 &&
      new Date(o.updated_at || o.created_at!) > oneDayAgo
    ) || [];
  };


  // Get the current KDS station for an order (based on items' current_station)
  const getOrderCurrentStation = (order: Order | undefined): OrderItemStation | null => {
    if (!order?.order_items || order.order_items.length === 0) return null;
    
    // Find items with station info (non-completed items)
    const itemsWithStation = order.order_items.filter(
      item => item.current_station && item.station_status !== 'completed'
    );
    if (itemsWithStation.length === 0) return null;
    
    // Get the station with lowest sort_order (earliest in the flow)
    const earliestItem = itemsWithStation.reduce((earliest, item) => {
      if (!earliest.current_station) return item;
      if (!item.current_station) return earliest;
      const earliestOrder = earliest.current_station.sort_order ?? 999;
      const itemOrder = item.current_station.sort_order ?? 999;
      return itemOrder < earliestOrder ? item : earliest;
    });
    
    return earliestItem.current_station || null;
  };

  const handleTableClick = (table: Table) => {
    // Reset closing states when switching tables to prevent data leak
    setIsClosingBill(false);
    setRegisteredPayments([]);
    setDiscountType('percentage');
    setDiscountValue(0);
    setServiceChargeEnabled(false);
    setServiceChargePercent(10);
    setSplitBillEnabled(false);
    setSplitCount(2);
    setSplitMode('equal');
    setCustomSplits([]);
    
    if (table.status === 'available') {
      setTableToOpen(table);
      setOpenTableData({ people: table.capacity || 2, identification: '' });
      setIsOpenTableDialogOpen(true);
    } else {
      setSelectedTable(table);
    }
  };



  const handleCloseTable = async () => {
    if (!selectedTable) return;
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'available' });
    setSelectedTable(null);
  };

  const handleRequestBill = async () => {
    if (!selectedTable) return;
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'bill_requested' });
    setSelectedTable({ ...selectedTable, status: 'bill_requested' });
  };

  const handleAddOrderItems = async (items: CartItem[]) => {
    if (!selectedTable) return;
    
    // Buscar pedido da mesa incluindo drafts vazios (mesa recém-aberta)
    // Permite adicionar itens a pedidos ready/delivered - o trigger cuidará de voltar para preparing
    const order = orders?.find(o => 
      o.table_id === selectedTable.id && 
      o.status !== 'cancelled'
    );
    if (!order) return;

    // Fechar modal imediatamente para feedback visual
    setIsAddOrderModalOpen(false);
    setIsAddingItems(true);

    try {
      // O trigger auto_initialize_new_order_item cuidará de:
      // 1. Atribuir estação KDS ao item
      // 2. Mudar status do pedido de 'delivered' para 'preparing' automaticamente

      for (const item of items) {
        // Quando duplicateItems está ativo, "explodir" itens com quantity > 1
        // salvando cada unidade como um registro separado no banco
        const quantityToSave = duplicateItems && item.quantity > 1 ? 1 : item.quantity;
        const iterationCount = duplicateItems && item.quantity > 1 ? item.quantity : 1;
        
        for (let i = 0; i < iterationCount; i++) {
          const orderItem = await addOrderItem.mutateAsync({
            order_id: order.id,
            product_id: item.product_id,
            variation_id: item.variation_id || null,
            quantity: quantityToSave,
            unit_price: item.unit_price,
            total_price: item.unit_price * quantityToSave,
            notes: item.notes || null,
            status: getInitialOrderStatus(),
          });

          // Save complements/extras if present
          if (item.complements && item.complements.length > 0) {
            const extras = item.complements.map(c => ({
              order_item_id: orderItem.id,
              extra_name: `${c.group_name}: ${c.option_name}`,
              price: c.price * c.quantity,
              extra_id: null,
            }));
            await addOrderItemExtras.mutateAsync(extras);
          }

          // Save sub-items (individual pizzas in a combo) if present
          if (item.subItems && item.subItems.length > 0) {
            await addOrderItemSubItems.mutateAsync({
              order_item_id: orderItem.id,
              sub_items: item.subItems.map(si => ({
                sub_item_index: si.sub_item_index,
                notes: si.sub_item_notes || null,
                extras: si.complements.map(c => ({
                  group_id: c.group_id || null,
                  group_name: c.group_name,
                  option_id: c.option_id || null,
                  option_name: c.option_name,
                  price: c.price,
                  quantity: c.quantity,
                })),
              })),
            });
          }
        }
      }

      // Mark order as no longer draft - now it can appear in KDS
      if (order.is_draft) {
        await updateOrder.mutateAsync({
          id: order.id,
          is_draft: false
        });
      }

      toast.success('Itens adicionados!');

      // Auto-print kitchen ticket if enabled - with detailed logging
      console.log('[Print Debug] Checking auto-print conditions:', {
        autoPrintKitchenTicket,
        printerExists: !!printer,
        canPrintToKitchen: printer?.canPrintToKitchen,
        selectedTable: selectedTable?.number,
      });
      
      if (!autoPrintKitchenTicket) {
        console.log('[Print Debug] Auto-print disabled in settings');
      } else if (!centralPrinting.canPrintToKitchen) {
        console.log('[Print Debug] Cannot print to kitchen (no printer or queue)');
      } else if (selectedTable) {
        try {
          // Use centralized printing (queue or direct)
          // "Explodir" itens com quantity > 1 quando duplicateItems está ativo
          const sectorItems: SectorPrintItem[] = [];
          for (const item of items) {
            if (duplicateItems && item.quantity > 1) {
              // Criar linhas separadas para cada unidade
              for (let i = 0; i < item.quantity; i++) {
                sectorItems.push({
                  quantity: 1,
                  productName: item.product_name,
                  variation: item.variation_name,
                  extras: item.complements?.map(c => c.option_name),
                  notes: item.notes,
                  print_sector_id: item.print_sector_id,
                });
              }
            } else {
              sectorItems.push({
                quantity: item.quantity,
                productName: item.product_name,
                variation: item.variation_name,
                extras: item.complements?.map(c => c.option_name),
                notes: item.notes,
                print_sector_id: item.print_sector_id,
              });
            }
          }
          
          await centralPrinting.printKitchenTicketsBySector(
            sectorItems,
            {
              orderNumber: order.id.slice(0, 8).toUpperCase(),
              orderType: 'dine_in',
              tableNumber: selectedTable.number,
              customerName: order.customer_name || undefined,
              notes: order.notes || undefined,
              createdAt: new Date().toISOString(),
            },
            duplicateKitchenTicket
          );
          
          toast.success(centralPrinting.shouldQueue ? '🖨️ Comanda enviada para fila' : '🖨️ Comanda impressa');
        } catch (err) {
          console.error('[Print Debug] Auto print failed:', err);
          toast.error('Erro ao imprimir comanda.');
        }
      }
    } catch (error) {
      console.error('Error adding order items:', error);
      toast.error('Erro ao adicionar itens');
    } finally {
      setIsAddingItems(false);
    }
  };

  // Switch table function with audit log
  const handleSwitchTable = async (newTableId: string) => {
    if (!selectedTable || !selectedOrder) return;
    
    setIsSwitchingTable(true);
    try {
      const newTable = tables?.find(t => t.id === newTableId);
      if (!newTable) throw new Error('Mesa não encontrada');
      
      // 1. Log the table switch for audit
      await supabase.from('table_switches').insert({
        order_id: selectedOrder.id,
        from_table_id: selectedTable.id,
        to_table_id: newTableId,
        switched_by: user?.id || null,
      });
      
      // 2. Update order with new table
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        table_id: newTableId
      });
      
      // 3. Free the old table
      await updateTable.mutateAsync({
        id: selectedTable.id,
        status: 'available'
      });
      
      // 4. Occupy the new table
      await updateTable.mutateAsync({
        id: newTableId,
        status: 'occupied'
      });
      
      toast.success(`Mesa trocada: ${selectedTable.number} → ${newTable.number}`);
      setIsSwitchTableDialogOpen(false);
      setSelectedTable({ ...newTable, status: 'occupied' });
    } catch (error: any) {
      console.error('Error switching table:', error);
      toast.error('Erro ao trocar mesa');
    } finally {
      setIsSwitchingTable(false);
    }
  };


  // Close empty table (no consumption)
  const handleCloseEmptyTable = async () => {
    if (!selectedTable) return;
    
    const tableNumber = selectedTable.number;
    setIsClosingEmptyTable(true);
    
    // Fechar painel/dialog imediatamente para feedback visual
    setSelectedTable(null);
    
    try {
      // Buscar qualquer pedido draft vazio associado a esta mesa
      const draftOrder = orders?.find(o => 
        o.table_id === selectedTable.id && 
        o.is_draft === true && 
        (!o.order_items || o.order_items.length === 0) &&
        o.status !== 'cancelled'
      );
      
      // Se existir draft vazio, cancelar para limpeza
      if (draftOrder) {
        await updateOrder.mutateAsync({ 
          id: draftOrder.id, 
          status: 'cancelled',
          table_id: null // Desassociar da mesa
        });
      }
      
      // Atualizar mesa para disponível
      await updateTable.mutateAsync({ 
        id: selectedTable.id, 
        status: 'available' 
      });
      
      toast.success(`Mesa ${tableNumber} fechada (sem consumo)`);
    } catch (error) {
      console.error('Error closing empty table:', error);
      toast.error('Erro ao fechar mesa');
    } finally {
      setIsClosingEmptyTable(false);
    }
  };

  // Cancel order with reason
  const handleCancelOrder = async (reason: string) => {
    if (!selectedOrder || !selectedTable) return;
    
    setIsCancellingOrder(true);
    try {
      // Update order with cancellation info using direct supabase call
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
          status_before_cancellation: selectedOrder.status,
        })
        .eq('id', selectedOrder.id);
      
      if (orderError) throw orderError;
      
      // Print cancellation ticket to kitchen (if enabled in settings)
      const autoPrint = kdsSettings.autoPrintCancellations ?? true;
      if (autoPrint && printer?.canPrintToKitchen && selectedOrder.order_items && selectedOrder.order_items.length > 0) {
        try {
          const cancellationData: CancellationTicketData = {
            orderNumber: selectedOrder.id,
            orderType: selectedOrder.order_type || 'dine_in',
            tableNumber: selectedTable.number,
            customerName: selectedOrder.customer_name,
            cancellationReason: reason,
            cancelledBy: profile?.name || user?.email || 'Desconhecido',
            items: selectedOrder.order_items.map(item => ({
              quantity: item.quantity,
              productName: item.product?.name || 'Produto',
              variation: item.variation?.name,
              notes: item.notes,
            })),
            cancelledAt: new Date().toISOString(),
          };
          await printer.printCancellationTicket(cancellationData);
        } catch (printError) {
          console.error('Error printing cancellation ticket:', printError);
          // Don't fail the cancellation if print fails
        }
      }
      
      // Free the table
      await updateTable.mutateAsync({
        id: selectedTable.id,
        status: 'available',
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast.success('Pedido cancelado', {
        description: `Motivo: ${reason}`,
      });
      
      setIsCancelOrderDialogOpen(false);
      setSelectedTable(null);
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Erro ao cancelar pedido');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Delete order item (only admin/cashier)
  const handleDeleteOrderItem = async (itemId: string, orderId: string) => {
    if (!canDeleteItems) {
      toast.error('Você não tem permissão para excluir itens');
      return;
    }
    try {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
      
      // Recalculate order total
      const { data: remainingItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);
      
      const newTotal = remainingItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      await updateOrder.mutateAsync({ id: orderId, total: newTotal, subtotal: newTotal });
      
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Item removido');
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };


  const handleConfirmArrival = async (reservation: Reservation) => {
    await updateReservation.mutateAsync({ id: reservation.id, status: 'completed' });
    await updateTable.mutateAsync({ id: reservation.table_id, status: 'occupied' });
    await createOrder.mutateAsync({
      table_id: reservation.table_id,
      order_type: 'dine_in',
      status: getInitialOrderStatus(),
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
    });
    setSelectedReservation(null);
  };

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, "EEE, dd 'de' MMM", { locale: ptBR }),
    };
  });

  const selectedOrder = selectedTable ? getTableOrder(selectedTable.id) : null;

  // Save edited customer name - now uses callback for CustomerNameInput component
  const handleSaveCustomerName = useCallback(async (newName: string) => {
    if (!selectedOrder) return;
    try {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        customer_name: newName.trim() || null
      });
      toast.success('Nome do cliente atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar nome');
    }
  }, [selectedOrder, updateOrder]);

  // Fetch existing partial payments for the selected order WITH receiver profile
  const { data: existingPayments } = useQuery({
    queryKey: ['payments', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', selectedOrder.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrder?.id,
  });

  // Fetch payments for ALL occupied tables to show partial payment indicators on grid
  const { data: allTablePayments } = useQuery({
    queryKey: ['all-table-payments', tables?.filter(t => t.status === 'occupied').map(t => t.id)],
    queryFn: async () => {
      const occupiedTableIds = tables?.filter(t => t.status === 'occupied').map(t => t.id) || [];
      if (occupiedTableIds.length === 0) return [];
      
      // Get orders for occupied tables (exclude closed/cancelled orders)
      const { data: activeOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, table_id, total')
        .in('table_id', occupiedTableIds)
        .neq('status', 'cancelled')
        .neq('status', 'delivered');
      
      if (ordersError) throw ordersError;
      if (!activeOrders?.length) return [];
      
      // Get payments for those orders
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('order_id, amount')
        .in('order_id', activeOrders.map(o => o.id));
      
      if (paymentsError) throw paymentsError;
      
      // Aggregate by table_id
      return activeOrders.map(order => ({
        table_id: order.table_id,
        order_id: order.id,
        orderTotal: Number(order.total),
        totalPaid: payments
          ?.filter(p => p.order_id === order.id)
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0
      }));
    },
    enabled: !!tables?.length,
  });

  // Create map for quick access to table payment info
  const tablePaymentsMap = useMemo(() => {
    const map = new Map<string, { totalPaid: number; orderTotal: number }>();
    allTablePayments?.forEach(tp => {
      map.set(tp.table_id, { totalPaid: tp.totalPaid, orderTotal: tp.orderTotal });
    });
    return map;
  }, [allTablePayments]);

  // Calculate total already paid (from database)
  const existingPaymentsTotal = useMemo(() => 
    (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0),
    [existingPayments]
  );

  // Payment calculations with discount and service charge
  const subtotal = selectedOrder?.total || 0;
  
  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    return discountType === 'percentage' 
      ? (subtotal * discountValue / 100)
      : Math.min(discountValue, subtotal);
  }, [subtotal, discountType, discountValue]);
  
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  
  const serviceAmount = useMemo(() => {
    if (!serviceChargeEnabled) return 0;
    return afterDiscount * serviceChargePercent / 100;
  }, [serviceChargeEnabled, serviceChargePercent, afterDiscount]);
  
  const finalTotal = afterDiscount + serviceAmount;
  
  // Total paid includes existing payments from DB + new payments in this session
  const sessionPaid = useMemo(() => 
    registeredPayments.reduce((sum, p) => sum + p.amount, 0), 
    [registeredPayments]
  );
  
  const totalPaid = existingPaymentsTotal + sessionPaid;
  
  const remainingAmount = Math.max(0, finalTotal - totalPaid);
  const changeAmount = totalPaid > finalTotal ? totalPaid - finalTotal : 0;
  
  // Bill splitting calculations
  const splitAmounts = useMemo(() => {
    if (!splitBillEnabled || splitCount < 2) return [];
    if (splitMode === 'equal') {
      const perPerson = finalTotal / splitCount;
      return Array(splitCount).fill(perPerson);
    }
    return customSplits;
  }, [splitBillEnabled, splitCount, splitMode, finalTotal, customSplits]);
  
  const customSplitsTotal = customSplits.reduce((sum, v) => sum + v, 0);
  const customSplitsRemaining = finalTotal - customSplitsTotal;

  // Reset closing state when table changes
  useEffect(() => {
    if (selectedTable) {
      setIsClosingBill(selectedTable.status === 'bill_requested');
      setRegisteredPayments([]);
      // Reset discount, service, and split states
      setDiscountType('percentage');
      setDiscountValue(0);
      setServiceChargeEnabled(false);
      setServiceChargePercent(10);
      setSplitBillEnabled(false);
      setSplitCount(2);
      setSplitMode('equal');
      setCustomSplits([]);
    } else {
      setIsClosingBill(false);
      setRegisteredPayments([]);
    }
  }, [selectedTable?.id]);
  
  // Initialize custom splits when split count changes
  useEffect(() => {
    if (splitBillEnabled && splitMode === 'custom') {
      setCustomSplits(Array(splitCount).fill(0));
    }
  }, [splitCount, splitBillEnabled, splitMode]);

  // Start bill closing
  const handleStartClosing = async () => {
    if (!selectedTable) return;
    const order = getTableOrder(selectedTable.id);
    
    // Block closing if order is not ready yet
    if (order && !['ready', 'delivered'].includes(order.status)) {
      toast.error('Pedido ainda em preparo', {
        description: 'A conta só pode ser fechada após o pedido ficar pronto.',
      });
      return;
    }
    
    setIsClosingBill(true);
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'bill_requested' });
    setSelectedTable({ ...selectedTable, status: 'bill_requested' });
    
    // Auto-print bill summary when clicking "Fechar Conta"
    if (order && centralPrinting.canPrintToCashier) {
      try {
        const receiptData = propsToReceiptData({
          order,
          payments: [],
          discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
          serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
          splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
          tableNumber: selectedTable.number,
          receiptType: 'summary',
        });
        const success = await centralPrinting.printCustomerReceipt(receiptData);
        if (success) {
          toast.success('Resumo da conta enviado para impressão');
        }
      } catch (err) {
        console.error('Auto print bill summary failed:', err);
      }
    }
  };

  // Reopen table (cancel closing)
  const handleReopenTable = async () => {
    if (!selectedTable) return;
    setIsClosingBill(false);
    setRegisteredPayments([]);
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'occupied' });
    setSelectedTable({ ...selectedTable, status: 'occupied' });
  };

  // Select payment method and open modal
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPaymentAmount(remainingAmount.toFixed(2).replace('.', ','));
    setPaymentObservation('');
    setPaymentModalOpen(true);
  };

  // Confirm individual payment (adds to session list, not DB yet)
  const handleConfirmPayment = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    
    const newPayment: RegisteredPayment = {
      method: selectedPaymentMethod!,
      amount,
      observation: paymentObservation || undefined,
    };
    
    const updatedPayments = [...registeredPayments, newPayment];
    setRegisteredPayments(updatedPayments);
    setPaymentModalOpen(false);
    
    // Check if payment is complete (including existing payments)
    const newSessionPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newTotalPaid = existingPaymentsTotal + newSessionPaid;
    if (newTotalPaid >= finalTotal) {
      setConfirmCloseModalOpen(true);
    }
  };

  // Handle partial payment - saves to DB immediately, table stays open
  const handlePartialPayment = async () => {
    if (!selectedOrder || !selectedPaymentMethod) return;
    
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      await createPayment.mutateAsync({
        order_id: selectedOrder.id,
        cash_register_id: openCashRegister?.id || null,
        payment_method: selectedPaymentMethod,
        amount: amount,
        is_partial: true,
      });

      // Print partial payment receipt
      try {
        await printPartialPaymentReceipt({
          orderTotal: finalTotal,
          paymentAmount: amount,
          paymentMethod: selectedPaymentMethod,
          existingPayments: existingPayments || [],
          tableNumber: selectedTable?.number,
          customerName: selectedOrder.customer_name || undefined,
          orderId: selectedOrder.id,
        }, printer);
        toast.success('Pagamento parcial registrado e comprovante impresso!');
      } catch (printError) {
        console.error('Error printing partial payment receipt:', printError);
        toast.success('Pagamento parcial registrado!');
      }

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentObservation('');
      
      // Invalidate payments query to refresh
      queryClient.invalidateQueries({ queryKey: ['payments', selectedOrder.id] });
    } catch (error) {
      console.error('Error creating partial payment:', error);
      toast.error('Erro ao registrar pagamento parcial');
    }
  };

  // Remove a registered payment
  const handleRemovePayment = (index: number) => {
    setRegisteredPayments(prev => prev.filter((_, i) => i !== index));
  };

  // Finalize bill closing
  const handleFinalizeBill = async () => {
    if (!selectedOrder || !selectedTable) return;
    
    // Calculate total paid (session payments + existing partial payments)
    const sessionPaymentsTotal = registeredPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaidAmount = sessionPaymentsTotal + existingPaymentsTotal;
    
    // Validate: must have at least one payment method and cover the total
    if (registeredPayments.length === 0 && existingPaymentsTotal === 0) {
      toast.error('Selecione pelo menos uma forma de pagamento');
      return;
    }
    
    if (totalPaidAmount < finalTotal - 0.01) { // Allow 1 cent tolerance for rounding
      toast.error(`Valor pago (${formatCurrency(totalPaidAmount)}) é menor que o total (${formatCurrency(finalTotal)})`);
      return;
    }
    
    const tableNumber = selectedTable.number;
    
    // Fechar modal de confirmação imediatamente
    setConfirmCloseModalOpen(false);
    setIsFinalizingBill(true);
    
    try {
      // Register any pending session payments in database (non-partial)
      for (const payment of registeredPayments) {
        await createPayment.mutateAsync({
          order_id: selectedOrder.id,
          cash_register_id: openCashRegister?.id || null,
          payment_method: payment.method,
          amount: payment.amount,
          is_partial: false, // Final payment closes the table
        });
      }

      // If no session payments but we have existing partial payments, we need to close the table manually
      if (registeredPayments.length === 0 && existingPaymentsTotal > 0) {
        // Update order status to delivered and clear table_id
        await supabase
          .from('orders')
          .update({ 
            status: 'delivered',
            table_id: null, // Desassociar da mesa para evitar conflitos futuros
            delivered_at: new Date().toISOString()
          })
          .eq('id', selectedOrder.id);

        // Update table status to available
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', selectedTable.id);
        
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['tables'] });
      }

      // Auto-print customer receipt if enabled
      if (autoPrintCustomerReceipt && centralPrinting.canPrintToCashier) {
        try {
          const receiptData = propsToReceiptData({
            order: selectedOrder,
            payments: registeredPayments.map(p => ({
              id: '',
              order_id: selectedOrder.id,
              payment_method: p.method,
              amount: p.amount,
              cash_register_id: openCashRegister?.id || null,
              received_by: null,
              created_at: new Date().toISOString(),
            })),
            discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
            serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
            splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
            tableNumber: selectedTable.number,
            receiptType: 'fiscal',
          });
          const success = await centralPrinting.printCustomerReceipt(receiptData);
          if (success) {
            toast.success('Cupom fiscal enviado para impressão');
          }
        } catch (err) {
          console.error('Auto print receipt failed:', err);
        }
      }
      
      // Clear state and close
      setIsClosingBill(false);
      setRegisteredPayments([]);
      setSelectedTable(null);
      
      toast.success(`Mesa ${tableNumber} fechada com sucesso!`);
    } catch (error) {
      console.error('Error finalizing bill:', error);
      toast.error('Erro ao finalizar conta');
    } finally {
      setIsFinalizingBill(false);
    }
  };

  return (
    <PDVLayout>
      <Tabs defaultValue="tables" className="h-full flex flex-col">
        {/* Tabs centralizadas no topo */}
        <div className="flex justify-center mb-4">
          <TabsList>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
          </TabsList>
        </div>

        {/* Título abaixo das tabs */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-muted-foreground">Gerencie mesas e reservas</p>
        </div>

        <TabsContent value="tables" className="flex-1 m-0">
          <div className="flex h-full gap-4">
            {/* Tables Grid - Layout fixo */}
            <div className="flex flex-col flex-1 lg:w-2/3">
              {/* Legenda */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <div key={status} className="flex items-center gap-2">
                      <div className={cn('w-4 h-4 rounded', statusColors[status as TableStatus])} />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {tables?.map((table) => {
                    const order = getTableOrder(table.id);
                    const reservation = getTableReservation(table.id);
                    const isSelected = selectedTable?.id === table.id;
                    const isOrderReady = order?.status === 'ready';
                    const isOrderDelivered = order?.status === 'delivered' && table.status !== 'available';
                    const isOrderPreparing = order?.status === 'preparing';
                    const isOrderPending = order?.status === 'pending';
                    const currentStation = getOrderCurrentStation(order);
                    
                    // Check for partial payments
                    const tablePaymentInfo = tablePaymentsMap.get(table.id);
                    const hasPartialPayment = tablePaymentInfo && 
                      tablePaymentInfo.totalPaid > 0 && 
                      tablePaymentInfo.totalPaid < tablePaymentInfo.orderTotal;
                    
                    // Calculate wait time
                    const waitMinutes = order?.created_at 
                      ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                      : 0;
                    const waitTimeColor = waitMinutes < 10 ? 'text-green-200' : waitMinutes < 20 ? 'text-yellow-200' : 'text-red-200';
                    
                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          'cursor-pointer transition-all hover:scale-105 relative rounded-lg border-0',
                          statusColors[table.status],
                          isSelected && 'ring-4 ring-sky-400 ring-offset-2'
                        )}
                        onClick={() => handleTableClick(table)}
                      >
                        <CardContent className="p-3 flex flex-col items-center justify-center aspect-square relative">
                          
                          {/* Numero da mesa */}
                          <p className="text-3xl font-bold">{table.number}</p>
                          <p className="text-sm mt-2 font-medium">{statusLabels[table.status]}</p>
                          
                          {/* Indicadores inferiores */}
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                            {hasPartialPayment && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                                PARCIAL
                              </span>
                            )}
                            {order && table.status === 'occupied' && waitMinutes > 0 && (
                              <span className={cn("text-[10px] font-medium", waitTimeColor)}>
                                {waitMinutes}min
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side Panel - Table Details - Sempre visível */}
            <div className="hidden lg:block w-1/3 min-w-[320px]">
              <Card className="h-full flex flex-col">
                {selectedTable ? (
                  <>
                  <CardHeader className="pb-3">
                    {/* Tabs Consumo/Resumo centralizadas no topo */}
                    <div className="flex justify-center mb-3">
                      <div className="flex gap-1 p-1 bg-muted rounded-lg">
                        <Button
                          variant={tableViewMode === 'consumo' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTableViewMode('consumo')}
                        >
                          Consumo
                        </Button>
                        <Button
                          variant={tableViewMode === 'resumo' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTableViewMode('resumo')}
                        >
                          Resumo
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSelectedTable(null)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Mesa {selectedTable.number}
                            <Badge className={cn('text-xs', statusColors[selectedTable.status])}>
                              {statusLabels[selectedTable.status]}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedTable.capacity} lugares
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    {/* ===== ABA CONSUMO ===== */}
                    {tableViewMode === 'consumo' && (
                      <>
                    {/* Delivered Banner - Awaiting bill closure */}
                    {selectedOrder?.status === 'delivered' && !isClosingBill && (
                      <div className="bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 p-4 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5" />
                          <p className="font-medium">Pedido Entregue</p>
                        </div>
                        <p className="text-xs opacity-80">Aguardando fechamento da conta</p>
                        
                        {/* Waiter and time info */}
                        <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-1 text-sm">
                          {selectedOrder.created_by_profile?.name && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Garçom:</span>
                              <span className="font-medium">{selectedOrder.created_by_profile.name}</span>
                            </div>
                          )}
                          {selectedOrder.created_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Lançado às:</span>
                              <span>{format(new Date(selectedOrder.created_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                          {selectedOrder.ready_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Pronto às:</span>
                              <span>{format(new Date(selectedOrder.ready_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                          {selectedOrder.delivered_at && (
                            <div className="flex items-center justify-between">
                              <span className="opacity-70">Entregue às:</span>
                              <span>{format(new Date(selectedOrder.delivered_at), 'HH:mm', { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* REGULAR VIEW - When NOT closing */}
                    {!isClosingBill && (
                      <>
                        {/* Order Items - Consumo tab shows ALL items with individual status */}
                        {(() => {
                          const allItems = selectedOrder?.order_items || [];
                          const hasAnyItems = allItems.length > 0;
                          
                          // Helper function to determine item status
                          const getItemStatus = (item: any) => {
                            if (item.served_at) return 'served';
                            if (item.station_status === 'done' || item.station_status === 'completed') return 'ready';
                            if (item.current_station?.station_type === 'order_status') return 'ready';
                            if (!item.current_station_id && !selectedOrder?.is_draft) return 'ready';
                            if (item.current_station_id && item.current_station) return 'in_production';
                            if (selectedOrder?.status === 'pending' || selectedOrder?.is_draft) return 'pending';
                            return 'in_production';
                          };
                          
                          if (hasAnyItems) {
                            return (
                              <div className="flex-1 flex flex-col min-h-0">
                                <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                                <ScrollArea className="flex-1">
                                  <div className="space-y-2 pr-2">
                                    {allItems.map((item: any) => {
                                      const itemStatus = getItemStatus(item);
                                      
                                      return (
                                        <div 
                                          key={item.id} 
                                          className={`flex flex-col p-2 rounded group transition-colors ${
                                            itemStatus === 'served' 
                                              ? 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700' 
                                              : itemStatus === 'ready'
                                              ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                                              : 'bg-muted/50'
                                          }`}
                                        >
                                          {/* Status Badge Individual */}
                                          {itemStatus === 'pending' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 w-fit animate-pulse-soft">
                                              <Clock className="h-3 w-3" />
                                              Aguardando Produção
                                            </div>
                                          )}
                                          {itemStatus === 'in_production' && item.current_station && (
                                            <div 
                                              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft"
                                              style={{ 
                                                backgroundColor: item.current_station.color ? `${item.current_station.color}20` : 'hsl(var(--primary) / 0.1)',
                                                color: item.current_station.color || 'hsl(var(--primary))'
                                              }}
                                            >
                                              <span>●</span>
                                              {item.current_station.name}
                                            </div>
                                          )}
                                          {itemStatus === 'ready' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 w-fit animate-pulse-soft">
                                              <Bell className="h-3 w-3" />
                                              Pronto para servir
                                            </div>
                                          )}
                                          {itemStatus === 'served' && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-200 dark:bg-green-800/60 text-green-800 dark:text-green-300 w-fit">
                                              <Check className="h-3 w-3" />
                                              Servido
                                            </div>
                                          )}
                                          
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium">
                                                {item.quantity}x {item.product?.name || 'Produto'}
                                                {item.variation?.name && (
                                                  <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                                )}
                                              </p>
                                              {/* Sub-items (pizzas individuais) */}
                                              {item.sub_items && item.sub_items.length > 0 ? (
                                                <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                                  {item.sub_items
                                                    .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                                    .map((subItem: any) => (
                                                    <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                                      <p className="font-medium text-foreground">🍕 Pizza {subItem.sub_item_index + 1}:</p>
                                                      {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                                        <div className="pl-2 space-y-0.5">
                                                          {subItem.sub_extras.map((extra: any, idx: number) => (
                                                            <p key={idx}>• {extra.option_name}</p>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {subItem.notes && (
                                                        <p className="pl-2 italic text-amber-600">📝 {subItem.notes}</p>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                /* Sabores/Complementos tradicionais */
                                                item.extras && item.extras.length > 0 && (
                                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                    {item.extras.map((extra: any, idx: number) => (
                                                      <p key={idx} className="pl-2">
                                                        • {extra.extra_name.split(': ').slice(1).join(': ')}
                                                      </p>
                                                    ))}
                                                  </div>
                                                )
                                              )}
                                              {/* Observações */}
                                              {item.notes && (
                                                <p className="text-xs text-amber-600 mt-1 pl-2 italic">
                                                  📝 {item.notes}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                              {/* Botão Servir Item - Só aparece se pronto e não servido */}
                                              {itemStatus === 'ready' && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="text-xs h-7 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40"
                                                  onClick={() => handleServeOrderItem(item.id)}
                                                  disabled={isServingItem === item.id}
                                                >
                                                  {isServingItem === item.id ? (
                                                    <span className="animate-pulse">...</span>
                                                  ) : (
                                                    <>
                                                      <Check className="h-3 w-3 mr-1" />
                                                      Servir
                                                    </>
                                                  )}
                                                </Button>
                                              )}
                                              {canDeleteItems && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  onClick={() => handleDeleteOrderItem(item.id, item.order_id)}
                                                >
                                                  <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              </div>
                            );
                          } else if (selectedTable.status === 'occupied') {
                            return (
                              <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="text-center text-muted-foreground mb-4">
                                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Nenhum item no pedido</p>
                                </div>
                                {/* Close empty table button */}
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={handleCloseEmptyTable}
                                  disabled={isClosingEmptyTable}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {isClosingEmptyTable ? 'Fechando...' : 'Fechar Mesa (Sem Consumo)'}
                                </Button>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      </>
                    )}
                      </>
                    )}

                    {/* ===== ABA RESUMO ===== */}
                    {tableViewMode === 'resumo' && selectedOrder && !isClosingBill && (
                      <>
                        {/* Informações do Pedido */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Pedido</span>
                            <span className="font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                          </div>
                          {selectedOrder.created_at && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Aberto há</span>
                              <span>{formatDistanceToNow(new Date(selectedOrder.created_at), { locale: ptBR })}</span>
                            </div>
                          )}
                          {/* Garçom que criou o pedido */}
                          {selectedOrder.created_by_profile?.name && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Garçom</span>
                              <span>{selectedOrder.created_by_profile.name}</span>
                            </div>
                          )}
                          {/* Nome do Cliente editável */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Cliente</span>
                            <CustomerNameInput
                              initialValue={selectedOrder.customer_name}
                              onSave={handleSaveCustomerName}
                            />
                          </div>
                        </div>

                        {/* Lista de Itens Completa */}
                        {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                          <div className="flex-1 flex flex-col min-h-0 border-t pt-3 mt-3">
                            <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                            <ScrollArea className="flex-1">
                              <div className="space-y-2 pr-2">
                                {selectedOrder.order_items.map((item: any) => (
                                  <div key={item.id} className="p-2 bg-muted/50 rounded">
                                    <div className="flex justify-between items-start">
                                      <p className="text-sm font-medium">
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                        )}
                                      </p>
                                      <span className="text-sm font-medium ml-2">
                                        {formatCurrency(item.total_price)}
                                      </span>
                                    </div>
                                    {/* Sub-items (pizzas individuais) */}
                                    {item.sub_items && item.sub_items.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                        {item.sub_items
                                          .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                          .map((subItem: any) => (
                                          <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                            <p className="font-medium text-foreground">🍕 Pizza {subItem.sub_item_index + 1}:</p>
                                            {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                              <div className="pl-2 space-y-0.5">
                                                {subItem.sub_extras.map((extra: any, idx: number) => (
                                                  <p key={idx}>• {extra.option_name}</p>
                                                ))}
                                              </div>
                                            )}
                                            {subItem.notes && (
                                              <p className="pl-2 italic text-amber-600">📝 {subItem.notes}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Extras tradicionais */}
                                    {!item.sub_items?.length && item.extras && item.extras.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                        {item.extras.map((extra: any, idx: number) => (
                                          <p key={idx} className="pl-2">• {extra.extra_name.split(': ').slice(1).join(': ')}</p>
                                        ))}
                                      </div>
                                    )}
                                    {/* Observações */}
                                    {item.notes && (
                                      <p className="text-xs text-amber-600 mt-1 pl-2 italic">📝 {item.notes}</p>
                                    )}
                                    {/* Data/hora e garçom */}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 pl-2">
                                      {item.created_at && (
                                        <span>📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                      )}
                                      {item.added_by_profile?.name && (
                                        <span className="text-blue-600">• 👤 {item.added_by_profile.name}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Total */}
                        <div className="border-t pt-3 mt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                          </div>
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="space-y-2 pt-2">
                          {selectedTable.status === 'occupied' && (
                            <>
                              <Button 
                                className="w-full" 
                                onClick={() => setIsAddOrderModalOpen(true)}
                                disabled={isAddingItems}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {isAddingItems ? 'Adicionando...' : 'Adicionar Pedido'}
                              </Button>
                              {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={async () => {
                                    if (!selectedOrder || !selectedTable) return;
                                    const receiptData = propsToReceiptData({
                                      order: selectedOrder,
                                      payments: [],
                                      discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                                      serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                                      splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                                      tableNumber: selectedTable.number,
                                      receiptType: 'summary',
                                    });
                                    const success = await centralPrinting.printCustomerReceipt(receiptData);
                                    if (success) {
                                      toast.success('Resumo da conta enviado para impressão');
                                    } else {
                                      toast.error('Falha ao enviar para impressão');
                                    }
                                  }}
                                >
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Resumo da Conta
                                </Button>
                              )}
                              {canSwitchTable && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => setIsSwitchTableDialogOpen(true)}
                                >
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  Trocar Mesa
                                </Button>
                              )}
                              {/* Fechar Conta */}
                              {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full" 
                                  onClick={handleStartClosing}
                                  disabled={!['ready', 'delivered'].includes(selectedOrder.status)}
                                  title={!['ready', 'delivered'].includes(selectedOrder.status) ? 'Aguardando pedido ficar pronto' : undefined}
                                >
                                  <Receipt className="h-4 w-4 mr-2" />
                                  {['ready', 'delivered'].includes(selectedOrder.status) ? 'Fechar Conta' : 'Aguardando Preparo...'}
                                </Button>
                              )}
                              {/* Cancelar Pedido */}
                              {canCancelOrder && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={() => setIsCancelOrderDialogOpen(true)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancelar Pedido
                                </Button>
                              )}
                            </>
                          )}

                          {selectedTable.status === 'reserved' && (
                            <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                              Liberar Mesa
                            </Button>
                          )}

                          {/* Reabrir pedidos fechados */}
                          {selectedTable.status === 'available' && canReopenTable && (() => {
                            const closedOrders = getClosedTableOrders(selectedTable.id);
                            if (closedOrders.length === 0) return null;
                            return (
                              <div className="space-y-2 pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Pedidos fechados recentemente:</p>
                                {closedOrders.slice(0, 3).map((order) => (
                                  <Button 
                                    key={order.id}
                                    variant="outline" 
                                    className="w-full justify-between"
                                    onClick={() => {
                                      setClosedOrderToReopen(order);
                                      setIsReopenDialogOpen(true);
                                    }}
                                  >
                                    <span className="flex items-center gap-2">
                                      <RotateCcw className="h-4 w-4" />
                                      #{order.id.slice(0, 8)}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(order.total || 0)}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    )}

                    {/* CLOSING VIEW - Payment Flow */}
                    {isClosingBill && selectedOrder && (
                      <>
                        {/* Order Items Summary */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                          <ScrollArea className="flex-1 max-h-[200px]">
                            <div className="space-y-2 pr-2">
                              {selectedOrder.order_items?.map((item: any) => (
                                <div 
                                  key={item.id} 
                                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                                >
                                  <span className="truncate flex-1">
                                    {item.quantity}x {item.product?.name || 'Produto'}
                                  </span>
                                  <span className="font-medium ml-2">
                                    {formatCurrency(item.total_price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Financial Summary with Discount & Service */}
                        <div className="space-y-3 border-t pt-3">
                          {/* Subtotal */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          
                          {/* Discount Section */}
                          <DiscountInput
                            discountType={discountType}
                            discountValue={discountValue}
                            subtotal={subtotal}
                            onChange={(type, value) => {
                              setDiscountType(type);
                              setDiscountValue(value);
                            }}
                          />

                          {/* Service Charge Section */}
                          <ServiceChargeInput
                            enabled={serviceChargeEnabled}
                            percent={serviceChargePercent}
                            afterDiscountTotal={afterDiscount}
                            onEnabledChange={setServiceChargeEnabled}
                            onPercentChange={setServiceChargePercent}
                          />

                          {/* Final Total */}
                          <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(finalTotal)}</span>
                          </div>

                          {/* Resumo por Garçom */}
                          {(() => {
                            const waiterSummary = selectedOrder?.order_items?.reduce((acc, item) => {
                              const waiterName = item.added_by_profile?.name || 'Não identificado';
                              if (!acc[waiterName]) {
                                acc[waiterName] = { count: 0, total: 0 };
                              }
                              acc[waiterName].count += item.quantity;
                              acc[waiterName].total += Number(item.total_price);
                              return acc;
                            }, {} as Record<string, { count: number; total: number }>);

                            const waiterEntries = Object.entries(waiterSummary || {});
                            
                            if (waiterEntries.length <= 1) return null;
                            
                            return (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Resumo por Garçom</span>
                                </div>
                                <div className="space-y-1">
                                  {waiterEntries.map(([name, data]) => (
                                    <div key={name} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">
                                        👤 {name} ({data.count} {data.count === 1 ? 'item' : 'itens'})
                                      </span>
                                      <span className="font-medium">{formatCurrency(data.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bill Splitting Section */}
                        <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Dividir conta</span>
                            </div>
                            <Switch 
                              checked={splitBillEnabled} 
                              onCheckedChange={setSplitBillEnabled}
                            />
                          </div>
                          {splitBillEnabled && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Pessoas:</span>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center font-bold">{splitCount}</span>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => setSplitCount(c => c + 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <RadioGroup 
                                value={splitMode} 
                                onValueChange={(v: 'equal' | 'custom') => setSplitMode(v)}
                                className="flex gap-4"
                              >
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="equal" id="split-equal" />
                                  <Label htmlFor="split-equal" className="text-xs">Divisão igual</Label>
                                </div>
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="custom" id="split-custom" />
                                  <Label htmlFor="split-custom" className="text-xs">Personalizado</Label>
                                </div>
                              </RadioGroup>
                              
                              {splitMode === 'equal' ? (
                                <div className="space-y-1 text-sm">
                                  {splitAmounts.map((amount, i) => (
                                    <div key={i} className="flex justify-between py-1 border-b border-dashed">
                                      <span className="text-muted-foreground">Pessoa {i + 1}</span>
                                      <span className="font-medium">{formatCurrency(amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {customSplits.map((value, i) => (
                                    <CustomSplitInput
                                      key={i}
                                      index={i}
                                      value={value}
                                      onChange={(idx, val) => {
                                        setCustomSplits(prev => {
                                          const updated = [...prev];
                                          updated[idx] = val;
                                          return updated;
                                        });
                                      }}
                                    />
                                  ))}
                                  <div className={cn(
                                    "text-xs text-right",
                                    Math.abs(customSplitsRemaining) < 0.01 ? "text-green-600" : "text-red-500"
                                  )}>
                                    {Math.abs(customSplitsRemaining) < 0.01 
                                      ? "✓ Valores corretos" 
                                      : customSplitsRemaining > 0 
                                        ? `Falta: ${formatCurrency(customSplitsRemaining)}`
                                        : `Excede: ${formatCurrency(Math.abs(customSplitsRemaining))}`
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Print Bill Button */}
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={async () => {
                            if (!selectedOrder || !selectedTable) return;
                            const receiptData = propsToReceiptData({
                              order: selectedOrder,
                              payments: registeredPayments.map(p => ({
                                id: '',
                                order_id: selectedOrder.id,
                                payment_method: p.method,
                                amount: p.amount,
                                cash_register_id: openCashRegister?.id || null,
                                received_by: null,
                                created_at: new Date().toISOString(),
                              })),
                              discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                              serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                              splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                              tableNumber: selectedTable.number,
                            });
                            const success = await centralPrinting.printCustomerReceipt(receiptData);
                            if (success) {
                              toast.success('Conta enviada para impressão');
                            } else {
                              toast.error('Falha ao enviar para impressão');
                            }
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir Conta
                        </Button>

                        {/* Payment Status */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Total pago</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Falta pagar</p>
                            <p className="text-lg font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
                          </div>
                        </div>

                        {/* Payment Method Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {(['cash', 'credit_card', 'debit_card', 'pix'] as PaymentMethod[]).map((method) => (
                            <Button
                              key={method}
                              variant="outline"
                              className="flex items-center gap-2 h-12"
                              onClick={() => handleSelectPaymentMethod(method)}
                              disabled={remainingAmount <= 0}
                            >
                              {paymentMethodIcons[method]}
                              <span className="text-sm">{paymentMethodLabels[method]}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Existing Payments from DB (partial payments already saved) */}
                        {existingPayments && existingPayments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              Pagamentos já registrados
                            </h4>
                            <div className="space-y-1">
                              {existingPayments.map((payment: any) => (
                                <div 
                                  key={payment.id}
                                  className="flex flex-col p-2 bg-green-600/10 rounded text-sm border border-green-600/20"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {paymentMethodIcons[payment.payment_method as PaymentMethod]}
                                      <span>{paymentMethodLabels[payment.payment_method as PaymentMethod]}</span>
                                      {payment.is_partial && (
                                        <Badge variant="outline" className="text-xs">Parcial</Badge>
                                      )}
                                    </div>
                                    <span className="font-medium text-green-600">
                                      {formatCurrency(Number(payment.amount))}
                                    </span>
                                  </div>
                                  {payment.received_by_profile?.name && (
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      Recebido por: {payment.received_by_profile.name}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Session Payments (pending, not saved to DB yet) */}
                        {registeredPayments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Pagamentos pendentes</h4>
                            <div className="space-y-1">
                              {registeredPayments.map((payment, index) => (
                                <div 
                                  key={index}
                                  className="flex items-center justify-between p-2 bg-amber-500/10 rounded text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    {paymentMethodIcons[payment.method]}
                                    <span>{paymentMethodLabels[payment.method]}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-amber-600">
                                      {formatCurrency(payment.amount)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleRemovePayment(index)}
                                    >
                                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Closing Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={handleReopenTable}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Reabrir
                          </Button>
                          <Button 
                            className="flex-1"
                            onClick={() => setConfirmCloseModalOpen(true)}
                            disabled={totalPaid <= 0 && registeredPayments.length === 0}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Finalizar
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                  </>
                ) : (
                  <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Nenhuma mesa selecionada</p>
                    <p className="text-sm text-center">Clique em uma mesa para ver os detalhes</p>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="flex-1 m-0 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Data:</Label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setIsReservationDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
            <ReservationDialog
              open={isReservationDialogOpen}
              onOpenChange={setIsReservationDialogOpen}
              tables={tables || []}
              onConfirm={async (data) => {
                await createReservation.mutateAsync({
                  ...data,
                  status: 'confirmed',
                  created_by: user?.id || null,
                });
                
                if (data.reservation_date === format(new Date(), 'yyyy-MM-dd')) {
                  await updateTable.mutateAsync({ id: data.table_id, status: 'reserved' });
                }
                
                setIsReservationDialogOpen(false);
              }}
              isPending={createReservation.isPending}
            />
          </div>

          {/* Reservations List */}
          <div className="grid gap-4">
            {reservations?.filter(r => r.status === 'confirmed').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma reserva para esta data</p>
                </CardContent>
              </Card>
            ) : (
              reservations?.filter(r => r.status === 'confirmed').map((reservation) => (
                <Card 
                  key={reservation.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{reservation.customer_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {reservation.reservation_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {reservation.party_size} pessoas
                            </span>
                            {reservation.customer_phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {reservation.customer_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Mesa {reservation.table?.number}</p>
                        <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded">
                          {reservationStatusLabels[reservation.status]}
                        </span>
                      </div>
                    </div>
                    {reservation.notes && (
                      <p className="text-sm text-muted-foreground mt-2 pl-16">
                        📝 {reservation.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Open Table Dialog - using optimized component */}
      <OpenTableDialog
        open={isOpenTableDialogOpen}
        onOpenChange={setIsOpenTableDialogOpen}
        table={tableToOpen}
        onConfirm={async (data) => {
          if (!tableToOpen) return;
          
          const tableNumber = tableToOpen.number;
          const tableId = tableToOpen.id;
          
          // Fechar dialog e abrir OrderDrawer IMEDIATAMENTE para feedback visual instantâneo
          setIsOpenTableDialogOpen(false);
          setOpenTableData(data);
          
          // Definir mesa como ocupada ANTES das chamadas assíncronas
          const openedTable = { ...tableToOpen, status: 'occupied' as const };
          setSelectedTable(openedTable);
          
          // Abrir modal de pedido imediatamente após abrir mesa
          if (isMobile) {
            setIsAddingMode(true);
            setIsOrderDrawerOpen(true);
          } else {
            // Desktop: abrir modal grande de adicionar pedido
            setIsAddOrderModalOpen(true);
          }
          
          // Reset all closing states
          setIsClosingBill(false);
          setRegisteredPayments([]);
          setDiscountType('percentage');
          setDiscountValue(0);
          setServiceChargeEnabled(false);
          setServiceChargePercent(10);
          setSplitBillEnabled(false);
          setSplitCount(2);
          setSplitMode('equal');
          setCustomSplits([]);
          
          // Operações de banco em background (não bloqueia a UI)
          setIsOpeningTable(true);
          try {
            await Promise.all([
              updateTable.mutateAsync({ id: tableId, status: 'occupied' }),
              createOrder.mutateAsync({
                table_id: tableId,
                order_type: 'dine_in',
                status: getInitialOrderStatus(),
                customer_name: data.identification || null,
                party_size: data.people || null,
                is_draft: true,
              })
            ]);
            
            toast.success(`Mesa ${tableNumber} aberta!`);
          } catch (error) {
            console.error('Error opening table:', error);
            toast.error('Erro ao abrir mesa');
            // Reverter estado em caso de erro
            setSelectedTable(null);
            setIsAddingMode(false);
            setIsOrderDrawerOpen(false);
          } finally {
            setIsOpeningTable(false);
            setTableToOpen(null);
          }
        }}
        isPending={updateTable.isPending || isOpeningTable}
      />

      {/* Mobile Table Details Dialog */}
      {isMobile && (
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {/* Tabs Consumo/Resumo centralizadas no topo */}
            <div className="flex justify-center mb-3">
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={tableViewMode === 'consumo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTableViewMode('consumo')}
                >
                  Consumo
                </Button>
                <Button
                  variant={tableViewMode === 'resumo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTableViewMode('resumo')}
                >
                  Resumo
                </Button>
              </div>
            </div>
            
            <DialogTitle className="flex items-center gap-2">
              Mesa {selectedTable?.number}
              {selectedTable && (
                <Badge className={cn('text-xs', statusColors[selectedTable.status])}>
                  {isClosingBill ? 'Fechando' : statusLabels[selectedTable.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {/* MOBILE: Regular View */}
          {!isClosingBill && (
            <div className="space-y-4 pt-4">
              {/* ===== ABA CONSUMO - MOBILE ===== */}
              {tableViewMode === 'consumo' && (
                <>
                  
                  {/* Delivered Banner - Mobile */}
                  {selectedOrder?.status === 'delivered' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5" />
                        <p className="font-medium text-sm">Pedido Entregue</p>
                      </div>
                      <p className="text-xs opacity-80">Aguardando fechamento da conta</p>
                      
                      {/* Waiter and time info - Mobile */}
                      <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1 text-xs">
                        {selectedOrder.created_by_profile?.name && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Garçom:</span>
                            <span className="font-medium">{selectedOrder.created_by_profile.name}</span>
                          </div>
                        )}
                        {selectedOrder.created_at && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Lançado às:</span>
                            <span>{format(new Date(selectedOrder.created_at), 'HH:mm', { locale: ptBR })}</span>
                          </div>
                        )}
                        {selectedOrder.ready_at && (
                          <div className="flex items-center justify-between">
                            <span className="opacity-70">Pronto às:</span>
                            <span>{format(new Date(selectedOrder.ready_at), 'HH:mm', { locale: ptBR })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Mobile - Consumo tab shows ALL items with individual status */}
                  {(() => {
                    const allItems = selectedOrder?.order_items || [];
                    const hasAnyItems = allItems.length > 0;
                    
                    // Helper function to determine item status
                    const getItemStatus = (item: any) => {
                      if (item.served_at) return 'served';
                      if (item.station_status === 'done' || item.station_status === 'completed') return 'ready';
                      if (item.current_station?.station_type === 'order_status') return 'ready';
                      if (!item.current_station_id && !selectedOrder?.is_draft) return 'ready';
                      if (item.current_station_id && item.current_station) return 'in_production';
                      if (selectedOrder?.status === 'pending' || selectedOrder?.is_draft) return 'pending';
                      return 'in_production';
                    };
                    
                    if (hasAnyItems) {
                      return (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Itens do Pedido</h4>
                          <div className="max-h-[250px] overflow-y-auto space-y-2">
                            {allItems.map((item: any) => {
                              const itemStatus = getItemStatus(item);
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className={`flex flex-col p-2 rounded text-sm transition-colors ${
                                    itemStatus === 'served' 
                                      ? 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700' 
                                      : itemStatus === 'ready'
                                      ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                                      : 'bg-muted/50'
                                  }`}
                                >
                                  {/* Status Badge Individual - Mobile */}
                                  {itemStatus === 'pending' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 w-fit animate-pulse-soft">
                                      <Clock className="h-3 w-3" />
                                      Aguardando
                                    </div>
                                  )}
                                  {itemStatus === 'in_production' && item.current_station && (
                                    <div 
                                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 w-fit animate-pulse-soft"
                                      style={{ 
                                        backgroundColor: item.current_station.color ? `${item.current_station.color}20` : 'hsl(var(--primary) / 0.1)',
                                        color: item.current_station.color || 'hsl(var(--primary))'
                                      }}
                                    >
                                      <span>●</span>
                                      {item.current_station.name}
                                    </div>
                                  )}
                                  {itemStatus === 'ready' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 w-fit animate-pulse-soft">
                                      <Bell className="h-3 w-3" />
                                      Pronto
                                    </div>
                                  )}
                                  {itemStatus === 'served' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-1.5 bg-green-200 dark:bg-green-800/60 text-green-800 dark:text-green-300 w-fit">
                                      <Check className="h-3 w-3" />
                                      Servido
                                    </div>
                                  )}
                                  
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <span className="font-medium">
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                        )}
                                      </span>
                                      {/* Sub-items (pizzas individuais) */}
                                      {item.sub_items && item.sub_items.length > 0 ? (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                          {item.sub_items
                                            .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                            .map((subItem: any) => (
                                            <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                              <p className="font-medium text-foreground">🍕 Pizza {subItem.sub_item_index + 1}:</p>
                                              {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                                <div className="pl-2 space-y-0.5">
                                                  {subItem.sub_extras.map((extra: any, idx: number) => (
                                                    <p key={idx}>• {extra.option_name}</p>
                                                  ))}
                                                </div>
                                              )}
                                              {subItem.notes && (
                                                <p className="pl-2 italic text-amber-600">📝 {subItem.notes}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        /* Sabores/Complementos tradicionais */
                                        item.extras && item.extras.length > 0 && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {item.extras.map((extra: any, idx: number) => (
                                              <p key={idx} className="pl-2">• {extra.extra_name.split(': ').slice(1).join(': ')}</p>
                                            ))}
                                          </div>
                                        )
                                      )}
                                      {item.notes && (
                                        <p className="text-xs text-amber-600 mt-1 italic">📝 {item.notes}</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-2">
                                      {/* Botão Servir Item - Mobile - Só aparece se pronto */}
                                      {itemStatus === 'ready' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-6 px-2 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                                          onClick={() => handleServeOrderItem(item.id)}
                                          disabled={isServingItem === item.id}
                                        >
                                          {isServingItem === item.id ? (
                                            <span className="animate-pulse">...</span>
                                          ) : (
                                            <>
                                              <Check className="h-3 w-3 mr-1" />
                                              Servir
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {selectedOrder && (!selectedOrder.order_items || selectedOrder.order_items.length === 0) ? (
                    <div className="text-center py-4 space-y-3">
                      <div className="text-muted-foreground">
                        <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum item no pedido</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleCloseEmptyTable}
                        disabled={isClosingEmptyTable}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {isClosingEmptyTable ? 'Fechando...' : 'Fechar Mesa (Sem Consumo)'}
                      </Button>
                    </div>
                  ) : null}

                </>
              )}

              {/* ===== ABA RESUMO - MOBILE ===== */}
              {tableViewMode === 'resumo' && selectedOrder && (
                <>
                  {/* Informações do Pedido */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pedido</span>
                      <span className="font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                    </div>
                    {selectedOrder.created_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Aberto há</span>
                        <span>{formatDistanceToNow(new Date(selectedOrder.created_at), { locale: ptBR })}</span>
                      </div>
                    )}
                    {/* Garçom que criou o pedido */}
                    {selectedOrder.created_by_profile?.name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Garçom</span>
                        <span>{selectedOrder.created_by_profile.name}</span>
                      </div>
                    )}
                    {/* Nome do Cliente editável */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <CustomerNameInput
                        initialValue={selectedOrder.customer_name}
                        onSave={handleSaveCustomerName}
                      />
                    </div>
                  </div>

                  {/* Lista de Itens Completa - Mobile */}
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <h4 className="text-sm font-medium">Itens do Pedido</h4>
                      <div className="max-h-[180px] overflow-y-auto space-y-2">
                        {selectedOrder.order_items.map((item: any) => (
                          <div key={item.id} className="p-2 bg-muted/50 rounded text-sm">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">
                                {item.quantity}x {item.product?.name || 'Produto'}
                                {item.variation?.name && (
                                  <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                )}
                              </span>
                              <span className="font-medium ml-2">
                                {formatCurrency(item.total_price)}
                              </span>
                            </div>
                            {/* Sub-items (pizzas individuais) */}
                            {item.sub_items && item.sub_items.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-1.5">
                                {item.sub_items
                                  .sort((a: any, b: any) => a.sub_item_index - b.sub_item_index)
                                  .map((subItem: any) => (
                                  <div key={subItem.id} className="pl-2 border-l-2 border-primary/30">
                                    <p className="font-medium text-foreground">🍕 Pizza {subItem.sub_item_index + 1}:</p>
                                    {subItem.sub_extras && subItem.sub_extras.length > 0 && (
                                      <div className="pl-2 space-y-0.5">
                                        {subItem.sub_extras.map((extra: any, idx: number) => (
                                          <p key={idx}>• {extra.option_name}</p>
                                        ))}
                                      </div>
                                    )}
                                    {subItem.notes && (
                                      <p className="pl-2 italic text-amber-600">📝 {subItem.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Extras tradicionais */}
                            {!item.sub_items?.length && item.extras && item.extras.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {item.extras.map((extra: any, idx: number) => (
                                  <p key={idx} className="pl-2">• {extra.extra_name.split(': ').slice(1).join(': ')}</p>
                                ))}
                              </div>
                            )}
                            {/* Observações */}
                            {item.notes && (
                              <p className="text-xs text-amber-600 mt-1 pl-2 italic">📝 {item.notes}</p>
                            )}
                            {/* Data/hora e garçom */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 pl-2">
                              {item.created_at && (
                                <span>📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                              )}
                              {item.added_by_profile?.name && (
                                <span className="text-blue-600">• 👤 {item.added_by_profile.name}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                    </div>
                  </div>
                  
                  {/* Botões de ação - Mobile */}
                  <div className="space-y-2 pt-2">
                    {selectedTable?.status === 'occupied' && (
                      <>
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            const currentTable = selectedTable;
                            setSelectedTable(null);
                            setTimeout(() => {
                              setSelectedTable(currentTable);
                              setIsAddingMode(true);
                              setIsOrderDrawerOpen(true);
                            }, 100);
                          }} 
                          disabled={isAddingItems}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {isAddingItems ? 'Adicionando...' : 'Adicionar Pedido'}
                        </Button>
                        {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={async () => {
                              if (!selectedOrder || !selectedTable) return;
                              const receiptData = propsToReceiptData({
                                order: selectedOrder,
                                payments: [],
                                discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                                serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                                splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                                tableNumber: selectedTable.number,
                                receiptType: 'summary',
                              });
                              const success = await centralPrinting.printCustomerReceipt(receiptData);
                              if (success) {
                                toast.success('Resumo da conta enviado para impressão');
                              } else {
                                toast.error('Falha ao enviar para impressão');
                              }
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            Resumo da Conta
                          </Button>
                        )}
                        {canSwitchTable && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => setIsSwitchTableDialogOpen(true)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Trocar Mesa
                          </Button>
                        )}
                        {/* Fechar Conta */}
                        {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={handleStartClosing}
                            disabled={!['ready', 'delivered'].includes(selectedOrder.status)}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            {['ready', 'delivered'].includes(selectedOrder.status) ? 'Fechar Conta' : 'Aguardando Preparo...'}
                          </Button>
                        )}
                        {/* Cancelar Pedido */}
                        {canCancelOrder && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                          <Button 
                            variant="outline" 
                            className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                            onClick={() => setIsCancelOrderDialogOpen(true)}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar Pedido
                          </Button>
                        )}
                      </>
                    )}

                    {selectedTable?.status === 'reserved' && (
                      <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                        Liberar Mesa
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MOBILE: Closing View */}
          {isClosingBill && selectedOrder && (
            <div className="space-y-4 pt-4">
              {/* Order Items Summary */}
              <div className="max-h-[120px] overflow-y-auto space-y-1">
                {selectedOrder.order_items?.map((item: any) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <span className="truncate">{item.quantity}x {item.product?.name || 'Produto'}</span>
                    <span className="font-medium">{formatCurrency(item.total_price)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Summary - Mobile */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="text-red-500">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {serviceChargeEnabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa ({serviceChargePercent}%)</span>
                    <span className="text-green-600">+{formatCurrency(serviceAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Pago</p>
                    <p className="font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Falta</p>
                    <p className="font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'credit_card', 'debit_card', 'pix'] as PaymentMethod[]).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    className="flex items-center gap-2 h-12"
                    onClick={() => handleSelectPaymentMethod(method)}
                    disabled={remainingAmount <= 0}
                  >
                    {paymentMethodIcons[method]}
                    <span className="text-xs">{paymentMethodLabels[method]}</span>
                  </Button>
                ))}
              </div>

              {/* Existing Payments from DB - Mobile */}
              {existingPayments && existingPayments.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Pagamentos registrados
                  </h4>
                  {existingPayments.map((payment: any) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-2 bg-green-600/10 rounded text-sm border border-green-600/20"
                    >
                      <div className="flex items-center gap-2">
                        {paymentMethodIcons[payment.payment_method as PaymentMethod]}
                        <span className="text-xs">{paymentMethodLabels[payment.payment_method as PaymentMethod]}</span>
                        {payment.is_partial && (
                          <Badge variant="outline" className="text-xs">Parcial</Badge>
                        )}
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(Number(payment.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Session Payments - Mobile */}
              {registeredPayments.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Pagamentos pendentes</h4>
                  {registeredPayments.map((payment, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 bg-amber-500/10 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {paymentMethodIcons[payment.method]}
                        <span className="text-xs">{paymentMethodLabels[payment.method]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-amber-600">
                          {formatCurrency(payment.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemovePayment(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleReopenTable}
                >
                  Reabrir
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => setConfirmCloseModalOpen(true)}
                  disabled={totalPaid <= 0 && registeredPayments.length === 0}
                >
                  Finalizar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      )}

      {/* Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserva - {selectedReservation?.customer_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Mesa</p>
                <p className="font-semibold">{selectedReservation?.table?.number}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-semibold">{selectedReservation?.reservation_time.slice(0, 5)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Pessoas</p>
                <p className="font-semibold">{selectedReservation?.party_size}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-semibold">{selectedReservation?.customer_phone || '-'}</p>
              </div>
            </div>
            {selectedReservation?.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="font-medium">{selectedReservation.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedReservation) {
                    cancelReservation.mutate(selectedReservation.id);
                    setSelectedReservation(null);
                  }
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={() => selectedReservation && handleConfirmArrival(selectedReservation)}>
                <Check className="h-4 w-4 mr-2" />
                Cliente Chegou
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Order Items Modal */}
      <AddOrderItemsModal
        open={isAddOrderModalOpen}
        onOpenChange={setIsAddOrderModalOpen}
        onSubmit={handleAddOrderItems}
        tableNumber={selectedTable?.number}
      />

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPaymentMethod && paymentMethodIcons[selectedPaymentMethod]}
              Registrar pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Valor pago em {selectedPaymentMethod && paymentMethodLabels[selectedPaymentMethod]}</Label>
              <Input
                type="text"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0,00"
                className="text-lg font-bold text-center w-full"
                autoFocus
              />
              {selectedPaymentMethod === 'cash' && (
                <p className="text-xs text-muted-foreground text-center">
                  Se o valor for superior a {formatCurrency(remainingAmount)}, o sistema calculará o troco
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Input
                value={paymentObservation}
                onChange={(e) => setPaymentObservation(e.target.value)}
                placeholder="Ex: Cartão final 1234"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <div className="flex gap-2 flex-1 sm:justify-end">
              <Button 
                variant="secondary" 
                onClick={handlePartialPayment}
                disabled={createPayment.isPending}
                className="flex items-center justify-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                Pagar e continuar
              </Button>
              <Button onClick={handleConfirmPayment}>
                Adicionar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal with Change */}
      <Dialog open={confirmCloseModalOpen} onOpenChange={setConfirmCloseModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar mesa {selectedTable?.number}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground">Total do pedido</p>
              <p className="text-2xl font-bold">{formatCurrency(finalTotal)}</p>
              {(discountAmount > 0 || serviceChargeEnabled) && (
                <p className="text-xs text-muted-foreground">
                  Subtotal: {formatCurrency(subtotal)}
                  {discountAmount > 0 && ` - Desconto: ${formatCurrency(discountAmount)}`}
                  {serviceChargeEnabled && ` + Taxa: ${formatCurrency(serviceAmount)}`}
                </p>
              )}
            </div>
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground">Total pago</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            {changeAmount > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(changeAmount)}</p>
              </div>
            )}
            {remainingAmount > 0 && (
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Falta pagar</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmCloseModalOpen(false)}>
              Voltar
            </Button>
            <Button 
              onClick={handleFinalizeBill} 
              disabled={createPayment.isPending || isFinalizingBill}
            >
              {(createPayment.isPending || isFinalizingBill) ? 'Finalizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch Table Dialog */}
      <Dialog open={isSwitchTableDialogOpen} onOpenChange={setIsSwitchTableDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Trocar Mesa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedTable && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Mesa atual</p>
                <p className="text-lg font-bold">Mesa {selectedTable.number}</p>
                {selectedTable.capacity && (
                  <p className="text-sm text-muted-foreground">{selectedTable.capacity} lugares</p>
                )}
              </div>
            )}
            
            <div>
              <Label className="text-sm mb-2 block">Selecione a nova mesa:</Label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
                {tables
                  ?.filter(t => t.id !== selectedTable?.id && t.status === 'available')
                  .map(table => (
                    <Button
                      key={table.id}
                      variant="outline"
                      className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleSwitchTable(table.id)}
                      disabled={isSwitchingTable}
                    >
                      <span className="text-lg font-bold">{table.number}</span>
                      <span className="text-xs opacity-70">{table.capacity}p</span>
                    </Button>
                  ))}
              </div>
              {tables?.filter(t => t.id !== selectedTable?.id && t.status === 'available').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mesa disponível</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsSwitchTableDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen Closed Order Dialog - using optimized component */}
      <ReopenOrderDialog
        open={isReopenDialogOpen}
        onOpenChange={(open) => {
          setIsReopenDialogOpen(open);
          if (!open) {
            setClosedOrderToReopen(null);
          }
        }}
        order={closedOrderToReopen}
        table={selectedTable}
        onConfirm={async (reason) => {
          if (!closedOrderToReopen || !selectedTable) return;
          
          setIsReopening(true);
          try {
            const newStatus = getInitialOrderStatus();
            
            // Record the reopen for audit trail
            await supabase.from('order_reopens').insert({
              order_id: closedOrderToReopen.id,
              table_id: selectedTable.id,
              previous_status: closedOrderToReopen.status,
              new_status: newStatus,
              reopened_by: user?.id,
              order_type: closedOrderToReopen.order_type,
              customer_name: closedOrderToReopen.customer_name,
              total_value: closedOrderToReopen.total,
              reason: reason,
            });

            // Send push notification to managers
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`⚠️ Mesa ${selectedTable.number} reaberta`, {
                  body: `Por: ${user?.user_metadata?.name || user?.email}. Motivo: ${reason}`,
                  tag: 'table-reopen',
                });
              }
            } catch (e) {
              console.error('Push notification error:', e);
            }

            // Try to send email notification
            try {
              await supabase.functions.invoke('send-reopen-notification', {
                body: {
                  orderId: closedOrderToReopen.id,
                  tableNumber: selectedTable.number,
                  userName: user?.user_metadata?.name || user?.email,
                  reason: reason,
                  totalValue: closedOrderToReopen.total,
                }
              });
            } catch (e) {
              console.log('Email notification not sent');
            }
            
            // Reopen the order
            await updateOrder.mutateAsync({
              id: closedOrderToReopen.id,
              status: newStatus,
              updated_at: new Date().toISOString()
            });
            
            // Reopen the table
            await updateTable.mutateAsync({
              id: selectedTable.id,
              status: 'occupied'
            });

            // Update all order items status
            if (closedOrderToReopen.order_items) {
              for (const item of closedOrderToReopen.order_items) {
                await supabase
                  .from('order_items')
                  .update({ status: newStatus })
                  .eq('id', item.id);
              }
            }
            
            toast.success(`Mesa ${selectedTable.number} reaberta com sucesso!`);
            setIsReopenDialogOpen(false);
            setClosedOrderToReopen(null);
            setSelectedTable({ ...selectedTable, status: 'occupied' });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          } catch (error) {
            console.error('Error reopening order:', error);
            toast.error('Erro ao reabrir mesa');
          } finally {
            setIsReopening(false);
          }
        }}
        isReopening={isReopening}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={isCancelOrderDialogOpen}
        onOpenChange={setIsCancelOrderDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={selectedTable && selectedOrder ? `Mesa ${selectedTable.number} - Pedido #${selectedOrder.id.slice(0, 8)}` : undefined}
        isLoading={isCancellingOrder}
      />

      {/* Add Order Modal - Desktop */}
      <Dialog open={isAddOrderModalOpen} onOpenChange={setIsAddOrderModalOpen}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle className="text-xl">Adicionar Pedido - Mesa {selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-4">
            {/* Product Selector - 70% */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              <ProductSelector onAddItem={addToPendingCart} />
            </div>
            {/* Pending Cart Panel - 30% */}
            <div className="w-80 flex-shrink-0 border rounded-lg overflow-hidden">
              <PendingCartPanel
                items={pendingCartItems}
                tableNumber={selectedTable?.number || 0}
                onRemoveItem={removeFromPendingCart}
                onUpdateQuantity={updatePendingCartQuantity}
                onDuplicateItem={duplicatePendingCartItem}
                onConfirm={async () => {
                  await handleSendPendingCartToKitchen();
                  setIsAddOrderModalOpen(false);
                }}
                onCancel={() => {
                  clearPendingCart();
                  setIsAddOrderModalOpen(false);
                }}
                isSubmitting={isAddingItems}
                duplicateItems={duplicateItems}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Order Flow Components */}
      {isMobile && (
        <>
          <OrderDrawer
            open={isOrderDrawerOpen}
            onOpenChange={(open) => {
              setIsOrderDrawerOpen(open);
              if (!open && pendingCartItems.length === 0) {
                setIsAddingMode(false);
              }
            }}
            tableNumber={selectedTable?.number}
            onAddItem={addToPendingCart}
            pendingItemsCount={pendingCartItems.length}
            cartItems={pendingCartItems}
            onCartClick={() => setIsCartReviewOpen(true)}
          />

          <CartReviewSheet
            open={isCartReviewOpen}
            onOpenChange={setIsCartReviewOpen}
            items={pendingCartItems}
            tableNumber={selectedTable?.number}
            onRemoveItem={removeFromPendingCart}
            onUpdateQuantity={updatePendingCartQuantity}
            onDuplicateItem={duplicatePendingCartItem}
            onConfirm={handleSendPendingCartToKitchen}
            onClearAll={clearPendingCart}
            isSubmitting={isAddingItems}
            duplicateItems={duplicateItems}
          />
        </>
      )}
    </PDVLayout>
  );
}
