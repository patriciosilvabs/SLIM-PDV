import { useState } from 'react';
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
import { useOrders, useOrderMutations } from '@/hooks/useOrders';
import { useReservations, useReservationMutations, Reservation } from '@/hooks/useReservations';
import { useAuth } from '@/contexts/AuthContext';
import { AddOrderItemsModal, CartItem } from '@/components/order/AddOrderItemsModal';
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check, ChevronLeft, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function Tables() {
  const { user } = useAuth();
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready']);
  const { createTable, updateTable } = useTableMutations();
  const { createOrder, addOrderItem } = useOrderMutations();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: reservations } = useReservations(selectedDate);
  const { createReservation, cancelReservation, updateReservation } = useReservationMutations();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [isOpenTableDialogOpen, setIsOpenTableDialogOpen] = useState(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [newTable, setNewTable] = useState({ number: 1, capacity: 4 });
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

  const getTableOrder = (tableId: string) => {
    return orders?.find(o => o.table_id === tableId && o.status !== 'delivered' && o.status !== 'cancelled');
  };

  const getTableReservation = (tableId: string) => {
    return reservations?.find(r => r.table_id === tableId && r.status === 'confirmed');
  };

  const handleAddTable = () => {
    createTable.mutate({
      number: newTable.number,
      capacity: newTable.capacity,
      status: 'available',
      position_x: 0,
      position_y: 0,
    });
    setIsAddDialogOpen(false);
    setNewTable({ number: (tables?.length || 0) + 2, capacity: 4 });
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
      status: 'pending',
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

    for (const item of items) {
      await addOrderItem.mutateAsync({
        order_id: order.id,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes || null,
        status: 'pending',
      });
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
      status: 'pending',
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
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Mesa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Mesa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="number">Número da Mesa</Label>
                        <Input
                          id="number"
                          type="number"
                          value={newTable.number}
                          onChange={(e) => setNewTable({ ...newTable, number: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="capacity">Capacidade</Label>
                        <Input
                          id="capacity"
                          type="number"
                          value={newTable.capacity}
                          onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) })}
                        />
                      </div>
                      <Button className="w-full" onClick={handleAddTable} disabled={createTable.isPending}>
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {tables?.map((table) => {
                    const order = getTableOrder(table.id);
                    const reservation = getTableReservation(table.id);
                    const isSelected = selectedTable?.id === table.id;
                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          'cursor-pointer transition-all hover:scale-105 relative',
                          statusColors[table.status],
                          isSelected && 'ring-2 ring-primary ring-offset-2'
                        )}
                        onClick={() => handleTableClick(table)}
                      >
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

                  <CardContent className="flex-1 flex flex-col space-y-4">
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
                        {selectedOrder.customer_name && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Cliente</span>
                            <span>{selectedOrder.customer_name}</span>
                          </div>
                        )}
                        {selectedOrder.notes && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Obs</span>
                            <span>{selectedOrder.notes}</span>
                          </div>
                        )}
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
                                className="flex items-center justify-between p-2 bg-muted/50 rounded"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {item.quantity}x {item.product?.name || 'Produto'}
                                  </p>
                                  {item.notes && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm font-medium ml-2">
                                  {formatCurrency(item.total_price)}
                                </span>
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
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhum item no pedido</p>
                        </div>
                      </div>
                    ) : null}

                    {/* Actions */}
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
                          <Button variant="outline" className="w-full" onClick={handleRequestBill}>
                            <Receipt className="h-4 w-4 mr-2" />
                            Pedir Conta
                          </Button>
                        </>
                      )}

                      {selectedTable.status === 'bill_requested' && (
                        <Button className="w-full" asChild>
                          <a href={`/cash-register?table=${selectedTable.id}`}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Fechar Conta
                          </a>
                        </Button>
                      )}

                      {(selectedTable.status === 'reserved' || selectedTable.status === 'bill_requested') && (
                        <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                          Liberar Mesa
                        </Button>
                      )}
                    </div>
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
      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="lg:hidden">
          <DialogHeader>
            <DialogTitle>Mesa {selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Status</span>
              <span className={cn(
                'px-2 py-1 rounded text-sm font-medium',
                selectedTable && statusColors[selectedTable.status]
              )}>
                {selectedTable && statusLabels[selectedTable.status]}
              </span>
            </div>

            {selectedTable?.status === 'occupied' && (
              <>
                <Button className="w-full" onClick={() => setIsAddOrderModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Pedido
                </Button>
                <Button variant="outline" className="w-full" onClick={handleRequestBill}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Pedir Conta
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/orders?table=${selectedTable.id}`}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Ver Pedido
                  </a>
                </Button>
              </>
            )}

            {selectedTable?.status === 'bill_requested' && (
              <Button className="w-full" asChild>
                <a href={`/cash-register?table=${selectedTable.id}`}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Fechar Conta
                </a>
              </Button>
            )}

            {(selectedTable?.status === 'reserved' || selectedTable?.status === 'bill_requested') && (
              <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
                Liberar Mesa
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    </PDVLayout>
  );
}
