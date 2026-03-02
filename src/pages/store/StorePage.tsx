import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicStore, useCreatePublicOrder, CreateOrderPayload } from '@/hooks/usePublicStore';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreCategories } from '@/components/store/StoreCategories';
import { StoreProductGrid } from '@/components/store/StoreProductGrid';
import { StoreCart } from '@/components/store/StoreCart';
import { StoreCheckout } from '@/components/store/StoreCheckout';
import { StoreProductDetail } from '@/components/store/StoreProductDetail';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  image_url?: string | null;
  complements?: Array<{
    option_id: string;
    option_name: string;
    group_name: string;
    price: number;
    quantity: number;
    kds_category?: string;
  }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('mesa');

  const { data: store, isLoading, error } = usePublicStore(slug, tableId);
  const createOrder = useCreatePublicOrder();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = store?.categories || [];
  const products = store?.products || [];

  // Auto-select first category
  const activeCategory = selectedCategory || (categories.length > 0 ? categories[0].id : null);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory) {
      filtered = filtered.filter(p => p.category_id === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, activeCategory, searchQuery]);

  const featuredProducts = useMemo(() => 
    products.filter(p => p.is_featured || p.is_promotion),
  [products]);

  const cartTotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => [...prev, item]);
  }, []);

  const updateCartItem = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item => 
        item.id === id ? { ...item, quantity, total_price: item.unit_price * quantity } : item
      ));
    }
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleCheckout = async (data: {
    order_type: 'takeaway' | 'delivery';
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    notes: string;
    payment_method: string;
  }) => {
    if (!slug) return;

    const payload: CreateOrderPayload = {
      slug,
      order_type: tableId ? 'takeaway' : data.order_type,
      customer_name: data.customer_name || undefined,
      customer_phone: data.customer_phone || undefined,
      customer_address: data.customer_address || undefined,
      notes: data.notes || undefined,
      table_id: tableId || undefined,
      payment_method: data.payment_method || undefined,
      items: cart.map(item => ({
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
        complements: item.complements?.map(c => ({
          option_id: c.option_id,
          option_name: c.option_name,
          price: c.price,
          quantity: c.quantity,
          kds_category: c.kds_category,
        })),
      })),
    };

    await createOrder.mutateAsync(payload);
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setOrderSuccess(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">
            O link que você acessou não corresponde a nenhuma loja ativa.
          </p>
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold">Pedido Enviado!</h1>
          <p className="text-muted-foreground">
            Seu pedido foi recebido com sucesso. {store.table ? `Mesa ${store.table.number}` : 'Aguarde a preparação.'}
          </p>
          <Button onClick={() => setOrderSuccess(false)} className="w-full">
            Fazer novo pedido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <StoreHeader 
        tenant={store.tenant} 
        table={store.table}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Featured products */}
      {featuredProducts.length > 0 && !searchQuery && !selectedCategory && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Destaques</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {featuredProducts.slice(0, 6).map(product => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="flex-shrink-0 w-36 rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 bg-muted flex items-center justify-center text-3xl">🍕</div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{product.name}</p>
                  <p className="text-xs font-bold text-primary">
                    {product.is_promotion && product.promotion_price
                      ? formatCurrency(product.promotion_price)
                      : formatCurrency(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <StoreCategories 
        categories={categories} 
        selected={activeCategory} 
        onSelect={setSelectedCategory} 
      />

      <StoreProductGrid 
        products={filteredProducts} 
        onSelect={setSelectedProduct}
      />

      {/* Floating cart button */}
      {cartCount > 0 && !cartOpen && !checkoutOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            onClick={() => setCartOpen(true)} 
            className="w-full h-14 text-base font-semibold shadow-lg rounded-xl"
            size="lg"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver carrinho
            <Badge className="ml-2 bg-primary-foreground text-primary rounded-full">
              {cartCount}
            </Badge>
            <span className="ml-auto">{formatCurrency(cartTotal)}</span>
          </Button>
        </div>
      )}

      {/* Product detail sheet */}
      {selectedProduct && (
        <StoreProductDetail
          product={selectedProduct}
          store={store}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item) => {
            addToCart(item);
            setSelectedProduct(null);
          }}
        />
      )}

      {/* Cart sheet */}
      <StoreCart
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateCartItem}
        onRemove={removeFromCart}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        total={cartTotal}
      />

      {/* Checkout sheet */}
      <StoreCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={handleCheckout}
        total={cartTotal}
        isTable={!!tableId}
        isLoading={createOrder.isPending}
        storeName={store.tenant.name}
      />
    </div>
  );
}
