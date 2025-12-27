import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { useCombos, useComboMutations } from '@/hooks/useCombos';
import { useComboItems, useComboItemsMutations } from '@/hooks/useComboItems';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useComplementGroups, useComplementGroupsMutations, ComplementGroup } from '@/hooks/useComplementGroups';
import { useComplementOptions, useComplementOptionsMutations, ComplementOption } from '@/hooks/useComplementOptions';
import { useComplementGroupOptions, useComplementGroupOptionsMutations } from '@/hooks/useComplementGroupOptions';
import { useProductComplementGroups, useProductComplementGroupsMutations } from '@/hooks/useProductComplementGroups';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { Plus, Edit, Trash2, Search, Link2, Package, GripVertical, MoreVertical, Star, Percent, Eye, EyeOff, Printer, Copy, Filter, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImageUpload } from '@/components/ImageUpload';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItem } from '@/components/SortableItem';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ComplementGroupDialog } from '@/components/menu/ComplementGroupDialog';
import { ComplementOptionDialog } from '@/components/menu/ComplementOptionDialog';

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
  print_sector_id: string | null;
}

const LABEL_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'novidade', label: 'Novidade' },
  { value: 'mais_vendido', label: 'Mais Vendido' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'picante', label: 'Picante' },
];

export default function Menu() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: variations } = useProductVariations();
  const { data: combos } = useCombos();
  const { data: comboItems } = useComboItems();
  const { data: complementGroups } = useComplementGroups();
  const { data: complementOptions } = useComplementOptions();
  const { data: printSectors } = usePrintSectors();
  const { createProduct, updateProduct, deleteProduct, updateSortOrder: updateProductSortOrder } = useProductMutations();
  const { createCategory, updateCategory, deleteCategory, updateSortOrder: updateCategorySortOrder } = useCategoryMutations();
  const { createCombo, updateCombo, deleteCombo } = useComboMutations();
  const { setComboItems } = useComboItemsMutations();
  const { createGroup, updateGroup, deleteGroup } = useComplementGroupsMutations();
  const { createOption, updateOption, deleteOption } = useComplementOptionsMutations();
  const { setGroupOptions } = useComplementGroupOptionsMutations();
  const { setProductGroups, setGroupsForProduct } = useProductComplementGroupsMutations();
  
  const canManageMenu = hasPermission('menu_manage');
  
  // ALL STATE HOOKS MUST BE BEFORE CONDITIONAL RETURN
  const [mainTab, setMainTab] = useState('categories');
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategorySortMode, setIsCategorySortMode] = useState(false);
  
  // Advanced filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPromotion, setFilterPromotion] = useState<'all' | 'yes' | 'no'>('all');
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'yes' | 'no'>('all');
  
  // Drag & drop between categories
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  
  // Group counts state
  const [groupCounts, setGroupCounts] = useState<Record<string, { options: number, products: number }>>({});
  
  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productDialogTab, setProductDialogTab] = useState('info');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '', description: '', price: 0, cost_price: 0, category_id: '', 
    is_available: true, is_featured: false, is_promotion: false, promotion_price: 0,
    label: 'none', internal_code: '', pdv_code: '', image_url: null, print_sector_id: null
  });
  const [productLinkedExtras, setProductLinkedExtras] = useState<string[]>([]);
  const [productLinkedGroupIds, setProductLinkedGroupIds] = useState<string[]>([]);

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: '', is_active: true });

  // Complement Group dialog state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ComplementGroup | null>(null);
  const [groupLinkedOptionIds, setGroupLinkedOptionIds] = useState<string[]>([]);
  const [groupLinkedProductIds, setGroupLinkedProductIds] = useState<string[]>([]);

  // Complement Option dialog state
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ComplementOption | null>(null);

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

  // Fetch group counts
  useEffect(() => {
    const fetchCounts = async () => {
      const [optionsResult, productsResult] = await Promise.all([
        supabase.from('complement_group_options').select('group_id'),
        supabase.from('product_complement_groups').select('group_id')
      ]);
      
      const counts: Record<string, { options: number, products: number }> = {};
      optionsResult.data?.forEach(o => {
        counts[o.group_id] = counts[o.group_id] || { options: 0, products: 0 };
        counts[o.group_id].options++;
      });
      productsResult.data?.forEach(p => {
        counts[p.group_id] = counts[p.group_id] || { options: 0, products: 0 };
        counts[p.group_id].products++;
      });
      setGroupCounts(counts);
    };
    if (complementGroups?.length) {
      fetchCounts();
    }
  }, [complementGroups]);

  // Auto-select first category when categories load and none is selected
  useEffect(() => {
    if (categories?.length && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('menu_view')) {
    return <AccessDenied permission="menu_view" />;
  }

  // Filter products by category, search, and advanced filters
  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && p.is_available) || 
      (filterStatus === 'inactive' && !p.is_available);
    const matchesPromotion = filterPromotion === 'all' || 
      (filterPromotion === 'yes' && p.is_promotion) || 
      (filterPromotion === 'no' && !p.is_promotion);
    const matchesFeatured = filterFeatured === 'all' || 
      (filterFeatured === 'yes' && p.is_featured) || 
      (filterFeatured === 'no' && !p.is_featured);
    return matchesSearch && matchesCategory && matchesStatus && matchesPromotion && matchesFeatured;
  });

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const draggedProduct = products?.find(p => p.id === draggedProductId);
  const hasActiveFilters = filterStatus !== 'all' || filterPromotion !== 'all' || filterFeatured !== 'all';
  
  const clearFilters = () => {
    setFilterStatus('all');
    setFilterPromotion('all');
    setFilterFeatured('all');
  };

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
      label: productForm.label === 'none' ? null : (productForm.label || null),
      internal_code: productForm.internal_code || null,
      pdv_code: productForm.pdv_code || null,
      image_url: productForm.image_url,
      preparation_time: 15,
      sort_order: editingProduct?.sort_order ?? (products?.length ?? 0),
      print_sector_id: productForm.print_sector_id || null,
    };

    let productId = editingProduct?.id;
    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
    } else {
      const result = await createProduct.mutateAsync(productData);
      productId = result.id;
    }
    
    // Save linked groups
    if (productId) {
      await setGroupsForProduct.mutateAsync({ productId, groupIds: productLinkedGroupIds });
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

  const handleDuplicateCategory = async (category: any) => {
    try {
      // 1. Create new category with "(cópia)" suffix
      const newCategoryData = {
        name: `${category.name} (cópia)`,
        description: category.description || null,
        icon: category.icon || null,
        is_active: category.is_active ?? true,
        sort_order: (categories?.length ?? 0)
      };
      const newCategory = await createCategory.mutateAsync(newCategoryData);
      
      // 2. Get all products from the original category
      const categoryProducts = products?.filter(p => p.category_id === category.id) || [];
      
      // 3. Duplicate each product to the new category
      for (const product of categoryProducts) {
        const newProductData = {
          name: product.name,
          description: product.description || null,
          price: product.price,
          cost_price: product.cost_price || 0,
          category_id: newCategory.id,
          is_available: product.is_available ?? true,
          is_featured: product.is_featured ?? false,
          is_promotion: product.is_promotion ?? false,
          promotion_price: product.promotion_price || null,
          label: product.label || null,
          internal_code: product.internal_code || null,
          pdv_code: product.pdv_code || null,
          image_url: product.image_url,
          preparation_time: product.preparation_time || 15,
          sort_order: product.sort_order || 0,
          print_sector_id: product.print_sector_id || null,
        };
        const newProduct = await createProduct.mutateAsync(newProductData);
        
        // 4. Copy complement group links
        const { data: linkedGroups } = await supabase
          .from('product_complement_groups')
          .select('group_id, sort_order')
          .eq('product_id', product.id);
        
        if (linkedGroups?.length) {
          await setGroupsForProduct.mutateAsync({ 
            productId: newProduct.id, 
            groupIds: linkedGroups.map(g => g.group_id) 
          });
        }
      }
    } catch (error) {
      console.error('Error duplicating category:', error);
    }
  };

  const handleDuplicateGroup = async (group: ComplementGroup) => {
    try {
      // 1. Create new group with "(cópia)" suffix
      const newGroupData = {
        name: `${group.name} (cópia)`,
        description: group.description,
        selection_type: group.selection_type,
        is_required: group.is_required,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
        visibility: group.visibility,
        channels: group.channels,
        sort_order: (complementGroups?.length ?? 0),
        is_active: group.is_active,
        price_calculation_type: group.price_calculation_type,
      };
      const newGroup = await createGroup.mutateAsync(newGroupData);
      
      // 2. Get linked options from original group
      const { data: groupOptions } = await supabase
        .from('complement_group_options')
        .select('option_id')
        .eq('group_id', group.id)
        .order('sort_order');
      
      // 3. Link same options to new group
      if (groupOptions?.length) {
        await setGroupOptions.mutateAsync({ 
          groupId: newGroup.id, 
          optionIds: groupOptions.map(o => o.option_id) 
        });
      }
    } catch (error) {
      console.error('Error duplicating group:', error);
    }
  };

  const handleSaveComplementGroup = async (
    groupData: Partial<ComplementGroup>, 
    optionIds: string[]
  ) => {
    let groupId = editingGroup?.id;
    if (editingGroup) {
      await updateGroup.mutateAsync({ id: editingGroup.id, ...groupData } as any);
    } else {
      const result = await createGroup.mutateAsync(groupData as any);
      groupId = result.id;
    }
    if (groupId) {
      await setGroupOptions.mutateAsync({ groupId, optionIds });
    }
    setIsGroupDialogOpen(false);
    setEditingGroup(null);
    setGroupLinkedOptionIds([]);
    setGroupLinkedProductIds([]);
  };

  const handleSaveComplementOption = async (optionData: Partial<ComplementOption>) => {
    if (editingOption) {
      await updateOption.mutateAsync({ id: editingOption.id, ...optionData } as any);
    } else {
      await createOption.mutateAsync(optionData as any);
    }
    setIsOptionDialogOpen(false);
    setEditingOption(null);
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
      label: 'none', internal_code: '', pdv_code: '', image_url: null, print_sector_id: null
    });
    setProductLinkedExtras([]);
    setProductLinkedGroupIds([]);
  };

  const openEditProduct = async (product: any) => {
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
      label: product.label || 'none',
      internal_code: product.internal_code || '',
      pdv_code: product.pdv_code || '',
      image_url: product.image_url,
      print_sector_id: product.print_sector_id || null,
    });
    // Load linked groups
    const { data: linkedGroups } = await supabase
      .from('product_complement_groups')
      .select('group_id')
      .eq('product_id', product.id)
      .order('sort_order');
    setProductLinkedGroupIds(linkedGroups?.map(g => g.group_id) || []);
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

  const getGroupOptionCount = (groupId: string) => {
    return groupCounts[groupId]?.options || 0;
  };

  const getGroupProductCount = (groupId: string) => {
    return groupCounts[groupId]?.products || 0;
  };

  const getOptionGroupCount = (optionId: string) => {
    // This would require fetching from complement_group_options
    return 0; // Placeholder - will be updated with actual data
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

  const handleProductDragStart = (event: DragStartEvent) => {
    setDraggedProductId(event.active.id as string);
  };

  const handleProductDragEnd = async (event: DragEndEvent) => {
    setDraggedProductId(null);
    const { active, over } = event;
    if (!over) return;
    
    const productId = active.id as string;
    const targetCategoryId = over.id as string;
    
    // Check if dropped on a category (not the same as current)
    const product = products?.find(p => p.id === productId);
    if (product && product.category_id !== targetCategoryId && categories?.find(c => c.id === targetCategoryId)) {
      await updateProduct.mutateAsync({ id: productId, category_id: targetCategoryId });
    }
  };

  // Droppable category component
  function DroppableCategory({ category, isActive }: { category: any; isActive: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: category.id });
    
    return (
      <div
        ref={setNodeRef}
        className={`p-3 rounded-lg border-2 transition-all ${
          isOver ? 'border-primary bg-primary/10' : 'border-transparent'
        } ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
      >
        <div className="flex items-center gap-2">
          <span>{category.icon || '📁'}</span>
          <span className="flex-1 truncate font-medium">{category.name}</span>
          <Badge variant="secondary" className="text-xs">
            {products?.filter(p => p.category_id === category.id).length || 0}
          </Badge>
        </div>
      </div>
    );
  }

  // Draggable product component
  function DraggableProductCard({ product }: { product: any }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: product.id });
    
    const style = {
      transform: CSS.Transform.toString(transform),
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <Card 
        ref={setNodeRef} 
        style={style}
        className={`group overflow-hidden cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-primary' : ''}`}
        {...attributes}
        {...listeners}
      >
        <div className="relative aspect-square bg-muted">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          <Badge 
            variant={product.is_available ? "default" : "secondary"}
            className="absolute top-2 left-2 text-xs"
          >
            {product.is_available ? 'ATIVO' : 'OCULTO'}
          </Badge>
          {product.is_featured && (
            <Badge variant="outline" className="absolute top-2 right-2 bg-background">
              <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
              Destaque
            </Badge>
          )}
          {product.is_promotion && (
            <Badge variant="destructive" className="absolute bottom-2 left-2">
              <Percent className="h-3 w-3 mr-1" />
              Promoção
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="secondary" 
                size="icon" 
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditProduct(product); }}>
                <Edit className="h-4 w-4 mr-2" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); updateProduct.mutate({ id: product.id, is_available: !product.is_available }); }}
              >
                {product.is_available ? (
                  <><EyeOff className="h-4 w-4 mr-2" />Ocultar</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Mostrar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteProduct.mutate(product.id); }}
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
          {product.label && product.label !== 'none' && (
            <Badge variant="outline" className="mt-2 text-xs">
              {LABEL_OPTIONS.find(l => l.value === product.label)?.label || product.label}
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

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
            <TabsTrigger value="categories">CATEGORIAS</TabsTrigger>
            <TabsTrigger value="products">PRODUTOS</TabsTrigger>
            <TabsTrigger value="extras">COMPLEMENTOS</TabsTrigger>
            <TabsTrigger value="variations">OPÇÕES</TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Categorias</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organize suas categorias de produtos. Arraste para reordenar.
                  </p>
                </div>
                <Button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '', is_active: true }); setIsCategoryDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Nova Categoria
                </Button>
              </CardHeader>
              <CardContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                  <SortableContext items={categories?.map(c => c.id) || []} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {categories?.map((category) => (
                        <SortableItem key={category.id} id={category.id}>
                          <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                            <span className="text-2xl">{category.icon || '📁'}</span>
                            <div className="flex-1">
                              <h3 className="font-medium">{category.name}</h3>
                              {category.description && (
                                <p className="text-sm text-muted-foreground">{category.description}</p>
                              )}
                            </div>
                            <Badge variant="secondary">
                              {products?.filter(p => p.category_id === category.id).length || 0} produtos
                            </Badge>
                            <Badge variant={category.is_active ? 'default' : 'secondary'}>
                              {category.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditCategory(category)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicateCategory(category)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => deleteCategory.mutate(category.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </SortableItem>
                      ))}
                      {!categories?.length && (
                        <div className="text-center py-12 text-muted-foreground">
                          Nenhuma categoria cadastrada
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="flex-1 mt-4">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter}
              onDragStart={handleProductDragStart}
              onDragEnd={handleProductDragEnd}
            >
              <div className="flex gap-4 h-full">
                {/* Category Sidebar - Drop zones */}
                <Card className="w-64 shrink-0">
                  <CardHeader className="p-3 border-b">
                    <CardTitle className="text-sm font-medium">CATEGORIAS</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Arraste produtos para mover
                    </p>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[calc(100vh-400px)]">
                      <div className="space-y-2">
                        {categories?.map((category) => (
                          <div
                            key={category.id}
                            onClick={() => setSelectedCategoryId(category.id)}
                            className="cursor-pointer"
                          >
                            <DroppableCategory 
                              category={category} 
                              isActive={selectedCategoryId === category.id}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Products Grid */}
                <div className="flex-1">
                  {/* Filters Bar */}
                  <div className="mb-4 flex items-center gap-3 flex-wrap">
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterPromotion} onValueChange={(v) => setFilterPromotion(v as any)}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Promoção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="yes">Em Promoção</SelectItem>
                        <SelectItem value="no">Sem Promoção</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterFeatured} onValueChange={(v) => setFilterFeatured(v as any)}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Destaque" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="yes">Em Destaque</SelectItem>
                        <SelectItem value="no">Sem Destaque</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Limpar filtros
                      </Button>
                    )}

                    <div className="ml-auto text-sm text-muted-foreground">
                      {filteredProducts?.length || 0} produto(s)
                    </div>
                  </div>

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
                    </div>
                  )}

                  {/* Products Grid with Draggable Cards */}
                  <SortableContext items={filteredProducts?.map(p => p.id) || []} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredProducts?.map((product) => (
                        <DraggableProductCard key={product.id} product={product} />
                      ))}
                      {!filteredProducts?.length && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                          Nenhum produto encontrado
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              </div>

              {/* Drag Overlay */}
              <DragOverlay>
                {draggedProduct && (
                  <Card className="w-48 shadow-lg ring-2 ring-primary">
                    <div className="aspect-square bg-muted">
                      {draggedProduct.image_url ? (
                        <img src={draggedProduct.image_url} alt={draggedProduct.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="font-medium text-sm truncate">{draggedProduct.name}</p>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          {/* Complement Groups Tab */}
          <TabsContent value="extras" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Grupos de Complementos</CardTitle>
                <Button onClick={() => { setEditingGroup(null); setGroupLinkedOptionIds([]); setGroupLinkedProductIds([]); setIsGroupDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Novo Grupo
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo de Seleção</TableHead>
                      <TableHead>Obrigatório</TableHead>
                      <TableHead>Opções</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complementGroups?.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {group.selection_type === 'single' ? 'Apenas uma' : 
                             group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {group.is_required ? (
                            <Badge variant="destructive">Obrigatório</Badge>
                          ) : (
                            <span className="text-muted-foreground">Opcional</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getGroupOptionCount(group.id)} opção(ões)</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getGroupProductCount(group.id)} produto(s)</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={group.is_active ? "default" : "secondary"}>
                            {group.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={async () => { 
                                setEditingGroup(group);
                                // Carregar opções vinculadas ao grupo
                                const { data: groupOptions } = await supabase
                                  .from('complement_group_options')
                                  .select('option_id')
                                  .eq('group_id', group.id)
                                  .order('sort_order');
                                // Carregar produtos vinculados ao grupo
                                const { data: groupProducts } = await supabase
                                  .from('product_complement_groups')
                                  .select('product_id')
                                  .eq('group_id', group.id);
                                setGroupLinkedOptionIds(groupOptions?.map(o => o.option_id) || []);
                                setGroupLinkedProductIds(groupProducts?.map(p => p.product_id) || []);
                                setIsGroupDialogOpen(true); 
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDuplicateGroup(group)}
                              title="Duplicar grupo"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive" 
                              onClick={() => deleteGroup.mutate(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!complementGroups?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum grupo de complemento cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Complement Options Tab */}
          <TabsContent value="variations" className="flex-1 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Opções de Complementos</CardTitle>
                <Button onClick={() => { setEditingOption(null); setIsOptionDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Nova Opção
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {complementOptions?.map((option) => (
                    <Card key={option.id} className="group overflow-hidden">
                      <div className="relative h-24 bg-muted">
                        {option.image_url ? (
                          <img src={option.image_url} alt={option.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <Badge 
                          variant={option.is_active ? "default" : "secondary"}
                          className="absolute top-2 left-2 text-xs"
                        >
                          {option.is_active ? 'ATIVO' : 'INATIVO'}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => { setEditingOption(option); setIsOptionDialogOpen(true); }}>
                              <Edit className="h-4 w-4 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteOption.mutate(option.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium truncate">{option.name}</h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-semibold">{formatCurrency(option.price)}</span>
                          {option.cost_price && option.cost_price > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Custo: {formatCurrency(option.cost_price)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getOptionGroupCount(option.id)} grupo(s)
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {!complementOptions?.length && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      Nenhuma opção cadastrada
                    </div>
                  )}
                </div>
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

                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Setor de Impressão
                  </Label>
                  <Select 
                    value={productForm.print_sector_id || 'none'} 
                    onValueChange={(v) => setProductForm({...productForm, print_sector_id: v === 'none' ? null : v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (usa impressora padrão)</SelectItem>
                      {printSectors?.filter(s => s.is_active !== false).map(sector => (
                        <SelectItem key={sector.id} value={sector.id}>
                          <span className="flex items-center gap-2">
                            <span style={{ color: sector.color || '#EF4444' }}>●</span>
                            {sector.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define em qual impressora este produto será impresso
                  </p>
                </div>
              </TabsContent>

              {/* Complements Tab */}
              <TabsContent value="complements" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Grupos de Complementos</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione e ordene os grupos de complementos disponíveis para este produto
                  </p>
                  
                  {/* Selected groups with drag-and-drop */}
                  {productLinkedGroupIds.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-sm">Grupos selecionados (arraste para reordenar)</Label>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event;
                          if (over && active.id !== over.id) {
                            setProductLinkedGroupIds(prev => {
                              const oldIndex = prev.indexOf(active.id as string);
                              const newIndex = prev.indexOf(over.id as string);
                              return arrayMove(prev, oldIndex, newIndex);
                            });
                          }
                        }}
                      >
                        <SortableContext items={productLinkedGroupIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {productLinkedGroupIds.map((groupId) => {
                              const group = complementGroups?.find(g => g.id === groupId);
                              if (!group) return null;
                              return (
                                <SortableItem key={group.id} id={group.id}>
                                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                    <div className="flex-1">
                                      <p className="font-medium">{group.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {group.selection_type === 'single' ? 'Apenas uma' : 
                                         group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                                        {group.is_required && ' • Obrigatório'}
                                        {' • '}{getGroupOptionCount(group.id)} opção(ões)
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductLinkedGroupIds(prev => prev.filter(id => id !== group.id));
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </SortableItem>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                  
                  {/* Available groups to add */}
                  <Label className="text-sm">Adicionar grupos</Label>
                  <ScrollArea className="h-48 border rounded-lg p-3">
                    <div className="space-y-2">
                      {complementGroups?.filter(g => !productLinkedGroupIds.includes(g.id)).map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                          onClick={() => {
                            setProductLinkedGroupIds(prev => [...prev, group.id]);
                          }}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.selection_type === 'single' ? 'Apenas uma' : 
                               group.selection_type === 'multiple' ? 'Múltiplas' : 'Com repetição'}
                              {group.is_required && ' • Obrigatório'}
                              {' • '}{getGroupOptionCount(group.id)} opção(ões)
                            </p>
                          </div>
                          <Badge variant={group.is_active ? 'default' : 'secondary'}>
                            {group.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      ))}
                      {complementGroups?.filter(g => !productLinkedGroupIds.includes(g.id)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {complementGroups?.length 
                            ? 'Todos os grupos já foram adicionados'
                            : 'Nenhum grupo de complemento cadastrado. Crie grupos na aba "COMPLEMENTOS".'}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  {productLinkedGroupIds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {productLinkedGroupIds.length} grupo(s) selecionado(s)
                    </p>
                  )}
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

        {/* Complement Group Dialog */}
        <ComplementGroupDialog
          open={isGroupDialogOpen}
          onOpenChange={setIsGroupDialogOpen}
          group={editingGroup}
          options={complementOptions || []}
          linkedOptionIds={groupLinkedOptionIds}
          onSave={handleSaveComplementGroup}
          isEditing={!!editingGroup}
        />

        {/* Complement Option Dialog */}
        <ComplementOptionDialog
          open={isOptionDialogOpen}
          onOpenChange={setIsOptionDialogOpen}
          option={editingOption}
          linkedGroups={complementGroups?.filter(g => groupLinkedOptionIds.includes(g.id)) || []}
          onSave={handleSaveComplementOption}
          isEditing={!!editingOption}
        />

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
