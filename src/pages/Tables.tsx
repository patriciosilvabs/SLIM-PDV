import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTables, useTableMutations, Table, TableStatus } from '@/hooks/useTables';
import { useOrders, useOrderMutations } from '@/hooks/useOrders';
import { useReservations, useReservationMutations, Reservation } from '@/hooks/useReservations';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Users, Receipt, CreditCard, Calendar, Clock, Phone, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { createOrder } = useOrderMutations();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: reservations } = useReservations(selectedDate);
  const { createReservation, cancelReservation, updateReservation } = useReservationMutations();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [newTable, setNewTable] = useState({ number: 1, capacity: 4 });
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

  const handleTableClick = async (table: Table) => {
    if (table.status === 'available') {
      await updateTable.mutateAsync({ id: table.id, status: 'occupied' });
      await createOrder.mutateAsync({
        table_id: table.id,
        order_type: 'dine_in',
        status: 'pending',
      });
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
    setSelectedTable(null);
  };

  const handleCreateReservation = async () => {
    if (!newReservation.table_id || !newReservation.customer_name) return;
    
    await createReservation.mutateAsync({
      ...newReservation,
      status: 'confirmed',
      created_by: user?.id || null,
    });
    
    // Mark table as reserved if reservation is for today
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

  // Generate next 7 days for date selection
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, "EEE, dd 'de' MMM", { locale: ptBR }),
    };
  });

  return (
    <PDVLayout>
      <Tabs defaultValue="tables" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mesas</h1>
            <p className="text-muted-foreground">Gerencie mesas e reservas</p>
          </div>
          <TabsList>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tables" className="space-y-6">
          <div className="flex items-center justify-between">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tables?.map((table) => {
                const order = getTableOrder(table.id);
                const reservation = getTableReservation(table.id);
                return (
                  <Card
                    key={table.id}
                    className={cn(
                      'cursor-pointer transition-all hover:scale-105 relative',
                      statusColors[table.status]
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
        </TabsContent>

        <TabsContent value="reservations" className="space-y-6">
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

      {/* Table Details Dialog */}
      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent>
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
                <Button variant="outline" className="w-full" onClick={handleRequestBill}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Pedir Conta
                </Button>
                <Button className="w-full" asChild>
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
    </PDVLayout>
  );
}
