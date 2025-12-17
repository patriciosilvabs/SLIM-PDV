import { useState, useRef, useEffect, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
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
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useReservations, useReservationMutations, Reservation } from '@/hooks/useReservations';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { AddOrderItemsModal, CartItem } from '@/components/order/AddOrderItemsModal';
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check, ChevronLeft, ShoppingBag, Bell, Banknote, Smartphone, ArrowLeft, Trash2, Tag, Percent, UserPlus, Minus, ArrowRightLeft, Edit, XCircle, Printer } from 'lucide-react';
import { printKitchenOrderTicket } from '@/components/kitchen/KitchenOrderTicket';
import { printCustomerReceipt } from '@/components/receipt/CustomerReceipt';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { KitchenTicketData } from '@/utils/escpos';
import { usePrintSectors } from '@/hooks/usePrintSectors';

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
  const { hasAnyRole } = useUserRole();
  const canDeleteItems = hasAnyRole(['admin', 'cashier']);
  const { settings: tableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings } = useIdleTableSettings();
  const { playOrderReadySound, playTableWaitAlertSound, playIdleTableAlertSound, settings: audioSettings } = useAudioNotification();
  const { getInitialOrderStatus } = useKdsSettings();
  const { autoPrintKitchenTicket, autoPrintCustomerReceipt, duplicateKitchenTicket } = useOrderSettings();
  const printer = usePrinterOptional();
  const { data: printSectors } = usePrintSectors();
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready']);
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
  useEffect(() => {
    if (!orders || previousOrdersRef.current.length === 0) {
      previousOrdersRef.current = orders || [];
      return;
    }

    orders.forEach(order => {
      // Only table orders (dine_in)
      if (order.order_type !== 'dine_in') return;
      
      const prevOrder = previousOrdersRef.current.find(o => o.id === order.id);
      
      // If order existed before and changed to "ready"
      if (
        prevOrder && 
        prevOrder.status !== 'ready' && 
        order.status === 'ready' &&
        !notifiedReadyOrdersRef.current.has(order.id)
      ) {
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
            duration: 6000 
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
    return orders?.find(o => o.table_id === tableId && o.status !== 'delivered' && o.status !== 'cancelled');
  };

  const getTableReservation = (tableId: string) => {
    return reservations?.find(r => r.table_id === tableId && r.status === 'confirmed');
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

    // BUG FIX: If order is ready or delivered, reset to initial status for KDS
    // Also reset updated_at so wait time calculation starts fresh
    if (order.status === 'ready' || order.status === 'delivered') {
      await updateOrder.mutateAsync({
        id: order.id,
        status: getInitialOrderStatus(),
        updated_at: new Date().toISOString()
      });
    }

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

    // Auto-print kitchen ticket if enabled
    if (autoPrintKitchenTicket && printer?.canPrintToKitchen && selectedTable) {
      try {
        // Check if we have active sectors with printers configured
        const activeSectors = (printSectors || []).filter(s => s?.is_active !== false && s?.printer_name);
        
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
        console.error('Auto print failed:', err);
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
  
  const totalPaid = useMemo(() => 
    registeredPayments.reduce((sum, p) => sum + p.amount, 0), 
    [registeredPayments]
  );
  
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

  // Confirm individual payment
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
    
    // Check if payment is complete
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    if (newTotalPaid >= finalTotal) {
      setConfirmCloseModalOpen(true);
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
      // Register all payments in database
      for (const payment of registeredPayments) {
        await createPayment.mutateAsync({
          order_id: selectedOrder.id,
          cash_register_id: openCashRegister?.id || null,
          payment_method: payment.method,
          amount: payment.amount,
        });
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
          }, printer);
          toast.success('Recibo impresso automaticamente');
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
                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          'cursor-pointer transition-all hover:scale-105 relative',
                          statusColors[table.status],
                          isSelected && 'ring-2 ring-primary ring-offset-2',
                          isOrderReady && 'ring-2 ring-green-500 ring-offset-2 animate-pulse'
                        )}
                        onClick={() => handleTableClick(table)}
                      >
                        {isOrderReady && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-green-500 text-white shadow-lg animate-bounce">
                              <Bell className="h-3 w-3 mr-1" />
                              Pronto!
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
                          {order && (
                            <p className="text-xs mt-1 opacity-75">
                              {order.order_items?.length || 0} itens
                            </p>
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
                    {/* Ready Alert Banner */}
                    {selectedOrder?.status === 'ready' && !isClosingBill && (
                      <div className="bg-green-500 text-white p-3 rounded-lg flex items-center gap-2 animate-pulse">
                        <Bell className="h-5 w-5" />
                        <div>
                          <p className="font-bold">Pedido Pronto!</p>
                          <p className="text-xs opacity-90">A cozinha finalizou o preparo</p>
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
                                    printKitchenOrderTicket({
                                      orderNumber: selectedOrder.id,
                                      orderType: 'dine_in',
                                      tableNumber: selectedTable.number,
                                      customerName: selectedOrder.customer_name,
                                      items: selectedOrder.order_items?.map((item: any) => ({
                                        id: item.id,
                                        quantity: item.quantity,
                                        notes: item.notes,
                                        product: item.product,
                                        variation: item.variation,
                                        extras: item.extras,
                                      })) || [],
                                      notes: selectedOrder.notes,
                                      createdAt: selectedOrder.created_at || new Date().toISOString(),
                                    });
                                  }}
                                >
                                  <Printer className="h-4 w-4 mr-2" />
                                  Imprimir Comanda
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => setIsSwitchTableDialogOpen(true)}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Trocar Mesa
                              </Button>
                              {/* Only show Fechar Conta if there are items */}
                              {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
                                <Button variant="outline" className="w-full" onClick={handleStartClosing}>
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Fechar Conta
                                </Button>
                              )}
                            </>
                          )}

                          {selectedTable.status === 'reserved' && (
                            <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                              Liberar Mesa
                            </Button>
                          )}
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
                            });
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

                        {/* Registered Payments */}
                        {registeredPayments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Pagamentos registrados</h4>
                            <div className="space-y-1">
                              {registeredPayments.map((payment, index) => (
                                <div 
                                  key={index}
                                  className="flex items-center justify-between p-2 bg-green-500/10 rounded text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    {paymentMethodIcons[payment.method]}
                                    <span>{paymentMethodLabels[payment.method]}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-green-600">
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
                            disabled={registeredPayments.length === 0}
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
                  {selectedOrder?.order_items && selectedOrder.order_items.length > 0 && (
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

              {/* Registered Payments */}
              {registeredPayments.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Pagamentos</h4>
                  {registeredPayments.map((payment, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 bg-green-500/10 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {paymentMethodIcons[payment.method]}
                        <span>{paymentMethodLabels[payment.method]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-600">
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
                  disabled={registeredPayments.length === 0}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment}>
              Confirmar
            </Button>
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
    </PDVLayout>
  );
}
