import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders, useOrderMutations, Order, OrderStatus } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useProductVariations } from '@/hooks/useProductVariations';
import { Trash2, Clock, ChefHat, CheckCircle, XCircle, Printer, Package, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printKitchenReceipt } from '@/components/kitchen/KitchenReceipt';
import { Badge } from '@/components/ui/badge';
import { usePrinterOptional } from '@/contexts/PrinterContext';

const statusConfig: Record<OrderStatus, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'bg-warning text-warning-foreground' },
  preparing: { label: 'Preparando', icon: ChefHat, color: 'bg-info text-info-foreground' },
  ready: { label: 'Pronto', icon: CheckCircle, color: 'bg-accent text-accent-foreground' },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive text-destructive-foreground' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Orders() {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const activeStatuses: OrderStatus[] = ['pending', 'preparing', 'ready'];
  const { data: activeOrders } = useOrders(activeStatuses);
  const { data: allOrders } = useOrders();
  const { data: products } = useProducts();
  const { data: variations } = useProductVariations();
  const { updateOrder, addOrderItem, deleteOrderItem } = useOrderMutations();
  const { getInitialOrderStatus } = useKdsSettings();
  const printer = usePrinterOptional();

  const displayedOrders = activeTab === 'active' 
    ? activeOrders 
    : allOrders?.filter(o => o.status === 'delivered' || o.status === 'cancelled');


  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    await updateOrder.mutateAsync({ id: order.id, status: newStatus });
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const handleAddItem = async (productId: string, price: number, name: string) => {
    if (!selectedOrder) return;
    const initialStatus = getInitialOrderStatus();
    await addOrderItem.mutateAsync({
      order_id: selectedOrder.id,
      product_id: productId,
      quantity: 1,
      unit_price: price,
      total_price: price,
      notes: null,
      status: initialStatus,
      variation_id: null,
    });
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedOrder) return;
    await deleteOrderItem.mutateAsync({ id: itemId, order_id: selectedOrder.id });
  };

  
  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Gerencie os pedidos do estabelecimento</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Em Andamento</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="space-y-3">
                  {displayedOrders?.map((order) => {
                    const config = statusConfig[order.status];
                    const Icon = config.icon;
                    return (
                      <Card
                        key={order.id}
                        className={cn(
                          'cursor-pointer transition-all hover:shadow-md',
                          selectedOrder?.id === order.id && 'ring-2 ring-primary'
                        )}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn('p-2 rounded-lg', config.color)}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {order.table?.number ? `Mesa ${order.table.number}` :
                                   order.customer_name || `#${order.id.slice(0, 8)}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {order.order_items?.length || 0} itens • {config.label}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleTimeString('pt-BR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {(!displayedOrders || displayedOrders.length === 0) && (
                    <p className="text-center py-12 text-muted-foreground">
                      Nenhum pedido encontrado
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Order Details / Add Items */}
          <div className="space-y-4">
            {selectedOrder ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {selectedOrder.table?.number ? `Mesa ${selectedOrder.table.number}` :
                         selectedOrder.customer_name || `Pedido #${selectedOrder.id.slice(0, 8)}`}
                      </CardTitle>
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        statusConfig[selectedOrder.status].color
                      )}>
                        {statusConfig[selectedOrder.status].label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Items */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {selectedOrder.order_items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity}x {formatCurrency(item.unit_price)}
                            </p>
                            {item.notes?.startsWith('[Combo:') && (
                              <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                                <Package className="h-3 w-3 mr-1" />
                                {item.notes.replace('[Combo: ', '').replace(']', '')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{formatCurrency(item.total_price)}</p>
                            {selectedOrder.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(selectedOrder.total)}
                      </span>
                    </div>

                    {/* Print Button */}
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => printKitchenReceipt(selectedOrder, '80mm', printer)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir Comanda
                    </Button>

                    {/* Status Actions */}
                    {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                      <div className="flex gap-2">
                        {selectedOrder.status === 'pending' && (
                          <Button 
                            className="flex-1" 
                            onClick={() => handleStatusChange(selectedOrder, 'preparing')}
                          >
                            <ChefHat className="h-4 w-4 mr-2" />
                            Preparar
                          </Button>
                        )}
                        {selectedOrder.status === 'preparing' && (
                          <Button 
                            className="flex-1 bg-accent hover:bg-accent/90" 
                            onClick={() => handleStatusChange(selectedOrder, 'ready')}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Pronto
                          </Button>
                        )}
                        {selectedOrder.status === 'ready' && (
                          <Button 
                            className="flex-1" 
                            onClick={() => handleStatusChange(selectedOrder, 'delivered')}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Entregar
                          </Button>
                        )}
                        <Button 
                          variant="destructive" 
                          size="icon"
                          onClick={() => handleStatusChange(selectedOrder, 'cancelled')}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Add Products */}
                {selectedOrder.status === 'pending' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Adicionar Itens</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                        {products?.filter(p => p.is_available).map((product) => (
                          <Button
                            key={product.id}
                            variant="outline"
                            className="h-auto py-2 px-3 flex flex-col items-start"
                            onClick={() => handleAddItem(product.id, product.price, product.name)}
                          >
                            <span className="text-sm font-medium truncate w-full text-left">
                              {product.name}
                            </span>
                            <span className="text-xs text-primary">
                              {formatCurrency(product.price)}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Selecione um pedido para ver os detalhes</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PDVLayout>
  );
}