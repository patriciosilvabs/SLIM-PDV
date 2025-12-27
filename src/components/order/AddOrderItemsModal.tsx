import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductVariations } from '@/hooks/useProductVariations';
import { ProductDetailDialog, SelectedComplement, SubItemComplement } from './ProductDetailDialog';
import { ShoppingCart, Trash2, Plus, Minus, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrderSettings } from '@/hooks/useOrderSettings';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  variation_id?: string | null;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  complements: SelectedComplement[];
  combo_name?: string;
  print_sector_id?: string | null;
  subItems?: SubItemComplement[];
}

interface AddOrderItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: CartItem[]) => void;
  tableNumber?: number;
}

export function AddOrderItemsModal({ open, onOpenChange, onSubmit, tableNumber }: AddOrderItemsModalProps) {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { duplicateItems } = useOrderSettings();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Selecionar primeira categoria automaticamente quando carregar
  const firstCategoryId = categories?.find(c => c.is_active !== false)?.id || null;
  const effectiveCategory = selectedCategory ?? firstCategoryId;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];

  const filteredProducts = effectiveCategory
    ? activeProducts.filter(p => p.category_id === effectiveCategory)
    : [];

  const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId && v.is_active !== false) || [];
  };

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleAddProduct = (
    product: any, 
    quantity: number, 
    complements: SelectedComplement[], 
    notes: string,
    subItems?: SubItemComplement[]
  ) => {
    // Calculate complements total - include sub-items if present
    let complementsTotal = complements.reduce((sum, c) => sum + (c.price * c.quantity), 0);
    if (subItems && subItems.length > 0) {
      for (const subItem of subItems) {
        for (const c of subItem.complements) {
          complementsTotal += c.price * c.quantity;
        }
      }
    }
    
    const productPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1) {
      // Create separate items when duplicateItems is enabled
      const newItems: CartItem[] = [];
      for (let i = 0; i < quantity; i++) {
        newItems.push({
          id: `${product.id}-${Date.now()}-${i}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
          notes,
          complements,
          print_sector_id: product.print_sector_id,
          subItems,
        });
      }
      setCartItems(prev => [...prev, ...newItems]);
    } else {
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        notes,
        complements,
        print_sector_id: product.print_sector_id,
        subItems,
      };
      setCartItems(prev => [...prev, newItem]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, total_price: item.unit_price * newQty };
    }));
  };

  const duplicateItem = (itemId: string) => {
    setCartItems(prev => {
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
  };

  const removeItem = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = () => {
    if (cartItems.length === 0) return;
    onSubmit(cartItems);
    setCartItems([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setCartItems([]);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>
              {tableNumber ? `Novo Pedido - Mesa ${tableNumber}` : 'Novo Pedido'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Left: Categories */}
            <div className="w-48 border-r bg-muted/30 flex-shrink-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {activeCategories.map(cat => (
                    <Button
                      key={cat.id}
                      variant={effectiveCategory === cat.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.icon && <span className="mr-2">{cat.icon}</span>}
                      <span className="truncate">{cat.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Center: Products Grid */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredProducts.map(product => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleProductClick(product)}
                      >
                        <CardContent className="p-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-24 object-cover rounded-md mb-2"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted rounded-md mb-2 flex items-center justify-center">
                              <span className="text-muted-foreground text-xs">Sem foto</span>
                            </div>
                          )}
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <div className="flex items-center gap-2">
                            {product.is_promotion && product.promotion_price ? (
                              <>
                                <span className="text-muted-foreground line-through text-xs">
                                  {formatCurrency(product.price)}
                                </span>
                                <span className="text-primary font-semibold text-sm">
                                  {formatCurrency(product.promotion_price)}
                                </span>
                              </>
                            ) : (
                              <span className="text-primary font-semibold text-sm">
                                {formatCurrency(product.price)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        <p>Nenhum produto encontrado</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Right: Cart */}
            <div className="w-80 border-l flex flex-col bg-muted/20 flex-shrink-0">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="font-semibold">Carrinho</span>
                </div>
                <Badge variant="secondary">{cartItems.length} itens</Badge>
              </div>

              <ScrollArea className="flex-1">
                {cartItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Adicione itens ao pedido</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {cartItems.map(item => (
                      <div 
                        key={item.id} 
                        className="p-3 bg-background rounded-lg border space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            {item.variation_name && (
                              <p className="text-xs text-muted-foreground">{item.variation_name}</p>
                            )}
                            {item.combo_name && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {item.combo_name}
                              </Badge>
                            )}
                            {item.complements.length > 0 && (
                              <div className="mt-1">
                                {item.complements.map((c, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    + {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.option_name}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                "{item.notes}"
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => removeItem(item.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6"
                              onClick={() => duplicateItems ? duplicateItem(item.id) : updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm">
                            {formatCurrency(item.total_price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t p-3 space-y-3">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(subtotal)}</span>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmit}
                  disabled={cartItems.length === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Pedido
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProductDetailDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onAdd={handleAddProduct}
        duplicateItems={duplicateItems}
        channel="table"
      />
    </>
  );
}
