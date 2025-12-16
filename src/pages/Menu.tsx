import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Menu() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const { createProduct, updateProduct, deleteProduct } = useProductMutations();
  const { createCategory } = useCategoryMutations();
  
  const [search, setSearch] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 0, category_id: '', is_available: true });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveProduct = async () => {
    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...productForm });
    } else {
      await createProduct.mutateAsync({ ...productForm, image_url: null, preparation_time: 15 });
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

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cardápio</h1>
            <p className="text-muted-foreground">Gerencie produtos e categorias</p>
          </div>
          <div className="flex gap-2">
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
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
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
                    <Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={productForm.category_id} onValueChange={(v) => setProductForm({...productForm, category_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                        <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setProductForm({ name: product.name, description: product.description || '', price: product.price, category_id: product.category_id || '', is_available: product.is_available }); setIsProductDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProduct.mutate(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}