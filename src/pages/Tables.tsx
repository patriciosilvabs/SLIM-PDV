import { useState, useRef, useEffect, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
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
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check, ChevronLeft, ShoppingBag, Bell, Banknote, Smartphone, ArrowLeft, Trash2, Tag, Percent, UserPlus, Minus, ArrowRightLeft, Edit, XCircle, Printer, RotateCcw, Ban, ArrowRight, Wallet } from 'lucide-react';
import { printKitchenOrderTicket } from '@/components/kitchen/KitchenOrderTicket';
import { printCustomerReceipt, printPartialPaymentReceipt } from '@/components/receipt/CustomerReceipt';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { KitchenTicketData, CancellationTicketData } from '@/utils/escpos';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useProfile } from '@/hooks/useProfile';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const statusLabels: Record<TableStatus, string> = {
  available: 'Livre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  bill_requested: 'Conta Pedida',
};

const statusColors: Record<TableStatus, string> = {
  available: 'bg-accent hover:bg-accent/90 text-accent-foreground',
  occupied: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  reserved: 'bg-warning hover:bg-warning/90 text-warning-foreground',
  bill_requested: 'bg-info hover:bg-info/90 text-info-foreground',
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
  const { autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket } = useOrderSettings();
  const printer = usePrinterOptional();
  const { data: printSectors } = usePrintSectors();
  const { profile } = useProfile();
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready', 'delivered']);
  const { data: allOrders } = useOrders(['pending', 'preparing', 'ready', 'delivered', 'cancelled']);
  const { createTable, updateTable } = useTableMutations();
  const { createOrder, updateOrder, addOrderItem, addOrderItemExtras } = useOrderMutations();
  
  // Cash register hooks
  const { data: openCashRegister } = useOpenCashRegister();
  const { createPayment } = useCashRegisterMutations();
  
  // Refs for tracking order status changes
  const previousOrdersRef = useRef<Order[]>([]);
  const tableWaitAlertCooldownRef = useRef<Map<string, number>>(new Map());
  const idleTableCooldownRef = useRef<Map<string, number>>(new Map());
  const notifiedReadyOrdersRef = useRef<Set<string>>(new Set());
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: reservations } = useReservations(selectedDate);
  const { createReservation, cancelReservation, updateReservation } = useReservationMutations();
  
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [isOpenTableDialogOpen, setIsOpenTableDialogOpen] = useState(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [openTableData, setOpenTableData] = useState({ people: 2, identification: '' });
  const [newReservation, setNewReservation] = useState({
    table_id: '',
    customer_name: '',
    customer_phone: '',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    reservation_time: '19:00',
    party_size: 2,
    notes: '',
  });

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

  // Customer name editing states
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [editedCustomerName, setEditedCustomerName] = useState('');

  // Reopen table states
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [closedOrderToReopen, setClosedOrderToReopen] = useState<Order | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Cancel order states
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const MIN_REASON_LENGTH = 10;

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
            
            // Update cooldown
            tableWaitAlertCooldownRef.current.set(order.id, now);
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
        // Scenario 1: Order WITHOUT items (empty)
        const emptyOrder = orders.find(o => 
          o.table_id === table.id && 
          o.status !== 'delivered' && 
          o.status !== 'cancelled' &&
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
    const table = tables?.find(t => t.id === tableId);
    // Se a mesa está livre, não retorna pedidos 'delivered'
    return orders?.find(o => 
      o.table_id === tableId && 
      o.status !== 'cancelled' &&
      (table?.status !== 'available' || o.status !== 'delivered')
    );
  };

  // Mark order as delivered
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

  // Handle reopening a closed order
  const handleReopenClosedOrder = async () => {
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
        reason: reopenReason,
      });

      // Send push notification to managers
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`⚠️ Mesa ${selectedTable.number} reaberta`, {
            body: `Por: ${user?.user_metadata?.name || user?.email}. Motivo: ${reopenReason}`,
            tag: 'table-reopen',
          });
        }
      } catch (e) {
        console.error('Push notification error:', e);
      }

      // Try to send email notification (will fail silently if RESEND_API_KEY not configured)
      try {
        await supabase.functions.invoke('send-reopen-notification', {
          body: {
            orderId: closedOrderToReopen.id,
            tableNumber: selectedTable.number,
            userName: user?.user_metadata?.name || user?.email,
            reason: reopenReason,
            totalValue: closedOrderToReopen.total,
          }
        });
      } catch (e) {
        console.log('Email notification not sent (RESEND_API_KEY may not be configured)');
      }
      
      // Reopen the order (set status back to preparing)
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
      setReopenReason('');
      setSelectedTable({ ...selectedTable, status: 'occupied' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error) {
      console.error('Error reopening order:', error);
      toast.error('Erro ao reabrir mesa');
    } finally {
      setIsReopening(false);
    }
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
    if (table.status === 'available') {
      setTableToOpen(table);
      setOpenTableData({ people: table.capacity || 2, identification: '' });
      setIsOpenTableDialogOpen(true);
    } else {
      setSelectedTable(table);
    }
  };

  const handleOpenTable = async () => {
    if (!tableToOpen) return;
    
    await updateTable.mutateAsync({ id: tableToOpen.id, status: 'occupied' });
    await createOrder.mutateAsync({
      table_id: tableToOpen.id,
      order_type: 'dine_in',
      status: getInitialOrderStatus(),
      customer_name: openTableData.identification || null,
      notes: openTableData.people ? `${openTableData.people} pessoas` : null,
      is_draft: true, // Order starts as draft until items are added
    });
    
    setIsOpenTableDialogOpen(false);
    setSelectedTable({ ...tableToOpen, status: 'occupied' });
    setTableToOpen(null);
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
    
    const order = getTableOrder(selectedTable.id);
    if (!order) return;

    // O trigger auto_initialize_new_order_item cuidará de:
    // 1. Atribuir estação KDS ao item
    // 2. Mudar status do pedido de 'delivered' para 'preparing' automaticamente

    for (const item of items) {
      const orderItem = await addOrderItem.mutateAsync({
        order_id: order.id,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
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
    }

    // Mark order as no longer draft - now it can appear in KDS
    if (order.is_draft) {
      await updateOrder.mutateAsync({
        id: order.id,
        is_draft: false
      });
    }

    // Auto-print kitchen ticket if enabled - with detailed logging
    console.log('[Print Debug] Checking auto-print conditions:', {
      autoPrintKitchenTicket,
      printerExists: !!printer,
      canPrintToKitchen: printer?.canPrintToKitchen,
      selectedTable: selectedTable?.number,
    });
    
    if (!autoPrintKitchenTicket) {
      console.log('[Print Debug] Auto-print disabled in settings');
      // Only show info toast occasionally, not every time
    } else if (!printer) {
      console.log('[Print Debug] Printer context not available');
      toast.info('Impressora não configurada. Configure em Configurações → Impressão.');
    } else if (!printer.canPrintToKitchen) {
      console.log('[Print Debug] Printer cannot print to kitchen');
      toast.info('Impressora não conectada. Verifique QZ Tray.');
    } else if (selectedTable) {
      try {
        // Check if we have active sectors with printers configured
        const activeSectors = (printSectors || []).filter(s => s?.is_active !== false && s?.printer_name);
        
        console.log('[Print Debug] Active sectors:', activeSectors.length);
        
        if (activeSectors.length > 0) {
          // Use sector-based printing
          const sectorItems: SectorPrintItem[] = items.map(item => ({
            quantity: item.quantity,
            productName: item.product_name,
            variation: item.variation_name,
            extras: item.complements?.map(c => c.option_name),
            notes: item.notes,
            print_sector_id: item.print_sector_id,
          }));
          
          await printer.printKitchenTicketsBySector(
            sectorItems,
            {
              orderNumber: order.id.slice(0, 8).toUpperCase(),
              orderType: 'dine_in',
              tableNumber: selectedTable.number,
              customerName: order.customer_name || undefined,
              notes: order.notes || undefined,
              createdAt: new Date().toISOString(),
            },
            activeSectors,
            duplicateKitchenTicket
          );
          
          toast.success('🖨️ Comandas impressas por setor');
        } else {
          // Fallback: use default kitchen printer
          const ticketData: KitchenTicketData = {
            orderNumber: order.id.slice(0, 8).toUpperCase(),
            orderType: 'dine_in',
            tableNumber: selectedTable.number,
            customerName: order.customer_name || undefined,
            items: items.map(item => ({
              quantity: item.quantity,
              productName: item.product_name,
              variation: item.variation_name,
              extras: item.complements?.map(c => c.option_name),
              notes: item.notes,
            })),
            notes: order.notes || undefined,
            createdAt: new Date().toISOString(),
          };
          
          await printer.printKitchenTicket(ticketData);
          
          // Print duplicate for waiter if enabled
          if (duplicateKitchenTicket) {
            await printer.printKitchenTicket(ticketData);
          }
          
          toast.success(duplicateKitchenTicket ? '🖨️ Comandas impressas (2x)' : '🖨️ Comanda impressa automaticamente');
        }
      } catch (err) {
        console.error('[Print Debug] Auto print failed:', err);
        toast.error('Erro ao imprimir comanda. Verifique a impressora.');
      }
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

  // Save edited customer name
  const handleSaveCustomerName = async () => {
    if (!selectedOrder) return;
    try {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        customer_name: editedCustomerName.trim() || null
      });
      toast.success('Nome do cliente atualizado');
      setIsEditingCustomerName(false);
    } catch (error) {
      toast.error('Erro ao atualizar nome');
    }
  };

  // Close empty table (no consumption)
  const handleCloseEmptyTable = async () => {
    if (!selectedTable || !selectedOrder) return;
    try {
      await updateOrder.mutateAsync({ id: selectedOrder.id, status: 'cancelled' });
      await updateTable.mutateAsync({ id: selectedTable.id, status: 'available' });
      toast.success(`Mesa ${selectedTable.number} fechada (sem consumo)`);
      setSelectedTable(null);
    } catch (error) {
      toast.error('Erro ao fechar mesa');
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

  const handleCreateReservation = async () => {
    if (!newReservation.table_id || !newReservation.customer_name) return;
    
    await createReservation.mutateAsync({
      ...newReservation,
      status: 'confirmed',
      created_by: user?.id || null,
    });
    
    if (newReservation.reservation_date === format(new Date(), 'yyyy-MM-dd')) {
      await updateTable.mutateAsync({ id: newReservation.table_id, status: 'reserved' });
    }
    
    setIsReservationDialogOpen(false);
    setNewReservation({
      table_id: '',
      customer_name: '',
      customer_phone: '',
      reservation_date: format(new Date(), 'yyyy-MM-dd'),
      reservation_time: '19:00',
      party_size: 2,
      notes: '',
    });
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

  // Fetch existing partial payments for the selected order WITH receiver profile
  const { data: existingPayments } = useQuery({
    queryKey: ['payments', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          received_by_profile:profiles!payments_received_by_fkey(id, name)
        `)
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
      // Reset customer name editing
      setIsEditingCustomerName(false);
      setEditedCustomerName('');
    } else {
      setIsClosingBill(false);
      setRegisteredPayments([]);
      setIsEditingCustomerName(false);
      setEditedCustomerName('');
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
    
    setIsClosingBill(true);
    await updateTable.mutateAsync({ id: selectedTable.id, status: 'bill_requested' });
    setSelectedTable({ ...selectedTable, status: 'bill_requested' });
    
    // Auto-print bill summary when clicking "Fechar Conta"
    if (order && printer?.canPrintToCashier) {
      try {
        await printCustomerReceipt({
          order,
          payments: [],
          discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
          serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
          splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
          tableNumber: selectedTable.number,
          receiptType: 'summary',
        }, printer);
        toast.success('Resumo da conta impresso');
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
  
  // Update custom split value
  const handleCustomSplitChange = (index: number, value: string) => {
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    setCustomSplits(prev => {
      const updated = [...prev];
      updated[index] = numValue;
      return updated;
    });
  };

  // Remove a registered payment
  const handleRemovePayment = (index: number) => {
    setRegisteredPayments(prev => prev.filter((_, i) => i !== index));
  };

  // Finalize bill closing
  const handleFinalizeBill = async () => {
    if (!selectedOrder || !selectedTable) return;
    
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
        // Update order status to delivered
        await supabase
          .from('orders')
          .update({ status: 'delivered' })
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
      if (autoPrintCustomerReceipt && printer?.canPrintToCashier) {
        try {
          await printCustomerReceipt({
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
          }, printer);
          toast.success('Cupom fiscal impresso');
        } catch (err) {
          console.error('Auto print receipt failed:', err);
        }
      }
      
      // Clear state and close
      setIsClosingBill(false);
      setRegisteredPayments([]);
      setConfirmCloseModalOpen(false);
      setSelectedTable(null);
      
      toast.success(`Mesa ${selectedTable.number} fechada com sucesso!`);
    } catch (error) {
      console.error('Error finalizing bill:', error);
      toast.error('Erro ao finalizar conta');
    }
  };

  return (
    <PDVLayout>
      <Tabs defaultValue="tables" className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Mesas</h1>
            <p className="text-muted-foreground">Gerencie mesas e reservas</p>
          </div>
          <TabsList>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tables" className="flex-1 m-0">
          <div className="flex h-full gap-4">
            {/* Tables Grid */}
            <div className={cn("flex-1 flex flex-col", selectedTable && "lg:w-2/3")}>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                          'cursor-pointer transition-all hover:scale-105 relative',
                          statusColors[table.status],
                          isSelected && 'ring-2 ring-primary ring-offset-2',
                          isOrderReady && 'ring-2 ring-green-500 ring-offset-2 animate-pulse',
                          isOrderDelivered && !isOrderReady && 'ring-2 ring-blue-500 ring-offset-2',
                          isOrderPreparing && !isOrderReady && !isOrderDelivered && 'ring-2 ring-amber-500 ring-offset-2',
                          hasPartialPayment && !isOrderReady && !isOrderDelivered && !isOrderPreparing && 'ring-2 ring-orange-500 ring-offset-2'
                        )}
                        onClick={() => handleTableClick(table)}
                      >
                        {/* Partial Payment Badge */}
                        {hasPartialPayment && !isOrderReady && (
                          <div className="absolute -top-2 -left-2 z-10">
                            <Badge className="bg-orange-500 text-white shadow-lg text-[10px] px-1.5">
                              <Wallet className="h-3 w-3 mr-0.5" />
                              {formatCurrency(tablePaymentInfo.totalPaid)}
                            </Badge>
                          </div>
                        )}
                        {isOrderPending && !isOrderReady && !isOrderDelivered && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-yellow-500 text-white shadow-lg text-[10px]">
                              <Clock className="h-3 w-3 mr-1" />
                              Aguardando
                            </Badge>
                          </div>
                        )}
                        {isOrderPreparing && !isOrderReady && !isOrderDelivered && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge 
                              className="shadow-lg animate-pulse text-[10px] text-white"
                              style={{ backgroundColor: currentStation?.color || '#f59e0b' }}
                            >
                              🍳 {currentStation?.name || 'Produzindo'}
                            </Badge>
                          </div>
                        )}
                        {isOrderReady && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-green-500 text-white shadow-lg animate-bounce">
                              <Bell className="h-3 w-3 mr-1" />
                              Pronto!
                            </Badge>
                          </div>
                        )}
                        {isOrderDelivered && !isOrderReady && table.status !== 'available' && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-blue-500 text-white shadow-lg">
                              <Check className="h-3 w-3 mr-1" />
                              Entregue
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-4 text-center">
                          <p className="text-3xl font-bold mb-1">{table.number}</p>
                          <div className="flex items-center justify-center gap-1 text-sm opacity-90">
                            <Users className="h-4 w-4" />
                            <span>{table.capacity}</span>
                          </div>
                          <p className="text-xs mt-2 font-medium">{statusLabels[table.status]}</p>
                          {order && table.status !== 'available' && (
                            <p className="text-xs mt-1 opacity-75">
                              {order.order_items?.length || 0} itens
                            </p>
                          )}
                          {/* Wait time indicator for occupied tables */}
                          {order && table.status === 'occupied' && order.status !== 'delivered' && waitMinutes > 0 && (
                            <div className={cn("text-xs mt-1 font-medium flex items-center justify-center gap-1", waitTimeColor)}>
                              <Clock className="h-3 w-3" />
                              {waitMinutes >= 60 ? `${Math.floor(waitMinutes / 60)}h ${waitMinutes % 60}min` : `${waitMinutes}min`}
                            </div>
                          )}
                          {/* Partial Payment Info */}
                          {hasPartialPayment && (
                            <div className="text-xs mt-1 text-orange-200 font-medium">
                              Falta: {formatCurrency(tablePaymentInfo.orderTotal - tablePaymentInfo.totalPaid)}
                            </div>
                          )}
                          {reservation && (
                            <p className="text-xs mt-1 opacity-75">
                              {reservation.reservation_time.slice(0, 5)} - {reservation.customer_name}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side Panel - Table Details */}
            {selectedTable && (
              <div className="hidden lg:block w-1/3 min-w-[320px]">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3">
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
                    {/* Pending Banner - Awaiting production */}
                    {selectedOrder?.status === 'pending' && !isClosingBill && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 p-3 rounded-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <div>
                          <p className="font-medium">Aguardando Produção</p>
                          <p className="text-xs opacity-80">O pedido ainda não entrou na cozinha</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Preparing Banner - In production */}
                    {selectedOrder?.status === 'preparing' && !isClosingBill && (() => {
                      const selectedStation = getOrderCurrentStation(selectedOrder);
                      return (
                        <div 
                          className="p-3 rounded-lg flex items-center gap-2 animate-pulse border"
                          style={{ 
                            backgroundColor: selectedStation?.color ? `${selectedStation.color}1a` : 'rgba(245, 158, 11, 0.1)',
                            borderColor: selectedStation?.color ? `${selectedStation.color}4d` : 'rgba(245, 158, 11, 0.3)',
                            color: selectedStation?.color || '#f59e0b'
                          }}
                        >
                          <span className="text-xl">🍳</span>
                          <div>
                            <p className="font-medium">{selectedStation?.name || 'Em Produção'}</p>
                            <p className="text-xs opacity-80">A cozinha está preparando o pedido</p>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Ready Alert Banner - Clickable to mark as delivered */}
                    {selectedOrder?.status === 'ready' && !isClosingBill && (
                      <button 
                        onClick={() => handleMarkAsDelivered(selectedOrder.id)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-5 w-5 animate-pulse group-hover:animate-none" />
                          <div className="text-left">
                            <p className="font-bold">Pedido Pronto!</p>
                            <p className="text-xs opacity-90">A cozinha finalizou o preparo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                          <Check className="h-4 w-4" />
                          <span className="font-medium text-sm">Marcar Entregue</span>
                        </div>
                      </button>
                    )}
                    
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
                        {/* Order Info */}
                        {selectedOrder && (
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
                            {/* Waiter who created the order */}
                            {selectedOrder.created_by_profile?.name && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Garçom</span>
                                <span>{selectedOrder.created_by_profile.name}</span>
                              </div>
                            )}
                            {/* Editable Customer Name */}
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Cliente</span>
                              {isEditingCustomerName ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editedCustomerName}
                                    onChange={(e) => setEditedCustomerName(e.target.value)}
                                    className="h-7 w-32 text-sm"
                                    placeholder="Nome do cliente"
                                    autoFocus
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveCustomerName}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingCustomerName(false)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span>{selectedOrder.customer_name || '-'}</span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditedCustomerName(selectedOrder.customer_name || '');
                                      setIsEditingCustomerName(true);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Order Items */}
                        {selectedOrder && selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                          <div className="flex-1 flex flex-col min-h-0">
                            <h4 className="text-sm font-medium mb-2">Itens do Pedido</h4>
                            <ScrollArea className="flex-1">
                              <div className="space-y-2 pr-2">
                                {selectedOrder.order_items.map((item: any) => (
                                  <div 
                                    key={item.id} 
                                    className="flex items-start justify-between p-2 bg-muted/50 rounded group"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">
                                        {item.quantity}x {item.product?.name || 'Produto'}
                                        {item.variation?.name && (
                                          <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                                        )}
                                      </p>
                                      {/* Sabores/Complementos */}
                                      {item.extras && item.extras.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                          {item.extras.map((extra: any, idx: number) => (
                                            <p key={idx} className="pl-2">
                                              • {extra.extra_name.split(': ').slice(1).join(': ')}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {/* Observações */}
                                      {item.notes && (
                                        <p className="text-xs text-amber-600 mt-1 pl-2 italic">
                                          📝 {item.notes}
                                        </p>
                                      )}
                                      {/* Data/Hora de criação do item */}
                                      {item.created_at && (
                                        <p className="text-xs text-muted-foreground mt-1 pl-2">
                                          📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <span className="text-sm font-medium">
                                        {formatCurrency(item.total_price)}
                                      </span>
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
                                ))}
                              </div>
                            </ScrollArea>

                            <div className="border-t pt-3 mt-3">
                              <div className="flex items-center justify-between text-lg font-bold">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                              </div>
                            </div>
                          </div>
                        ) : selectedTable.status === 'occupied' ? (
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
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Fechar Mesa (Sem Consumo)
                            </Button>
                          </div>
                        ) : null}

                        {/* Regular Actions */}
                        <div className="space-y-2 pt-2">
                          {selectedTable.status === 'occupied' && (
                            <>
                              <Button 
                                className="w-full" 
                                onClick={() => setIsAddOrderModalOpen(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Pedido
                              </Button>
                              {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button 
                                  variant="outline" 
                                  className="w-full"
                                  onClick={() => {
                                    if (!selectedOrder || !selectedTable) return;
                                    printCustomerReceipt({
                                      order: selectedOrder,
                                      payments: [],
                                      discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : undefined,
                                      serviceCharge: serviceChargeEnabled ? { enabled: true, percent: serviceChargePercent, amount: serviceAmount } : undefined,
                                      splitBill: splitBillEnabled ? { enabled: true, count: splitCount, amountPerPerson: finalTotal / splitCount } : undefined,
                                      tableNumber: selectedTable.number,
                                      receiptType: 'summary',
                                    }, printer);
                                    toast.success('Resumo da conta impresso');
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
                              {/* Only show Fechar Conta if there are items and permission */}
                              {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button variant="outline" className="w-full" onClick={handleStartClosing}>
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Fechar Conta
                                </Button>
                              )}
                              {/* Cancel Order button - only show when order has items */}
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

                          {/* Reopen button for available tables with closed orders */}
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
                          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Desconto</span>
                              </div>
                              <Switch 
                                checked={discountValue > 0} 
                                onCheckedChange={(checked) => setDiscountValue(checked ? 10 : 0)}
                              />
                            </div>
                            {discountValue > 0 && (
                              <div className="space-y-2">
                                <RadioGroup 
                                  value={discountType} 
                                  onValueChange={(v: 'percentage' | 'fixed') => setDiscountType(v)}
                                  className="flex gap-4"
                                >
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem value="percentage" id="discount-pct" />
                                    <Label htmlFor="discount-pct" className="text-xs">Percentual</Label>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem value="fixed" id="discount-fix" />
                                    <Label htmlFor="discount-fix" className="text-xs">Valor fixo</Label>
                                  </div>
                                </RadioGroup>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    className="h-8 w-20"
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    {discountType === 'percentage' ? '%' : 'R$'}
                                  </span>
                                  <span className="text-sm text-red-500 ml-auto">
                                    -{formatCurrency(discountAmount)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Service Charge Section */}
                          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Percent className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Taxa de serviço</span>
                              </div>
                              <Switch 
                                checked={serviceChargeEnabled} 
                                onCheckedChange={setServiceChargeEnabled}
                              />
                            </div>
                            {serviceChargeEnabled && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={serviceChargePercent}
                                  onChange={(e) => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                                  className="h-8 w-20"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                                <span className="text-sm text-green-600 ml-auto">
                                  +{formatCurrency(serviceAmount)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Final Total */}
                          <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">{formatCurrency(finalTotal)}</span>
                          </div>
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
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-16">Pessoa {i + 1}</span>
                                      <span className="text-muted-foreground">R$</span>
                                      <Input
                                        type="number"
                                        value={value || ''}
                                        onChange={(e) => handleCustomSplitChange(i, e.target.value)}
                                        className="h-8 flex-1"
                                        placeholder="0,00"
                                      />
                                    </div>
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
                          onClick={() => {
                            if (!selectedOrder || !selectedTable) return;
                            printCustomerReceipt({
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
                            }, printer);
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
                </Card>
              </div>
            )}
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
            <Dialog open={isReservationDialogOpen} onOpenChange={setIsReservationDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Reserva
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Reserva</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Mesa</Label>
                    <Select 
                      value={newReservation.table_id}
                      onValueChange={(value) => setNewReservation({ ...newReservation, table_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma mesa" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables?.filter(t => t.status === 'available').map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            Mesa {table.number} ({table.capacity} lugares)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={newReservation.reservation_date}
                        onChange={(e) => setNewReservation({ ...newReservation, reservation_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Select 
                        value={newReservation.reservation_time}
                        onValueChange={(value) => setNewReservation({ ...newReservation, reservation_time: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input
                      value={newReservation.customer_name}
                      onChange={(e) => setNewReservation({ ...newReservation, customer_name: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        value={newReservation.customer_phone}
                        onChange={(e) => setNewReservation({ ...newReservation, customer_phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pessoas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newReservation.party_size}
                        onChange={(e) => setNewReservation({ ...newReservation, party_size: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={newReservation.notes}
                      onChange={(e) => setNewReservation({ ...newReservation, notes: e.target.value })}
                      placeholder="Ex: aniversário, cadeira para bebê..."
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleCreateReservation}
                    disabled={!newReservation.table_id || !newReservation.customer_name || createReservation.isPending}
                  >
                    Criar Reserva
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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

      {/* Open Table Dialog */}
      <Dialog open={isOpenTableDialogOpen} onOpenChange={setIsOpenTableDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Mesa {tableToOpen?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Quantidade de Pessoas</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setOpenTableData(d => ({ ...d, people: Math.max(1, d.people - 1) }))}
                >
                  <span className="text-lg">-</span>
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{openTableData.people}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setOpenTableData(d => ({ ...d, people: d.people + 1 }))}
                >
                  <span className="text-lg">+</span>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Identificação (opcional)</Label>
              <Input
                value={openTableData.identification}
                onChange={(e) => setOpenTableData({ ...openTableData, identification: e.target.value })}
                placeholder="Nome do cliente ou observação"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpenTableDialogOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleOpenTable} disabled={updateTable.isPending}>
              Abrir Mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Table Details Dialog */}
      {isMobile && (
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
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
              {/* Ready Alert Banner - Mobile */}
              {selectedOrder?.status === 'ready' && (
                <button 
                  onClick={() => handleMarkAsDelivered(selectedOrder.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 animate-pulse" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Pedido Pronto!</p>
                      <p className="text-xs opacity-90">Clique para marcar como entregue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded">
                    <Check className="h-4 w-4" />
                  </div>
                </button>
              )}
              
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
              {selectedOrder && selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Itens do Pedido</h4>
                  <div className="max-h-[180px] overflow-y-auto space-y-2">
                    {selectedOrder.order_items.map((item: any) => (
                      <div 
                        key={item.id} 
                        className="p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="font-medium">
                              {item.quantity}x {item.product?.name || 'Produto'}
                              {item.variation?.name && (
                                <span className="text-muted-foreground font-normal"> - {item.variation.name}</span>
                              )}
                            </span>
                            {/* Sabores/Complementos */}
                            {item.extras && item.extras.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.extras.map((extra: any, idx: number) => (
                                  <p key={idx} className="pl-2">• {extra.extra_name.split(': ').slice(1).join(': ')}</p>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-xs text-amber-600 mt-1 italic">📝 {item.notes}</p>
                            )}
                            {/* Data/Hora de criação do item */}
                            {item.created_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📅 {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                          <span className="font-medium ml-2">{formatCurrency(item.total_price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(selectedOrder.total || 0)}</span>
                  </div>
                </div>
              ) : selectedOrder && (!selectedOrder.order_items || selectedOrder.order_items.length === 0) ? (
                <div className="text-center py-4 space-y-3">
                  <div className="text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum item no pedido</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleCloseEmptyTable}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Fechar Mesa (Sem Consumo)
                  </Button>
                </div>
              ) : null}

              {selectedTable?.status === 'occupied' && (
                <>
                  <Button className="w-full" onClick={() => setIsAddOrderModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Pedido
                  </Button>
                  {canCloseBill && selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                    <Button variant="outline" className="w-full" onClick={handleStartClosing}>
                      <Receipt className="h-4 w-4 mr-2" />
                      Fechar Conta
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
        <DialogContent className="max-w-sm">
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
                className="text-lg font-bold text-center"
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
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)} className="sm:flex-none">
              Cancelar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button 
                variant="secondary" 
                onClick={handlePartialPayment}
                disabled={createPayment.isPending}
                className="flex items-center gap-2"
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
              disabled={createPayment.isPending}
            >
              {createPayment.isPending ? 'Finalizando...' : 'Confirmar'}
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

      {/* Reopen Closed Order Dialog */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reabrir Mesa {selectedTable?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {closedOrderToReopen && (
              <>
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pedido</span>
                    <span className="font-mono">#{closedOrderToReopen.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Itens</span>
                    <span>{closedOrderToReopen.order_items?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold">{formatCurrency(closedOrderToReopen.total || 0)}</span>
                  </div>
                  {closedOrderToReopen.customer_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <span>{closedOrderToReopen.customer_name}</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-warning">Atenção</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Ao reabrir a mesa, o pedido voltará para produção e você poderá adicionar ou remover itens.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Motivo da Reabertura *</Label>
                  <Textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Descreva o motivo da reabertura (mín. 10 caracteres)"
                    className={cn(
                      reopenReason.length > 0 && reopenReason.length < MIN_REASON_LENGTH
                        ? "border-destructive"
                        : ""
                    )}
                  />
                  <p className={cn(
                    "text-xs",
                    reopenReason.length < MIN_REASON_LENGTH ? "text-muted-foreground" : "text-accent"
                  )}>
                    {reopenReason.length}/{MIN_REASON_LENGTH} caracteres mínimos
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsReopenDialogOpen(false);
                setClosedOrderToReopen(null);
                setReopenReason('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleReopenClosedOrder}
              disabled={isReopening || reopenReason.length < MIN_REASON_LENGTH}
            >
              {isReopening ? 'Reabrindo...' : 'Reabrir Mesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={isCancelOrderDialogOpen}
        onOpenChange={setIsCancelOrderDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={selectedTable && selectedOrder ? `Mesa ${selectedTable.number} - Pedido #${selectedOrder.id.slice(0, 8)}` : undefined}
        isLoading={isCancellingOrder}
      />
    </PDVLayout>
  );
}
