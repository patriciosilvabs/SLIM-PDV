import { useState, useMemo, useEffect, useRef } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useCombos } from '@/hooks/useCombos';
import { useComboItems } from '@/hooks/useComboItems';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useOrderMutations } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useSearchCustomers, useCustomerMutations, Customer } from '@/hooks/useCustomers';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProductDetailDialog, SelectedComplement } from '@/components/order/ProductDetailDialog';
import { 
  Package, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  MessageCircle,
  X,
  Minus as MinimizeIcon,
  Gift,
  Menu,
  Phone,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);
  
  if (limited.length <= 2) {
    return limited.length ? `(${limited}` : '';
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  } else if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  }
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
  complements?: SelectedComplement[];
}

type OrderType = 'takeaway' | 'delivery';

export default function Counter() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: combos } = useCombos();
  const { data: comboItems } = useComboItems();
  const { data: variations } = useProductVariations();
  const { createOrder, addOrderItem } = useOrderMutations();
  const { toast } = useToast();
  const { duplicateItems } = useOrderSettings();
  const { findOrCreateCustomer, updateCustomerStats } = useCustomerMutations();
  const isMobile = useIsMobile();

  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // ProductDetailDialog state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const { data: searchedCustomers } = useSearchCustomers(customerSearch);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeCategories = categories?.filter(c => c.is_active !== false) || [];
  const activeProducts = products?.filter(p => p.is_available !== false) || [];
  const activeCombos = combos?.filter(c => c.is_active !== false) || [];

  // Check if tablet (768px-1024px)
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
    };
    
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isTablet]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let filtered = activeProducts;
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.pdv_code?.toLowerCase().includes(query) ||
        p.internal_code?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [activeProducts, selectedCategory, searchQuery]);

  // Filter combos by search
  const filteredCombos = useMemo(() => {
    if (!searchQuery.trim()) return activeCombos;
    const query = searchQuery.toLowerCase().trim();
    return activeCombos.filter(c => c.name.toLowerCase().includes(query));
  }, [activeCombos, searchQuery]);

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        if (orderItems.length > 0 && !isCreatingOrder) {
          handleCreateOrder();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderItems, isCreatingOrder]);

  // Handle customer search input
  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setCustomerName(value);
    setShowCustomerDropdown(true);
    setSelectedCustomer(null);
  };

  // Handle customer selection
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerAddress(customer.address || '');
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  // Handle product click - open ProductDetailDialog
  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  // Handle add from ProductDetailDialog
  const handleAddFromDialog = (
    product: any, 
    quantity: number, 
    complements: SelectedComplement[], 
    itemNotes: string
  ) => {
    const complementsTotal = complements.reduce((sum, c) => sum + (c.price * c.quantity), 0);
    const productPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1) {
      // Create separate items
      for (let i = 0; i < quantity; i++) {
        setOrderItems(prev => [...prev, {
          id: `${product.id}-${Date.now()}-${i}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
          notes: itemNotes || undefined,
          complements,
        }]);
      }
    } else {
      setOrderItems(prev => [...prev, {
        id: `${product.id}-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        notes: itemNotes || undefined,
        complements,
      }]);
    }
  };

  const addProduct = (product: any, variation?: any) => {
    const itemId = `${product.id}-${variation?.id || 'base'}-${Date.now()}`;
    const unitPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price + (variation?.price_modifier ?? 0)
      : product.price + (variation?.price_modifier ?? 0);
    
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
    setCustomerSearch('');
    setSelectedCustomer(null);
    setNotes('');
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) {
      toast({ title: 'Adicione itens ao pedido', variant: 'destructive' });
      return;
    }

    setIsCreatingOrder(true);
    try {
      // Find or create customer if phone is provided
      let customerId: string | null = null;
      if (customerPhone || customerName) {
        try {
          const customer = await findOrCreateCustomer.mutateAsync({
            name: customerName || undefined,
            phone: customerPhone || undefined,
            address: orderType === 'delivery' ? customerAddress || undefined : undefined,
          });
          customerId = customer?.id || null;
        } catch (e) {
          // Continue without customer if creation fails
          console.error('Failed to create/find customer:', e);
        }
      }

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

      // Update customer stats
      if (customerId) {
        try {
          await updateCustomerStats.mutateAsync({ customerId, orderTotal: subtotal });
        } catch (e) {
          console.error('Failed to update customer stats:', e);
        }
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

  const getMinPrice = (product: any) => {
    const productVariations = getProductVariations(product.id);
    const basePrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    
    if (productVariations.length === 0) return basePrice;
    
    const minModifier = Math.min(...productVariations.map(v => v.price_modifier || 0));
    return basePrice + minModifier;
  };

  return (
    <PDVLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Mobile/Tablet sidebar toggle */}
        {isTablet && (
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-16 left-2 z-50 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Left Sidebar - Categories */}
        <div 
          className={cn(
            "border-r bg-muted/30 flex flex-col transition-all duration-300",
            sidebarOpen ? "w-48" : "w-0 overflow-hidden",
            isTablet && sidebarOpen && "absolute left-0 top-0 bottom-0 z-40 shadow-lg"
          )}
        >
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Categorias
            </h3>
            {isTablet && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  if (isTablet) setSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  selectedCategory === null
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                )}
              >
                Todos
              </button>
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (isTablet) setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Overlay for tablet sidebar */}
        {isTablet && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Center - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search Bar */}
          <div className="p-4 border-b bg-background">
            <div className="relative flex items-center gap-2">
              {isTablet && !sidebarOpen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Encontre produtos por nome ou código PDV (Ctrl + b)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Products List */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* Combos Section (if searching or no category selected) */}
              {filteredCombos.length > 0 && (searchQuery || !selectedCategory) && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Combos
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredCombos.map(combo => {
                      const discountPercent = combo.original_price > 0
                        ? Math.round((1 - combo.combo_price / combo.original_price) * 100)
                        : 0;
                      return (
                        <div
                          key={combo.id}
                          onClick={() => addCombo(combo)}
                          className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary hover:shadow-sm transition-all cursor-pointer group relative"
                        >
                          {discountPercent > 0 && (
                            <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs">
                              -{discountPercent}%
                            </Badge>
                          )}
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {combo.image_url ? (
                              <img src={combo.image_url} alt={combo.name} className="w-full h-full object-cover" />
                            ) : (
                              <Gift className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{combo.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {combo.original_price > combo.combo_price && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(combo.original_price)}
                                </span>
                              )}
                              <span className="text-primary font-bold text-sm">
                                {formatCurrency(combo.combo_price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Products Section */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produtos
                  {filteredProducts.length > 0 && (
                    <span className="text-xs font-normal">({filteredProducts.length})</span>
                  )}
                </h3>
                
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredProducts.map(product => {
                      const productVariations = getProductVariations(product.id);
                      const minPrice = getMinPrice(product);
                      const hasVariations = productVariations.length > 0;
                      
                      return (
                        <div
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary hover:shadow-sm cursor-pointer transition-all"
                        >
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{product.name}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {hasVariations ? 'A partir de ' : ''}
                              <span className="text-primary font-bold">
                                {formatCurrency(minPrice)}
                              </span>
                            </p>
                            {hasVariations && (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {productVariations.length} tamanhos
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Order */}
        <div className={cn(
          "border-l bg-background flex flex-col transition-all duration-300",
          isTablet ? "w-72" : "w-80"
        )}>
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold">Novo pedido</h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MinimizeIcon className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={clearOrder}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Customer Search */}
          <div className="p-3 border-b space-y-3">
            {/* Customer search with autocomplete */}
            <div ref={customerSearchRef} className="relative">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar cliente..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearchChange(e.target.value)}
                  onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                  className="h-9 pl-9"
                />
              </div>
              
              {/* Customer dropdown */}
              {showCustomerDropdown && searchedCustomers && searchedCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchedCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {customer.total_orders} pedidos
                          </p>
                          <p className="text-xs font-medium text-primary">
                            {formatCurrency(customer.total_spent || 0)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected customer info */}
            {selectedCustomer && (
              <div className="bg-muted/50 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cliente selecionado</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                      setCustomerName('');
                      setCustomerPhone('');
                      setCustomerAddress('');
                    }}
                  >
                    Limpar
                  </Button>
                </div>
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-muted-foreground">
                  {selectedCustomer.total_orders} pedidos • {formatCurrency(selectedCustomer.total_spent || 0)} total
                </p>
              </div>
            )}

            {/* Phone field with validation */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                  className="h-9 pl-9 pr-9"
                  type="tel"
                />
                {/* Validation icon */}
                {customerPhone && customerPhone.replace(/\D/g, '').length >= 10 && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {customerPhone && customerPhone.replace(/\D/g, '').length > 0 && customerPhone.replace(/\D/g, '').length < 10 && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                )}
              </div>
              {customerPhone && customerPhone.replace(/\D/g, '').length >= 10 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                  onClick={() => {
                    const numbers = customerPhone.replace(/\D/g, '');
                    window.open(`https://wa.me/55${numbers}`, '_blank');
                  }}
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Order Type */}
            <Select value={orderType} onValueChange={(v: OrderType) => setOrderType(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="takeaway">📦 Retirada</SelectItem>
                <SelectItem value="delivery">🚚 Delivery</SelectItem>
              </SelectContent>
            </Select>

            {orderType === 'delivery' && (
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Endereço de entrega..."
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows={2}
                  className="text-sm pl-9"
                />
              </div>
            )}

            {/* Notes Collapsible */}
            <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-9 px-3">
                  <span className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    Observação do pedido
                  </span>
                  {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea
                  placeholder="Observações..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1">
            {orderItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <Package className="h-16 w-16 mb-3 opacity-30" />
                <p className="text-sm">Carrinho vazio</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
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
                      {/* Show complements */}
                      {item.complements && item.complements.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.complements.map((c, i) => (
                            <span key={i}>
                              {c.quantity > 1 ? `${c.quantity}x ` : ''}{c.option_name}
                              {i < item.complements!.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 italic">
                          Obs: {item.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!duplicateItems ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground px-1">×{item.quantity}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
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

          {/* Footer - Pay Button */}
          <div className="p-3 border-t bg-muted/30">
            <Button
              className="w-full h-12 text-base font-bold"
              size="lg"
              onClick={handleCreateOrder}
              disabled={orderItems.length === 0 || isCreatingOrder}
            >
              {isCreatingOrder ? 'Processando...' : (
                <>
                  PAGAR <span className="text-xs font-normal ml-1 opacity-70">(Ctrl + p)</span>
                  <span className="ml-auto">{formatCurrency(subtotal)}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ProductDetailDialog for product selection with complements */}
      <ProductDetailDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onAdd={handleAddFromDialog}
        duplicateItems={duplicateItems}
      />
    </PDVLayout>
  );
}
