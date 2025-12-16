import { useState, useEffect } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { useProductExtras, useProductExtrasMutations } from '@/hooks/useProductExtras';
import { useProductVariations, useProductVariationsMutations } from '@/hooks/useProductVariations';
import { useProductExtraLinks, useProductExtraLinksMutations } from '@/hooks/useProductExtraLinks';
import { useCombos, useComboMutations } from '@/hooks/useCombos';
import { useComboItems, useComboItemsMutations } from '@/hooks/useComboItems';
import { Plus, Edit, Trash2, Search, Link2, Package, GripVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImageUpload } from '@/components/ImageUpload';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/SortableItem';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ComboItemForm {
  product_id: string;
  variation_id: string | null;
  quantity: number;
}

export default function Menu() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: extras } = useProductExtras();
  const { data: variations } = useProductVariations();
  const { data: combos } = useCombos();
  const { data: comboItems } = useComboItems();
  const { createProduct, updateProduct, deleteProduct, updateSortOrder: updateProductSortOrder } = useProductMutations();
  const { createCategory, updateSortOrder: updateCategorySortOrder } = useCategoryMutations();
  const { createExtra, updateExtra, deleteExtra } = useProductExtrasMutations();
  const { createVariation, updateVariation, deleteVariation } = useProductVariationsMutations();
  const { data: extraLinks } = useProductExtraLinks();
  const { setLinkedProducts } = useProductExtraLinksMutations();
  const { createCombo, updateCombo, deleteCombo } = useComboMutations();
  const { setComboItems } = useComboItemsMutations();
  
  const [search, setSearch] = useState('');
  const [isSortMode, setIsSortMode] = useState(false);
  
  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 0, category_id: '', is_available: true, image_url: null as string | null });

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

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

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const handleSaveProduct = async () => {
    const productData = {
      name: productForm.name,
      description: productForm.description,
      price: productForm.price,
      category_id: productForm.category_id || null,
      is_available: productForm.is_available,
      image_url: productForm.image_url,
      preparation_time: 15,
      sort_order: 0
    };

    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
    } else {
      await createProduct.mutateAsync(productData);
    }
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: 0, category_id: '', is_available: true, image_url: null });
  };

  const handleSaveCategory = async () => {
    await createCategory.mutateAsync({ ...categoryForm, icon: null, sort_order: 0, is_active: true });
    setIsCategoryDialogOpen(false);
    setCategoryForm({ name: '', description: '' });
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

  const openEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category_id: product.category_id || '',
      is_available: product.is_available,
      image_url: product.image_url
    });
    setIsProductDialogOpen(true);
  };

  const openEditExtra = (extra: any) => {
    setEditingExtra(extra);
    setExtraForm({ name: extra.name, description: extra.description || '', price: extra.price, is_active: extra.is_active ?? true });
    const linkedIds = extraLinks?.filter(link => link.extra_id === extra.id).map(link => link.product_id) || [];
    setLinkedProductIds(linkedIds);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !filteredProducts) return;

    const oldIndex = filteredProducts.findIndex(p => p.id === active.id);
    const newIndex = filteredProducts.findIndex(p => p.id === over.id);
    
    const reordered = arrayMove(filteredProducts, oldIndex, newIndex);
    const updates = reordered.map((product, index) => ({ id: product.id, sort_order: index }));
    updateProductSortOrder.mutate(updates);
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cardápio</h1>
            <p className="text-muted-foreground">Gerencie produtos, categorias, complementos, opções e combos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Category Dialog */}
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Categoria</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
                  </div>
                  <Button className="w-full" onClick={handleSaveCategory}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Extras Dialog */}
            <Dialog open={isExtrasDialogOpen} onOpenChange={(open) => { setIsExtrasDialogOpen(open); if (!open) { setEditingExtra(null); setExtraForm({ name: '', description: '', price: 0, is_active: true }); setLinkedProductIds([]); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Complemento</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Gerenciar Complementos</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input placeholder="Ex: Bacon extra" value={extraForm.name} onChange={(e) => setExtraForm({...extraForm, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <Label>Preço</Label>
                      <Input type="number" step="0.01" className="w-24" value={extraForm.price} onChange={(e) => setExtraForm({...extraForm, price: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Switch checked={extraForm.is_active} onCheckedChange={(checked) => setExtraForm({...extraForm, is_active: checked})} />
                      <Label className="text-xs">Ativo</Label>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Textarea 
                      placeholder="Ex: Fatias crocantes de bacon defumado" 
                      value={extraForm.description} 
                      onChange={(e) => setExtraForm({...extraForm, description: e.target.value})}
                      className="resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Produtos vinculados
                      <span className="text-xs text-muted-foreground font-normal">(deixe vazio = disponível para todos)</span>
                    </Label>
                    <div className="border rounded-lg p-3 max-h-32 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
                      {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-2">
                          <Checkbox 
                            id={`link-${product.id}`}
                            checked={linkedProductIds.includes(product.id)}
                            onCheckedChange={() => toggleLinkedProduct(product.id)}
                          />
                          <Label htmlFor={`link-${product.id}`} className="text-sm cursor-pointer">{product.name}</Label>
                        </div>
                      ))}
                      {!products?.length && <p className="text-muted-foreground text-sm col-span-3">Nenhum produto cadastrado</p>}
                    </div>
                  </div>

                  <Button onClick={handleSaveExtra} className="w-full">{editingExtra ? 'Atualizar' : 'Adicionar'}</Button>
                  
                  <div className="border rounded-lg max-h-64 overflow-auto">
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
                            <TableCell className="text-muted-foreground max-w-[150px] truncate">{extra.description || '-'}</TableCell>
                            <TableCell>{formatCurrency(extra.price)}</TableCell>
                            <TableCell>
                              {getLinkedProductCount(extra.id) > 0 ? (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{getLinkedProductCount(extra.id)} produto(s)</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Todos</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${extra.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {extra.is_active ? 'Ativo' : 'Inativo'}
                              </span>
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
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Variations Dialog */}
            <Dialog open={isVariationsDialogOpen} onOpenChange={(open) => { setIsVariationsDialogOpen(open); if (!open) { setEditingVariation(null); setVariationForm({ product_id: '', name: '', description: '', price_modifier: 0, is_active: true }); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Opções</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Gerenciar Opções (Variações)</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <div className="space-y-1">
                      <Label>Produto</Label>
                      <Select value={variationForm.product_id} onValueChange={(v) => setVariationForm({...variationForm, product_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Nome da opção</Label>
                      <Input placeholder="Ex: Grande, Média" value={variationForm.name} onChange={(e) => setVariationForm({...variationForm, name: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-3 pb-1">
                      <div className="space-y-1">
                        <Label>+/- Preço</Label>
                        <Input type="number" step="0.01" className="w-24" value={variationForm.price_modifier} onChange={(e) => setVariationForm({...variationForm, price_modifier: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="flex items-center gap-2 mt-5">
                        <Switch checked={variationForm.is_active} onCheckedChange={(checked) => setVariationForm({...variationForm, is_active: checked})} />
                        <Label className="text-xs">Ativo</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Textarea 
                      placeholder="Ex: Tamanho grande, ideal para 3-4 pessoas" 
                      value={variationForm.description} 
                      onChange={(e) => setVariationForm({...variationForm, description: e.target.value})}
                      className="resize-none"
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleSaveVariation} disabled={!variationForm.product_id} className="w-full">{editingVariation ? 'Atualizar' : 'Adicionar'}</Button>
                  
                  <div className="border rounded-lg max-h-64 overflow-auto">
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
                            <TableCell className="text-muted-foreground max-w-[150px] truncate">{variation.description || '-'}</TableCell>
                            <TableCell>{formatCurrency(variation.price_modifier ?? 0)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${variation.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {variation.is_active ? 'Ativo' : 'Inativo'}
                              </span>
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
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Combo Dialog */}
            <Dialog open={isComboDialogOpen} onOpenChange={(open) => { setIsComboDialogOpen(open); if (!open) { setEditingCombo(null); setComboForm({ name: '', description: '', image_url: null, combo_price: 0, is_active: true }); setComboItemsForm([]); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Package className="h-4 w-4 mr-2" />Combo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                          className="resize-none"
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

                  {/* Combos List */}
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Combo</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead>De</TableHead>
                          <TableHead>Por</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combos?.map((combo) => (
                          <TableRow key={combo.id}>
                            <TableCell className="font-medium">{combo.name}</TableCell>
                            <TableCell><span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{getComboItemCount(combo.id)} item(s)</span></TableCell>
                            <TableCell className="text-muted-foreground line-through">{formatCurrency(combo.original_price)}</TableCell>
                            <TableCell className="font-semibold text-green-600">{formatCurrency(combo.combo_price)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${combo.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {combo.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditCombo(combo)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCombo.mutate(combo.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!combos?.length && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum combo cadastrado</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Product Dialog */}
            <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if (!open) { setEditingProduct(null); setProductForm({ name: '', description: '', price: 0, category_id: '', is_available: true, image_url: null }); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Produto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingProduct ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <ImageUpload 
                    value={productForm.image_url} 
                    onChange={(url) => setProductForm({...productForm, image_url: url})}
                    folder="products"
                  />
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço</Label>
                    <Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={productForm.category_id} onValueChange={(v) => setProductForm({...productForm, category_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={productForm.is_available} onCheckedChange={(checked) => setProductForm({...productForm, is_available: checked})} />
                    <Label>Disponível</Label>
                  </div>
                  <Button className="w-full" onClick={handleSaveProduct}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button 
            variant={isSortMode ? "default" : "outline"} 
            onClick={() => setIsSortMode(!isSortMode)}
          >
            <GripVertical className="h-4 w-4 mr-2" />
            {isSortMode ? 'Concluir ordenação' : 'Ordenar'}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isSortMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredProducts?.map(p => p.id) || []} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts?.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <SortableItem id={product.id}>
                              <span></span>
                            </SortableItem>
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category?.name || '-'}</TableCell>
                          <TableCell>{formatCurrency(product.price)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${product.is_available ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {product.is_available ? 'Disponível' : 'Indisponível'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-10 w-10 object-cover rounded" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category?.name || '-'}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${product.is_available ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {product.is_available ? 'Disponível' : 'Indisponível'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditProduct(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProduct.mutate(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredProducts?.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
