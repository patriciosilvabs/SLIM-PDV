import { useState, useEffect } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { useProductExtras, useProductExtrasMutations } from '@/hooks/useProductExtras';
import { useProductVariations, useProductVariationsMutations } from '@/hooks/useProductVariations';
import { useProductExtraLinks, useProductExtraLinksMutations } from '@/hooks/useProductExtraLinks';
import { useCombos, useComboMutations } from '@/hooks/useCombos';
import { useComboItems, useComboItemsMutations } from '@/hooks/useComboItems';
import { Plus, Edit, Trash2, Search, Link2, Package, GripVertical, MoreVertical, Star, Percent, Eye, EyeOff } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImageUpload } from '@/components/ImageUpload';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/SortableItem';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ComboItemForm {
  product_id: string;
  variation_id: string | null;
  quantity: number;
}

interface ProductForm {
  name: string;
  description: string;
  price: number;
  cost_price: number;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  is_promotion: boolean;
  promotion_price: number;
  label: string;
  internal_code: string;
  pdv_code: string;
  image_url: string | null;
}

const LABEL_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  { value: 'novidade', label: 'Novidade' },
  { value: 'mais_vendido', label: 'Mais Vendido' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'picante', label: 'Picante' },
];

export default function Menu() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: extras } = useProductExtras();
  const { data: variations } = useProductVariations();
  const { data: combos } = useCombos();
  const { data: comboItems } = useComboItems();
  const { createProduct, updateProduct, deleteProduct, updateSortOrder: updateProductSortOrder } = useProductMutations();
  const { createCategory, updateCategory, deleteCategory, updateSortOrder: updateCategorySortOrder } = useCategoryMutations();
  const { createExtra, updateExtra, deleteExtra } = useProductExtrasMutations();
  const { createVariation, updateVariation, deleteVariation } = useProductVariationsMutations();
  const { data: extraLinks } = useProductExtraLinks();
  const { setLinkedProducts } = useProductExtraLinksMutations();
  const { createCombo, updateCombo, deleteCombo } = useComboMutations();
  const { setComboItems } = useComboItemsMutations();
  
  const [mainTab, setMainTab] = useState('products');
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategorySortMode, setIsCategorySortMode] = useState(false);
  
  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productDialogTab, setProductDialogTab] = useState('info');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '', description: '', price: 0, cost_price: 0, category_id: '', 
    is_available: true, is_featured: false, is_promotion: false, promotion_price: 0,
    label: '', internal_code: '', pdv_code: '', image_url: null
  });
  const [productLinkedExtras, setProductLinkedExtras] = useState<string[]>([]);

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: '', is_active: true });

  // Extras dialog state
  const [isExtrasDialogOpen, setIsExtrasDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<any>(null);
  const [extraForm, setExtraForm] = useState({ name: '', description: '', price: 0, is_active: true });
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);

  // Variations dialog state
  const [isVariationsDialogOpen, setIsVariationsDialogOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<any>(null);
  const [variationForm, setVariationForm] = useState({ product_id: '', name: '', description: '', price_modifier: 0, is_active: true });

  // Combo dialog state
  const [isComboDialogOpen, setIsComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [comboForm, setComboForm] = useState({ name: '', description: '', image_url: null as string | null, combo_price: 0, is_active: true });
  const [comboItemsForm, setComboItemsForm] = useState<ComboItemForm[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter products by category and search
  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);

  // Calculate original price for combo
  const calculateOriginalPrice = () => {
    return comboItemsForm.reduce((total, item) => {
      const product = products?.find(p => p.id === item.product_id);
      if (!product) return total;
      const variation = variations?.find(v => v.id === item.variation_id);
      const price = product.price + (variation?.price_modifier ?? 0);
      return total + (price * item.quantity);
    }, 0);
  };

  const originalPrice = calculateOriginalPrice();
  const savings = originalPrice - comboForm.combo_price;
  const savingsPercent = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;

  // Handlers
  const handleSaveProduct = async () => {
    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      price: productForm.price,
      cost_price: productForm.cost_price || 0,
      category_id: productForm.category_id || null,
      is_available: productForm.is_available,
      is_featured: productForm.is_featured,
      is_promotion: productForm.is_promotion,
      promotion_price: productForm.is_promotion ? productForm.promotion_price : null,
      label: productForm.label || null,
      internal_code: productForm.internal_code || null,
      pdv_code: productForm.pdv_code || null,
      image_url: productForm.image_url,
      preparation_time: 15,
      sort_order: editingProduct?.sort_order ?? (products?.length ?? 0)
    };

    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
    } else {
      await createProduct.mutateAsync(productData);
    }
    closeProductDialog();
  };

  const handleSaveCategory = async () => {
    const categoryData = {
      name: categoryForm.name,
      description: categoryForm.description || null,
      icon: categoryForm.icon || null,
      is_active: categoryForm.is_active,
      sort_order: editingCategory?.sort_order ?? (categories?.length ?? 0)
    };

    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...categoryData });
    } else {
      await createCategory.mutateAsync(categoryData);
    }
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', icon: '', is_active: true });
  };

  const handleSaveExtra = async () => {
    let extraId = editingExtra?.id;
    if (editingExtra) {
      await updateExtra.mutateAsync({ id: editingExtra.id, ...extraForm });
    } else {
      const result = await createExtra.mutateAsync(extraForm);
      extraId = result.id;
    }
    if (extraId) {
      await setLinkedProducts.mutateAsync({ extraId, productIds: linkedProductIds });
    }
    setIsExtrasDialogOpen(false);
    setEditingExtra(null);
    setExtraForm({ name: '', description: '', price: 0, is_active: true });
    setLinkedProductIds([]);
  };

  const handleSaveVariation = async () => {
    if (editingVariation) {
      await updateVariation.mutateAsync({ 
        id: editingVariation.id, 
        name: variationForm.name, 
        description: variationForm.description,
        price_modifier: variationForm.price_modifier, 
        is_active: variationForm.is_active 
      });
    } else {
      await createVariation.mutateAsync(variationForm);
    }
    setIsVariationsDialogOpen(false);
    setEditingVariation(null);
    setVariationForm({ product_id: '', name: '', description: '', price_modifier: 0, is_active: true });
  };

  const handleSaveCombo = async () => {
    const comboData = {
      name: comboForm.name,
      description: comboForm.description || null,
      image_url: comboForm.image_url,
      original_price: originalPrice,
      combo_price: comboForm.combo_price,
      is_active: comboForm.is_active
    };

    let comboId = editingCombo?.id;
    if (editingCombo) {
      await updateCombo.mutateAsync({ id: editingCombo.id, ...comboData });
    } else {
      const result = await createCombo.mutateAsync(comboData);
      comboId = result.id;
    }

    if (comboId) {
      await setComboItems.mutateAsync({ 
        comboId, 
        items: comboItemsForm.filter(item => item.product_id).map(item => ({
          product_id: item.product_id,
          variation_id: item.variation_id || null,
          quantity: item.quantity
        }))
      });
    }

    setIsComboDialogOpen(false);
    setEditingCombo(null);
    setComboForm({ name: '', description: '', image_url: null, combo_price: 0, is_active: true });
    setComboItemsForm([]);
  };

  const closeProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductDialogTab('info');
    setProductForm({
      name: '', description: '', price: 0, cost_price: 0, category_id: '', 
      is_available: true, is_featured: false, is_promotion: false, promotion_price: 0,
      label: '', internal_code: '', pdv_code: '', image_url: null
    });
    setProductLinkedExtras([]);
  };

  const openEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      cost_price: product.cost_price || 0,
      category_id: product.category_id || '',
      is_available: product.is_available ?? true,
      is_featured: product.is_featured ?? false,
      is_promotion: product.is_promotion ?? false,
      promotion_price: product.promotion_price || 0,
      label: product.label || '',
      internal_code: product.internal_code || '',
      pdv_code: product.pdv_code || '',
      image_url: product.image_url
    });
    setProductDialogTab('info');
    setIsProductDialogOpen(true);
  };

  const openEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      is_active: category.is_active ?? true
    });
    setIsCategoryDialogOpen(true);
  };

  const openEditExtra = (extra: any) => {
    setEditingExtra(extra);
    setExtraForm({ name: extra.name, description: extra.description || '', price: extra.price, is_active: extra.is_active ?? true });
    const linkedIds = extraLinks?.filter(link => link.extra_id === extra.id).map(link => link.product_id) || [];
    setLinkedProductIds(linkedIds);
    setIsExtrasDialogOpen(true);
  };

  const openEditVariation = (variation: any) => {
    setEditingVariation(variation);
    setVariationForm({
      product_id: variation.product_id,
      name: variation.name,
      description: variation.description || '',
      price_modifier: variation.price_modifier ?? 0,
      is_active: variation.is_active ?? true
    });
    setIsVariationsDialogOpen(true);
  };

  const openEditCombo = (combo: any) => {
    setEditingCombo(combo);
    setComboForm({
      name: combo.name,
      description: combo.description || '',
      image_url: combo.image_url,
      combo_price: combo.combo_price,
      is_active: combo.is_active ?? true
    });
    const items = comboItems?.filter(item => item.combo_id === combo.id).map(item => ({
      product_id: item.product_id,
      variation_id: item.variation_id,
      quantity: item.quantity
    })) || [];
    setComboItemsForm(items);
    setIsComboDialogOpen(true);
  };

  const getLinkedProductCount = (extraId: string) => {
    return extraLinks?.filter(link => link.extra_id === extraId).length || 0;
  };

  const toggleLinkedProduct = (productId: string) => {
    setLinkedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const addComboItem = () => {
    setComboItemsForm(prev => [...prev, { product_id: '', variation_id: null, quantity: 1 }]);
  };

  const updateComboItemForm = (index: number, field: keyof ComboItemForm, value: any) => {
    setComboItemsForm(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeComboItemForm = (index: number) => {
    setComboItemsForm(prev => prev.filter((_, i) => i !== index));
  };

  const getProductVariations = (productId: string) => {
    return variations?.filter(v => v.product_id === productId) || [];
  };

  const getComboItemCount = (comboId: string) => {
    return comboItems?.filter(item => item.combo_id === comboId).length || 0;
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    
    const reordered = arrayMove(categories, oldIndex, newIndex);
    const updates = reordered.map((category, index) => ({ id: category.id, sort_order: index }));
    updateCategorySortOrder.mutate(updates);
  };

  return (
    <PDVLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Cardápio</h1>
            <p className="text-muted-foreground text-sm">Gerencie produtos, complementos e opções</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-10 w-64" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            <Button variant="outline" onClick={() => setIsComboDialogOpen(true)}>
              <Package className="h-4 w-4 mr-2" />Combo
            </Button>
            <Button onClick={() => setIsProductDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Produto
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="flex-1 flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="products">PRODUTOS</TabsTrigger>
            <TabsTrigger value="extras">COMPLEMENTOS</TabsTrigger>
            <TabsTrigger value="variations">OPÇÕES</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="flex-1 mt-4">
            <div className="flex gap-4 h-full">
              {/* Category Sidebar */}
              <Card className="w-64 shrink-0">
                <CardHeader className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">CATEGORIAS</CardTitle>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => setIsCategorySortMode(!isCategorySortMode)}
                      >
                        <GripVertical className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '', is_active: true }); setIsCategoryDialogOpen(true); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    {isCategorySortMode && categories?.length ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                          <div className="p-2 space-y-1">
                            {categories.map((category) => (
                              <SortableItem key={category.id} id={category.id}>
                                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-grab">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span>{category.icon || '📁'}</span>
                                  <span className="text-sm truncate flex-1">{category.name}</span>
                                </div>
                              </SortableItem>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => setSelectedCategoryId(null)}
                          className={`w-full text-left p-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                            selectedCategoryId === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          <span>📋</span>
                          <span className="flex-1 truncate">Todos</span>
                          <span className="text-xs opacity-70">{products?.length || 0}</span>
                        </button>
                        {categories?.map((category) => (
                          <div key={category.id} className="group flex items-center">
                            <button
                              onClick={() => setSelectedCategoryId(category.id)}
                              className={`flex-1 text-left p-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                selectedCategoryId === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                              }`}
                            >
                              <span>{category.icon || '📁'}</span>
                              <span className="flex-1 truncate">{category.name}</span>
                              <span className="text-xs opacity-70">
                                {products?.filter(p => p.category_id === category.id).length || 0}
                              </span>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditCategory(category)}>
                                  <Edit className="h-4 w-4 mr-2" />Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteCategory.mutate(category.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Products Grid */}
              <div className="flex-1">
                {/* Category Header */}
                {selectedCategory && (
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <span>{selectedCategory.icon || '📁'}</span>
                        {selectedCategory.name}
                      </h2>
                      {selectedCategory.description && (
                        <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditCategory(selectedCategory)}>
                      Editar Categoria
                    </Button>
                  </div>
                )}

                {/* Products Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts?.map((product) => (
                    <Card key={product.id} className="group overflow-hidden">
                      <div className="relative aspect-square bg-muted">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                        )}
                        {/* Status Badge */}
                        <Badge 
                          variant={product.is_available ? "default" : "secondary"}
                          className="absolute top-2 left-2 text-xs"
                        >
                          {product.is_available ? 'ATIVO' : 'OCULTO'}
                        </Badge>
                        {/* Featured Badge */}
                        {product.is_featured && (
                          <Badge variant="outline" className="absolute top-2 right-2 bg-background">
                            <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                            Destaque
                          </Badge>
                        )}
                        {/* Promotion Badge */}
                        {product.is_promotion && (
                          <Badge variant="destructive" className="absolute bottom-2 left-2">
                            <Percent className="h-3 w-3 mr-1" />
                            Promoção
                          </Badge>
                        )}
                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditProduct(product)}>
                              <Edit className="h-4 w-4 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateProduct.mutate({ id: product.id, is_available: !product.is_available })}
                            >
                              {product.is_available ? (
                                <><EyeOff className="h-4 w-4 mr-2" />Ocultar</>
                              ) : (
                                <><Eye className="h-4 w-4 mr-2" />Mostrar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteProduct.mutate(product.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium truncate">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {product.is_promotion && product.promotion_price ? (
                            <>
                              <span className="text-sm text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                              <span className="font-semibold text-destructive">{formatCurrency(product.promotion_price)}</span>
                            </>
                          ) : (
                            <span className="font-semibold">{formatCurrency(product.price)}</span>
                          )}
                        </div>
                        {product.label && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {LABEL_OPTIONS.find(l => l.value === product.label)?.label || product.label}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {!filteredProducts?.length && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Extras Tab */}
          <TabsContent value="extras" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Complementos</CardTitle>
                <Button onClick={() => { setEditingExtra(null); setExtraForm({ name: '', description: '', price: 0, is_active: true }); setLinkedProductIds([]); setIsExtrasDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Novo Complemento
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Vínculos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extras?.map((extra) => (
                      <TableRow key={extra.id}>
                        <TableCell className="font-medium">{extra.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{extra.description || '-'}</TableCell>
                        <TableCell>{formatCurrency(extra.price)}</TableCell>
                        <TableCell>
                          {getLinkedProductCount(extra.id) > 0 ? (
                            <Badge variant="secondary">{getLinkedProductCount(extra.id)} produto(s)</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={extra.is_active ? "default" : "secondary"}>
                            {extra.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditExtra(extra)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteExtra.mutate(extra.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!extras?.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum complemento cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variations Tab */}
          <TabsContent value="variations" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Opções (Variações)</CardTitle>
                <Button onClick={() => { setEditingVariation(null); setVariationForm({ product_id: '', name: '', description: '', price_modifier: 0, is_active: true }); setIsVariationsDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Nova Opção
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Opção</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Modificador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variations?.map((variation) => (
                      <TableRow key={variation.id}>
                        <TableCell>{products?.find(p => p.id === variation.product_id)?.name || '-'}</TableCell>
                        <TableCell className="font-medium">{variation.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{variation.description || '-'}</TableCell>
                        <TableCell>{formatCurrency(variation.price_modifier ?? 0)}</TableCell>
                        <TableCell>
                          <Badge variant={variation.is_active ? "default" : "secondary"}>
                            {variation.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditVariation(variation)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteVariation.mutate(variation.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!variations?.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma opção cadastrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Product Dialog with 3 Tabs */}
        <Dialog open={isProductDialogOpen} onOpenChange={(open) => { if (!open) closeProductDialog(); else setIsProductDialogOpen(true); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar' : 'Novo'} Produto</DialogTitle>
            </DialogHeader>
            <Tabs value={productDialogTab} onValueChange={setProductDialogTab}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="info">INFORMAÇÕES</TabsTrigger>
                <TabsTrigger value="complements">COMPLEMENTOS</TabsTrigger>
                <TabsTrigger value="availability">DISPONIBILIDADE</TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="flex gap-4">
                  <ImageUpload 
                    value={productForm.image_url} 
                    onChange={(url) => setProductForm({...productForm, image_url: url})}
                    folder="products"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label>Nome do Produto *</Label>
                      <Input 
                        placeholder="Ex: Pizza Marguerita" 
                        value={productForm.name} 
                        onChange={(e) => setProductForm({...productForm, name: e.target.value})} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Categoria</Label>
                        <Select value={productForm.category_id} onValueChange={(v) => setProductForm({...productForm, category_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Etiqueta</Label>
                        <Select value={productForm.label} onValueChange={(v) => setProductForm({...productForm, label: v})}>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                          <SelectContent>
                            {LABEL_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_featured} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_featured: checked})} 
                    />
                    <Label>Em destaque</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_available} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_available: checked})} 
                    />
                    <Label>Disponível</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Preço de Venda *</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00"
                      value={productForm.price} 
                      onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Preço de Custo</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00"
                      value={productForm.cost_price} 
                      onChange={(e) => setProductForm({...productForm, cost_price: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={productForm.is_promotion} 
                      onCheckedChange={(checked) => setProductForm({...productForm, is_promotion: checked})} 
                    />
                    <Label>Ativar promoção</Label>
                  </div>
                  {productForm.is_promotion && (
                    <div className="space-y-1">
                      <Label>Preço Promocional</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0,00"
                        value={productForm.promotion_price} 
                        onChange={(e) => setProductForm({...productForm, promotion_price: parseFloat(e.target.value) || 0})} 
                      />
                      {productForm.price > 0 && productForm.promotion_price > 0 && (
                        <p className="text-xs text-green-600">
                          Desconto de {((1 - productForm.promotion_price / productForm.price) * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Textarea 
                    placeholder="Descreva o produto..." 
                    value={productForm.description} 
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Código Interno</Label>
                    <Input 
                      placeholder="Ex: PIZ001" 
                      value={productForm.internal_code} 
                      onChange={(e) => setProductForm({...productForm, internal_code: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Código PDV</Label>
                    <Input 
                      placeholder="Ex: 12345" 
                      value={productForm.pdv_code} 
                      onChange={(e) => setProductForm({...productForm, pdv_code: e.target.value})} 
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Complements Tab */}
              <TabsContent value="complements" className="space-y-4 pt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Os complementos são gerenciados na aba "COMPLEMENTOS".</p>
                  <p className="text-sm">Você pode vincular complementos específicos a este produto por lá.</p>
                </div>
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="space-y-4 pt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Configuração de disponibilidade por horário em breve.</p>
                  <p className="text-sm mt-2">Por enquanto, use o toggle "Disponível" na aba Informações.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeProductDialog}>Cancelar</Button>
              <Button onClick={handleSaveProduct} disabled={!productForm.name}>Salvar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => { setIsCategoryDialogOpen(open); if (!open) { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '', is_active: true }); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Pizzas" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Ícone</Label>
                  <Input placeholder="🍕" value={categoryForm.icon} onChange={(e) => setCategoryForm({...categoryForm, icon: e.target.value})} className="text-center text-lg" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Ex: Pizzas artesanais assadas em forno a lenha" 
                  value={categoryForm.description} 
                  onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={categoryForm.is_active} onCheckedChange={(checked) => setCategoryForm({...categoryForm, is_active: checked})} />
                <Label>Categoria ativa</Label>
              </div>
              <Button onClick={handleSaveCategory} className="w-full" disabled={!categoryForm.name}>
                {editingCategory ? 'Atualizar' : 'Criar'} Categoria
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extras Dialog */}
        <Dialog open={isExtrasDialogOpen} onOpenChange={(open) => { setIsExtrasDialogOpen(open); if (!open) { setEditingExtra(null); setExtraForm({ name: '', description: '', price: 0, is_active: true }); setLinkedProductIds([]); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingExtra ? 'Editar' : 'Novo'} Complemento</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Bacon extra" value={extraForm.name} onChange={(e) => setExtraForm({...extraForm, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Preço</Label>
                  <Input type="number" step="0.01" value={extraForm.price} onChange={(e) => setExtraForm({...extraForm, price: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Ex: Fatias crocantes de bacon defumado" 
                  value={extraForm.description} 
                  onChange={(e) => setExtraForm({...extraForm, description: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Vincular a produtos específicos
                  <span className="text-xs text-muted-foreground font-normal">(vazio = todos)</span>
                </Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {products?.map(product => (
                    <div key={product.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`link-${product.id}`}
                        checked={linkedProductIds.includes(product.id)}
                        onCheckedChange={() => toggleLinkedProduct(product.id)}
                      />
                      <Label htmlFor={`link-${product.id}`} className="text-sm cursor-pointer flex-1">{product.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={extraForm.is_active} onCheckedChange={(checked) => setExtraForm({...extraForm, is_active: checked})} />
                <Label>Ativo</Label>
              </div>
              <Button onClick={handleSaveExtra} className="w-full" disabled={!extraForm.name}>
                {editingExtra ? 'Atualizar' : 'Criar'} Complemento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Variations Dialog */}
        <Dialog open={isVariationsDialogOpen} onOpenChange={(open) => { setIsVariationsDialogOpen(open); if (!open) { setEditingVariation(null); setVariationForm({ product_id: '', name: '', description: '', price_modifier: 0, is_active: true }); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingVariation ? 'Editar' : 'Nova'} Opção</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Produto *</Label>
                <Select value={variationForm.product_id} onValueChange={(v) => setVariationForm({...variationForm, product_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>
                    {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1">
                  <Label>Nome da Opção</Label>
                  <Input placeholder="Ex: Grande, Média" value={variationForm.name} onChange={(e) => setVariationForm({...variationForm, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>+/- Preço</Label>
                  <Input type="number" step="0.01" value={variationForm.price_modifier} onChange={(e) => setVariationForm({...variationForm, price_modifier: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea 
                  placeholder="Ex: Tamanho grande, ideal para 3-4 pessoas" 
                  value={variationForm.description} 
                  onChange={(e) => setVariationForm({...variationForm, description: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={variationForm.is_active} onCheckedChange={(checked) => setVariationForm({...variationForm, is_active: checked})} />
                <Label>Ativo</Label>
              </div>
              <Button onClick={handleSaveVariation} className="w-full" disabled={!variationForm.product_id || !variationForm.name}>
                {editingVariation ? 'Atualizar' : 'Criar'} Opção
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Combo Dialog */}
        <Dialog open={isComboDialogOpen} onOpenChange={(open) => { setIsComboDialogOpen(open); if (!open) { setEditingCombo(null); setComboForm({ name: '', description: '', image_url: null, combo_price: 0, is_active: true }); setComboItemsForm([]); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingCombo ? 'Editar' : 'Novo'} Combo</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex gap-4">
                <ImageUpload 
                  value={comboForm.image_url} 
                  onChange={(url) => setComboForm({...comboForm, image_url: url})}
                  folder="combos"
                />
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <Label>Nome do Combo</Label>
                    <Input placeholder="Ex: Combo Família" value={comboForm.name} onChange={(e) => setComboForm({...comboForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Textarea 
                      placeholder="Ex: 1 Pizza G + 1 Refri 2L + Sobremesa" 
                      value={comboForm.description || ''} 
                      onChange={(e) => setComboForm({...comboForm, description: e.target.value})}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Itens do Combo</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {comboItemsForm.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select value={item.product_id} onValueChange={(v) => { updateComboItemForm(index, 'product_id', v); updateComboItemForm(index, 'variation_id', null); }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                        <SelectContent>
                          {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={item.variation_id || 'none'} onValueChange={(v) => updateComboItemForm(index, 'variation_id', v === 'none' ? null : v)}>
                        <SelectTrigger className="w-32"><SelectValue placeholder="Variação" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Padrão</SelectItem>
                          {getProductVariations(item.product_id).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={1} className="w-16" value={item.quantity} onChange={(e) => updateComboItemForm(index, 'quantity', parseInt(e.target.value) || 1)} />
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeComboItemForm(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addComboItem} className="w-full"><Plus className="h-4 w-4 mr-1" />Adicionar item</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Preço Original (soma)</Label>
                  <p className="text-lg font-semibold">{formatCurrency(originalPrice)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Preço do Combo</Label>
                  <Input type="number" step="0.01" value={comboForm.combo_price} onChange={(e) => setComboForm({...comboForm, combo_price: parseFloat(e.target.value) || 0})} />
                  {savings > 0 && (
                    <p className="text-xs text-green-600 mt-1">Economia: {formatCurrency(savings)} ({savingsPercent.toFixed(0)}%)</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={comboForm.is_active} onCheckedChange={(checked) => setComboForm({...comboForm, is_active: checked})} />
                <Label>Ativo</Label>
              </div>

              <Button onClick={handleSaveCombo} className="w-full" disabled={!comboForm.name || comboItemsForm.length === 0}>Salvar Combo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PDVLayout>
  );
}
