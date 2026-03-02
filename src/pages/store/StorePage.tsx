import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicStore, useCreatePublicOrder, CreateOrderPayload } from '@/hooks/usePublicStore';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreCategories } from '@/components/store/StoreCategories';
import { StoreProductGrid } from '@/components/store/StoreProductGrid';
import { StoreCart } from '@/components/store/StoreCart';
import { StoreCheckout } from '@/components/store/StoreCheckout';
import { StoreProductDetail } from '@/components/store/StoreProductDetail';
import { ShoppingBag, ChevronRight } from 'lucide-react';
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

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

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
          <div className="h-16 w-16 rounded-full bg-amber-200/50 mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">🍕</span>
          </div>
          <p className="text-muted-foreground text-sm">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-3">
          <span className="text-5xl block">😕</span>
          <h1 className="text-xl font-bold">Loja não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            O link que você acessou não corresponde a nenhuma loja ativa.
          </p>
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4 bg-card p-8 rounded-3xl shadow-lg border border-border">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold">Pedido Enviado!</h1>
          <p className="text-muted-foreground text-sm">
            Seu pedido foi recebido com sucesso.
            {store.table ? ` Mesa ${store.table.number}` : ' Aguarde a preparação.'}
          </p>
          <Button
            onClick={() => setOrderSuccess(false)}
            className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
          >
            Fazer novo pedido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <StoreHeader
        tenant={store.tenant}
        table={store.table}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <StoreCategories
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <StoreProductGrid
        products={filteredProducts}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedProduct}
      />

      {/* Floating cart bar */}
      {cartCount > 0 && !cartOpen && !checkoutOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between h-14 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-amber-600 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
                <span className="font-bold text-sm">Ver sacola</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold">{formatCurrency(cartTotal)}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          </div>
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
