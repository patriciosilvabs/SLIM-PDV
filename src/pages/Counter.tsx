import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useCombos } from '@/hooks/useCombos';
import { useComboItems } from '@/hooks/useComboItems';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useProductExtras } from '@/hooks/useProductExtras';
import { useProductExtraLinks } from '@/hooks/useProductExtraLinks';
import { useOrderMutations } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import { Package, ShoppingCart, Trash2, Plus, Minus, Store, Truck, X, Gift } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variation_id?: string | null;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  combo_name?: string;
}

type OrderType = 'takeaway' | 'delivery';

export default function Counter() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: combos } = useCombos();
  const { data: comboItems } = useComboItems();
  const { data: variations } = useProductVariations();
  const { data: extras } = useProductExtras();
  const { data: extraLinks } = useProductExtraLinks();
  const { createOrder, addOrderItem } = useOrderMutations();
  const { toast } = useToast();

  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];
  const activeCombos = combos?.filter(c => c.is_active !== false) || [];

  const filteredProducts = selectedCategory
    ? activeProducts.filter(p => p.category_id === selectedCategory)
    : activeProducts;

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

  const addProduct = (product: any, variation?: any) => {
    const itemId = `${product.id}-${variation?.id || 'base'}-${Date.now()}`;
    const unitPrice = product.price + (variation?.price_modifier ?? 0);
    
    setOrderItems(prev => [...prev, {
      id: itemId,
      product_id: product.id,
      product_name: product.name,
      variation_id: variation?.id || null,
      variation_name: variation?.name,
      quantity: 1,
      unit_price: unitPrice,
      total_price: unitPrice,
    }]);
  };

  const addCombo = (combo: any) => {
    const items = comboItems?.filter(item => item.combo_id === combo.id) || [];
    if (items.length === 0) return;

    // Calculate discount ratio
    const originalPrice = combo.original_price;
    const comboPrice = combo.combo_price;
    const discountRatio = originalPrice > 0 ? comboPrice / originalPrice : 1;

    items.forEach(item => {
      const product = products?.find(p => p.id === item.product_id);
      if (!product) return;

      const variation = variations?.find(v => v.id === item.variation_id);
      const basePrice = product.price + (variation?.price_modifier ?? 0);
      const discountedPrice = basePrice * discountRatio;

      for (let i = 0; i < (item.quantity || 1); i++) {
        setOrderItems(prev => [...prev, {
          id: `${product.id}-${variation?.id || 'base'}-combo-${Date.now()}-${i}`,
          product_id: product.id,
          product_name: product.name,
          variation_id: variation?.id || null,
          variation_name: variation?.name,
          quantity: 1,
          unit_price: discountedPrice,
          total_price: discountedPrice,
          combo_name: combo.name,
        }]);
      }
    });

    toast({ title: `Combo "${combo.name}" adicionado!` });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  };

  const removeItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) {
      toast({ title: 'Adicione itens ao pedido', variant: 'destructive' });
      return;
    }

    setIsCreatingOrder(true);
    try {
      const order = await createOrder.mutateAsync({
        order_type: orderType,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_address: orderType === 'delivery' ? customerAddress || null : null,
        notes: notes || null,
        subtotal: subtotal,
        total: subtotal,
        status: 'pending',
      });

      // Add items to order
      for (const item of orderItems) {
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

      toast({ title: 'Pedido criado com sucesso!' });
      clearOrder();
    } catch (error: any) {
      toast({ title: 'Erro ao criar pedido', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId && v.is_active !== false) || [];
  };

  return (
    <PDVLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Balcão</h1>
          <p className="text-muted-foreground">Vendas no balcão e delivery</p>
        </div>

        {/* Order Type Selection */}
        <div className="flex gap-2">
          <Button
            variant={orderType === 'takeaway' ? 'default' : 'outline'}
            onClick={() => setOrderType('takeaway')}
            className="flex-1"
          >
            <Store className="h-4 w-4 mr-2" />
            Balcão
          </Button>
          <Button
            variant={orderType === 'delivery' ? 'default' : 'outline'}
            onClick={() => setOrderType('delivery')}
            className="flex-1"
          >
            <Truck className="h-4 w-4 mr-2" />
            Delivery
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Adicionar Itens</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="products">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="products" className="flex-1">
                      <Package className="h-4 w-4 mr-2" />
                      Produtos
                    </TabsTrigger>
                    <TabsTrigger value="combos" className="flex-1">
                      <Gift className="h-4 w-4 mr-2" />
                      Combos
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="space-y-4">
                    {/* Categories */}
                    <ScrollArea className="w-full">
                      <div className="flex gap-2 pb-2">
                        <Button
                          variant={selectedCategory === null ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory(null)}
                        >
                          Todos
                        </Button>
                        {activeCategories.map(cat => (
                          <Button
                            key={cat.id}
                            variant={selectedCategory === cat.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(cat.id)}
                          >
                            {cat.icon && <span className="mr-1">{cat.icon}</span>}
                            {cat.name}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Products Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredProducts.map(product => {
                        const productVariations = getProductVariations(product.id);
                        return (
                          <Card
                            key={product.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => {
                              if (productVariations.length === 0) {
                                addProduct(product);
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-20 object-cover rounded-md mb-2"
                                />
                              )}
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-primary font-semibold text-sm">{formatCurrency(product.price)}</p>
                              
                              {productVariations.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {productVariations.map(v => (
                                    <Button
                                      key={v.id}
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addProduct(product, v);
                                      }}
                                    >
                                      {v.name}
                                      {v.price_modifier !== 0 && ` (+${formatCurrency(v.price_modifier)})`}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="combos">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {activeCombos.map(combo => {
                        const discountPercent = combo.original_price > 0
                          ? Math.round((1 - combo.combo_price / combo.original_price) * 100)
                          : 0;
                        return (
                          <Card
                            key={combo.id}
                            className="cursor-pointer hover:border-primary transition-colors relative"
                            onClick={() => addCombo(combo)}
                          >
                            {discountPercent > 0 && (
                              <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground">
                                -{discountPercent}%
                              </Badge>
                            )}
                            <CardContent className="p-3">
                              {combo.image_url && (
                                <img
                                  src={combo.image_url}
                                  alt={combo.name}
                                  className="w-full h-20 object-cover rounded-md mb-2"
                                />
                              )}
                              <p className="font-medium text-sm truncate">{combo.name}</p>
                              <div className="flex items-center gap-2">
                                {combo.original_price > combo.combo_price && (
                                  <span className="text-muted-foreground line-through text-xs">
                                    {formatCurrency(combo.original_price)}
                                  </span>
                                )}
                                <span className="text-primary font-semibold text-sm">
                                  {formatCurrency(combo.combo_price)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {activeCombos.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhum combo disponível</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Pedido
                  </CardTitle>
                  {orderItems.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearOrder}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Info */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome do Cliente</Label>
                    <Input
                      placeholder="Nome (opcional)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      placeholder="Telefone (opcional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  {orderType === 'delivery' && (
                    <div>
                      <Label className="text-xs">Endereço de Entrega</Label>
                      <Textarea
                        placeholder="Endereço completo"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {/* Order Items */}
                <ScrollArea className="h-[200px]">
                  {orderItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum item no pedido</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orderItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.product_name}
                              {item.variation_name && ` (${item.variation_name})`}
                            </p>
                            {item.combo_name && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                <Gift className="h-3 w-3 mr-1" />
                                {item.combo_name}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.unit_price)} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Notes */}
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    placeholder="Observações do pedido..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(subtotal)}</span>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateOrder}
                  disabled={orderItems.length === 0 || isCreatingOrder}
                >
                  {isCreatingOrder ? 'Criando...' : 'Finalizar Pedido'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PDVLayout>
  );
}
