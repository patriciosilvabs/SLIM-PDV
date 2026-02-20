import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductDetailDialog, SelectedComplement, SubItemComplement } from '@/components/order/ProductDetailDialog';
import { PizzaFlavorCountDialog } from '@/components/order/PizzaFlavorCountDialog';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { calculateFullComplementsPrice, ComplementForCalc, SubItemForCalc } from '@/lib/complementPriceUtils';
import { CartItem } from '@/components/order/AddOrderItemsModal';
import { usePizzaProducts } from '@/hooks/usePizzaProducts';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ProductSelectorProps {
  onAddItem: (item: CartItem) => void;
  className?: string;
}

export function ProductSelector({ onAddItem, className }: ProductSelectorProps) {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { duplicateItems } = useOrderSettings();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [overrideUnitCount, setOverrideUnitCount] = useState<number | undefined>(undefined);
  const [flavorDialogOpen, setFlavorDialogOpen] = useState(false);
  const { data: pizzaData, isLoading: pizzaDataLoading } = usePizzaProducts();
  const pendingProductRef = useRef<any>(null);

  const activeCategories = useMemo(() => 
    categories?.filter(c => c.is_active !== false) || [], 
    [categories]
  );
  
  const firstCategoryId = activeCategories[0]?.id || null;
  const effectiveCategory = selectedCategory ?? firstCategoryId;

  const activeProducts = useMemo(() => 
    products?.filter(p => p.is_available !== false) || [],
    [products]
  );

  const filteredProducts = useMemo(() => 
    effectiveCategory
      ? activeProducts.filter(p => p.category_id === effectiveCategory)
      : [],
    [activeProducts, effectiveCategory]
  );

  // Process pending product click once pizzaData loads
  useEffect(() => {
    if (!pizzaDataLoading && pendingProductRef.current) {
      const product = pendingProductRef.current;
      pendingProductRef.current = null;
      processProductClick(product);
    }
  }, [pizzaDataLoading]);

  const processProductClick = (product: any) => {
    setSelectedProduct(product);
    const config = pizzaData?.configMap.get(product.id);
    
    if (config && config.flavorModalEnabled && config.flavorModalChannels.includes('table')) {
      setFlavorDialogOpen(true);
    } else {
      setOverrideUnitCount(undefined);
      setProductDialogOpen(true);
    }
  };

  const handleProductClick = (product: any) => {
    if (pizzaDataLoading) {
      // Data not ready yet — defer until it loads
      pendingProductRef.current = product;
      setSelectedProduct(product);
      return;
    }
    processProductClick(product);
  };

  const handleFlavorSelect = (count: number) => {
    setOverrideUnitCount(count);
    setProductDialogOpen(true);
  };

  const handleAddProduct = (
    product: any, 
    quantity: number, 
    complements: SelectedComplement[], 
    notes: string,
    subItems?: SubItemComplement[]
  ) => {
    const groupPriceTypes: Record<string, 'sum' | 'average' | 'highest' | 'lowest'> = {};
    for (const c of complements) {
      if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
        groupPriceTypes[c.group_id] = c.price_calculation_type;
      }
    }
    if (subItems) {
      for (const subItem of subItems) {
        for (const c of subItem.complements) {
          if (c.price_calculation_type && !groupPriceTypes[c.group_id]) {
            groupPriceTypes[c.group_id] = c.price_calculation_type;
          }
        }
      }
    }

    const sharedComplements: ComplementForCalc[] = complements.map(c => ({
      group_id: c.group_id,
      price: c.price,
      quantity: c.quantity,
    }));
    const subItemsForCalc: SubItemForCalc[] | undefined = subItems?.map(si => ({
      complements: si.complements.map(c => ({
        group_id: c.group_id,
        price: c.price,
        quantity: c.quantity,
      })),
    }));

    const complementsTotal = calculateFullComplementsPrice(sharedComplements, subItemsForCalc, groupPriceTypes);
    
    const productPrice = product.is_promotion && product.promotion_price 
      ? product.promotion_price 
      : product.price;
    const unitPrice = productPrice + complementsTotal;

    if (duplicateItems && quantity > 1) {
      for (let i = 0; i < quantity; i++) {
        onAddItem({
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
    } else {
      onAddItem({
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
      });
    }
  };

  return (
    <>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Categories sidebar */}
        <div className="flex h-full">
          <div className="w-44 border-r bg-muted/30 flex-shrink-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {activeCategories.map(cat => (
                  <Button
                    key={cat.id}
                    variant={effectiveCategory === cat.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start text-sm"
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.icon && <span className="mr-2">{cat.icon}</span>}
                    <span className="truncate">{cat.name}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleProductClick(product)}
                    >
                      <CardContent className="p-2">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded-md mb-2"
                          />
                        ) : (
                          <div className="w-full h-20 bg-muted rounded-md mb-2 flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">Sem foto</span>
                          </div>
                        )}
                        <p className="font-medium text-xs truncate">{product.name}</p>
                        <div className="flex items-center gap-1">
                          {product.is_promotion && product.promotion_price ? (
                            <>
                              <span className="text-muted-foreground line-through text-[10px]">
                                {formatCurrency(product.price)}
                              </span>
                              <span className="text-primary font-semibold text-xs">
                                {formatCurrency(product.promotion_price)}
                              </span>
                            </>
                          ) : (
                            <span className="text-primary font-semibold text-xs">
                              {formatCurrency(product.price)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <p className="text-sm">Nenhum produto encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      <PizzaFlavorCountDialog
        open={flavorDialogOpen}
        onOpenChange={setFlavorDialogOpen}
        productName={selectedProduct?.name || ''}
        productPrice={selectedProduct?.is_promotion && selectedProduct?.promotion_price ? selectedProduct.promotion_price : selectedProduct?.price ?? 0}
        maxFlavors={pizzaData?.maxFlavorsMap.get(selectedProduct?.id) ?? 2}
        flavorOptions={pizzaData?.configMap.get(selectedProduct?.id)?.flavorOptions}
        onSelect={handleFlavorSelect}
      />

      <ProductDetailDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onAdd={handleAddProduct}
        duplicateItems={duplicateItems}
        channel="table"
        overrideUnitCount={overrideUnitCount}
      />
    </>
  );
}
