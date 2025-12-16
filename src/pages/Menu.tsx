import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { useProductExtras, useProductExtrasMutations } from '@/hooks/useProductExtras';
import { useProductVariations, useProductVariationsMutations } from '@/hooks/useProductVariations';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Menu() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: extras } = useProductExtras();
  const { data: variations } = useProductVariations();
  const { createProduct, updateProduct, deleteProduct } = useProductMutations();
  const { createCategory } = useCategoryMutations();
  const { createExtra, updateExtra, deleteExtra } = useProductExtrasMutations();
  const { createVariation, updateVariation, deleteVariation } = useProductVariationsMutations();
  
  const [search, setSearch] = useState('');
  
  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 0, category_id: '', is_available: true });

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  // Extras dialog state
  const [isExtrasDialogOpen, setIsExtrasDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<any>(null);
  const [extraForm, setExtraForm] = useState({ name: '', price: 0, is_active: true });

  // Variations dialog state
  const [isVariationsDialogOpen, setIsVariationsDialogOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<any>(null);
  const [variationForm, setVariationForm] = useState({ product_id: '', name: '', price_modifier: 0, is_active: true });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveProduct = async () => {
    const productData = {
      name: productForm.name,
      description: productForm.description,
      price: productForm.price,
      category_id: productForm.category_id || null, // FIX: empty string becomes null
      is_available: productForm.is_available,
      image_url: null,
      preparation_time: 15
    };

    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
    } else {
      await createProduct.mutateAsync(productData);
    }
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: 0, category_id: '', is_available: true });
  };

  const handleSaveCategory = async () => {
    await createCategory.mutateAsync({ ...categoryForm, icon: null, sort_order: 0, is_active: true });
    setIsCategoryDialogOpen(false);
    setCategoryForm({ name: '', description: '' });
  };

  const handleSaveExtra = async () => {
    if (editingExtra) {
      await updateExtra.mutateAsync({ id: editingExtra.id, ...extraForm });
    } else {
      await createExtra.mutateAsync(extraForm);
    }
    setEditingExtra(null);
    setExtraForm({ name: '', price: 0, is_active: true });
  };

  const handleSaveVariation = async () => {
    if (editingVariation) {
      await updateVariation.mutateAsync({ id: editingVariation.id, name: variationForm.name, price_modifier: variationForm.price_modifier, is_active: variationForm.is_active });
    } else {
      await createVariation.mutateAsync(variationForm);
    }
    setEditingVariation(null);
    setVariationForm({ product_id: '', name: '', price_modifier: 0, is_active: true });
  };

  const openEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category_id: product.category_id || '',
      is_available: product.is_available
    });
    setIsProductDialogOpen(true);
  };

  const openEditExtra = (extra: any) => {
    setEditingExtra(extra);
    setExtraForm({ name: extra.name, price: extra.price, is_active: extra.is_active ?? true });
  };

  const openEditVariation = (variation: any) => {
    setEditingVariation(variation);
    setVariationForm({
      product_id: variation.product_id,
      name: variation.name,
      price_modifier: variation.price_modifier ?? 0,
      is_active: variation.is_active ?? true
    });
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cardápio</h1>
            <p className="text-muted-foreground">Gerencie produtos, categorias, complementos e opções</p>
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
            <Dialog open={isExtrasDialogOpen} onOpenChange={(open) => { setIsExtrasDialogOpen(open); if (!open) { setEditingExtra(null); setExtraForm({ name: '', price: 0, is_active: true }); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Complemento</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Gerenciar Complementos</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
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
                    <Button onClick={handleSaveExtra}>{editingExtra ? 'Atualizar' : 'Adicionar'}</Button>
                  </div>
                  
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extras?.map((extra) => (
                          <TableRow key={extra.id}>
                            <TableCell>{extra.name}</TableCell>
                            <TableCell>{formatCurrency(extra.price)}</TableCell>
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
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum complemento cadastrado</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Variations Dialog */}
            <Dialog open={isVariationsDialogOpen} onOpenChange={(open) => { setIsVariationsDialogOpen(open); if (!open) { setEditingVariation(null); setVariationForm({ product_id: '', name: '', price_modifier: 0, is_active: true }); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Opções</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Gerenciar Opções (Variações)</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
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
                    <div className="space-y-1">
                      <Label>+/- Preço</Label>
                      <Input type="number" step="0.01" className="w-24" value={variationForm.price_modifier} onChange={(e) => setVariationForm({...variationForm, price_modifier: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Switch checked={variationForm.is_active} onCheckedChange={(checked) => setVariationForm({...variationForm, is_active: checked})} />
                      <Label className="text-xs">Ativo</Label>
                    </div>
                    <Button onClick={handleSaveVariation} disabled={!variationForm.product_id}>{editingVariation ? 'Atualizar' : 'Adicionar'}</Button>
                  </div>
                  
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Opção</TableHead>
                          <TableHead>Modificador</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variations?.map((variation) => (
                          <TableRow key={variation.id}>
                            <TableCell>{products?.find(p => p.id === variation.product_id)?.name || '-'}</TableCell>
                            <TableCell>{variation.name}</TableCell>
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
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma opção cadastrada</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Product Dialog */}
            <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if (!open) { setEditingProduct(null); setProductForm({ name: '', description: '', price: 0, category_id: '', is_available: true }); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Produto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingProduct ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
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

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
