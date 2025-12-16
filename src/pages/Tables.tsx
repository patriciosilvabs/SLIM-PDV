import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTables, useTableMutations, Table, TableStatus } from '@/hooks/useTables';
import { useOrders, useOrderMutations } from '@/hooks/useOrders';
import { Plus, Users, Receipt, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Tables() {
  const { data: tables, isLoading } = useTables();
  const { data: orders } = useOrders(['pending', 'preparing', 'ready']);
  const { createTable, updateTable } = useTableMutations();
  const { createOrder } = useOrderMutations();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [newTable, setNewTable] = useState({ number: 1, capacity: 4 });

  const getTableOrder = (tableId: string) => {
    return orders?.find(o => o.table_id === tableId && o.status !== 'delivered' && o.status !== 'cancelled');
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
      // Open table and create order
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

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mesas</h1>
            <p className="text-muted-foreground">Gerencie as mesas do estabelecimento</p>
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

        {/* Status Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded', statusColors[status as TableStatus])} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Tables Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {tables?.map((table) => {
              const order = getTableOrder(table.id);
              return (
                <Card
                  key={table.id}
                  className={cn(
                    'cursor-pointer transition-all hover:scale-105',
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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
      </div>
    </PDVLayout>
  );
}