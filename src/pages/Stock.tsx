import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useIngredients, useIngredientMutations, useLowStockIngredients, Ingredient } from '@/hooks/useIngredients';
import { useAllProductsWithIngredients, useProductIngredientMutations } from '@/hooks/useProductIngredients';
import { useProducts } from '@/hooks/useProducts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { 
  Plus, 
  Package, 
  AlertTriangle, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Settings,
  Edit,
  Trash2,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const stockStatusConfig = {
  critical: { label: 'Crítico', color: 'bg-destructive text-destructive-foreground' },
  low: { label: 'Baixo', color: 'bg-warning text-warning-foreground' },
  normal: { label: 'Normal', color: 'bg-accent text-accent-foreground' },
};

function getStockStatus(current: number, min: number): 'critical' | 'low' | 'normal' {
  if (current <= 0) return 'critical';
  if (current <= min) return 'low';
  return 'normal';
}

export default function Stock() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('ingredients');
  const [isNewIngredientOpen, setIsNewIngredientOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isTechSheetOpen, setIsTechSheetOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  const canManageStock = hasPermission('stock_manage');

  if (!permissionsLoading && !hasPermission('stock_view')) {
    return <AccessDenied permission="stock_view" />;
  }

  // Form states
  const [newIngredient, setNewIngredient] = useState({
    name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0
  });
  const [movementData, setMovementData] = useState({
    type: 'entry' as 'entry' | 'exit' | 'adjustment',
    quantity: '',
    notes: ''
  });
  const [newTechSheetIngredient, setNewTechSheetIngredient] = useState({
    ingredient_id: '',
    quantity: ''
  });

  const { data: ingredients, isLoading } = useIngredients();
  const { data: lowStockIngredients } = useLowStockIngredients();
  const { data: productsWithIngredients } = useAllProductsWithIngredients();
  const { data: products } = useProducts();
  const { createIngredient, updateIngredient, addStockMovement } = useIngredientMutations();
  const { addIngredient: addTechSheetIngredient, removeIngredient: removeTechSheetIngredient } = useProductIngredientMutations();

  // Stock movements history
  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          ingredient:ingredients(name, unit)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  const handleCreateIngredient = async () => {
    await createIngredient.mutateAsync(newIngredient);
    setIsNewIngredientOpen(false);
    setNewIngredient({ name: '', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
  };

  const handleMovement = async () => {
    if (!selectedIngredient) return;
    const quantity = parseFloat(movementData.quantity.replace(',', '.'));
    if (isNaN(quantity) || quantity <= 0) return;

    await addStockMovement.mutateAsync({
      ingredient_id: selectedIngredient.id,
      movement_type: movementData.type,
      quantity,
      notes: movementData.notes
    });
    setIsMovementOpen(false);
    setMovementData({ type: 'entry', quantity: '', notes: '' });
    setSelectedIngredient(null);
  };

  const handleAddTechSheetIngredient = async () => {
    if (!selectedProductId || !newTechSheetIngredient.ingredient_id) return;
    const quantity = parseFloat(newTechSheetIngredient.quantity.replace(',', '.'));
    if (isNaN(quantity) || quantity <= 0) return;

    await addTechSheetIngredient.mutateAsync({
      product_id: selectedProductId,
      ingredient_id: newTechSheetIngredient.ingredient_id,
      quantity
    });
    setNewTechSheetIngredient({ ingredient_id: '', quantity: '' });
  };

  const openMovementDialog = (ingredient: Ingredient, type: 'entry' | 'exit' | 'adjustment') => {
    setSelectedIngredient(ingredient);
    setMovementData({ ...movementData, type });
    setIsMovementOpen(true);
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estoque</h1>
            <p className="text-muted-foreground">Controle de ingredientes e fichas técnicas</p>
          </div>
          <Dialog open={isNewIngredientOpen} onOpenChange={setIsNewIngredientOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Ingrediente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Ingrediente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    placeholder="Ex: Farinha de Trigo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select 
                      value={newIngredient.unit} 
                      onValueChange={(v) => setNewIngredient({ ...newIngredient, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                        <SelectItem value="g">Grama (g)</SelectItem>
                        <SelectItem value="l">Litro (L)</SelectItem>
                        <SelectItem value="ml">Mililitro (ml)</SelectItem>
                        <SelectItem value="un">Unidade (un)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estoque Mínimo</Label>
                    <Input
                      type="number"
                      value={newIngredient.min_stock}
                      onChange={(e) => setNewIngredient({ ...newIngredient, min_stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estoque Inicial</Label>
                    <Input
                      type="number"
                      value={newIngredient.current_stock}
                      onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo por {newIngredient.unit}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newIngredient.cost_per_unit}
                      onChange={(e) => setNewIngredient({ ...newIngredient, cost_per_unit: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateIngredient} disabled={createIngredient.isPending}>
                  Cadastrar Ingrediente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Alerts */}
        {lowStockIngredients && lowStockIngredients.length > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-semibold">Alerta de Estoque Baixo</p>
                  <p className="text-sm text-muted-foreground">
                    {lowStockIngredients.length} ingrediente(s) com estoque baixo ou zerado
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {lowStockIngredients.map((ing) => (
                  <Badge 
                    key={ing.id} 
                    variant="outline"
                    className={cn(stockStatusConfig[getStockStatus(ing.current_stock, ing.min_stock)].color)}
                  >
                    {ing.name}: {ing.current_stock} {ing.unit}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
            <TabsTrigger value="techsheets">Fichas Técnicas</TabsTrigger>
          </TabsList>

          {/* Ingredients Tab */}
          <TabsContent value="ingredients" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ingredients?.map((ingredient) => {
                const status = getStockStatus(ingredient.current_stock, ingredient.min_stock);
                return (
                  <Card key={ingredient.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{ingredient.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(ingredient.cost_per_unit)}/{ingredient.unit}
                            </p>
                          </div>
                        </div>
                        <Badge className={stockStatusConfig[status].color}>
                          {stockStatusConfig[status].label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Estoque Atual</span>
                          <span className="font-medium">{ingredient.current_stock} {ingredient.unit}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Mínimo</span>
                          <span>{ingredient.min_stock} {ingredient.unit}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all",
                              status === 'critical' ? 'bg-destructive' :
                              status === 'low' ? 'bg-warning' : 'bg-accent'
                            )}
                            style={{ 
                              width: `${Math.min(100, (ingredient.current_stock / Math.max(ingredient.min_stock * 2, 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openMovementDialog(ingredient, 'entry')}
                        >
                          <ArrowUpCircle className="h-4 w-4 mr-1" />
                          Entrada
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openMovementDialog(ingredient, 'exit')}
                        >
                          <ArrowDownCircle className="h-4 w-4 mr-1" />
                          Saída
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openMovementDialog(ingredient, 'adjustment')}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movements" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {movements?.map((m) => (
                    <div 
                      key={m.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {m.movement_type === 'entry' ? (
                          <ArrowUpCircle className="h-5 w-5 text-accent" />
                        ) : m.movement_type === 'exit' ? (
                          <ArrowDownCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Settings className="h-5 w-5 text-info" />
                        )}
                        <div>
                          <p className="font-medium">{m.ingredient?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {m.movement_type === 'entry' ? 'Entrada' : 
                             m.movement_type === 'exit' ? 'Saída' : 'Ajuste'}
                            {m.notes && ` - ${m.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold",
                          m.movement_type === 'entry' ? "text-accent" : 
                          m.movement_type === 'exit' ? "text-destructive" : "text-info"
                        )}>
                          {m.movement_type === 'entry' ? '+' : m.movement_type === 'exit' ? '-' : '='} 
                          {m.quantity} {m.ingredient?.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!movements || movements.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação registrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tech Sheets Tab */}
          <TabsContent value="techsheets" className="mt-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductId && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Ficha Técnica
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add ingredient form */}
                    <div className="flex gap-2">
                      <Select 
                        value={newTechSheetIngredient.ingredient_id} 
                        onValueChange={(v) => setNewTechSheetIngredient({ ...newTechSheetIngredient, ingredient_id: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients?.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-32"
                        placeholder="Qtd"
                        value={newTechSheetIngredient.quantity}
                        onChange={(e) => setNewTechSheetIngredient({ ...newTechSheetIngredient, quantity: e.target.value })}
                      />
                      <Button onClick={handleAddTechSheetIngredient} disabled={addTechSheetIngredient.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Ingredients list */}
                    {(() => {
                      const product = productsWithIngredients?.find(p => p.id === selectedProductId);
                      if (!product) return null;
                      return (
                        <>
                          <div className="space-y-2">
                            {product.ingredients.map((pi) => (
                              <div 
                                key={pi.id} 
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{pi.ingredient?.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {pi.quantity} {pi.ingredient?.unit} × {formatCurrency(pi.ingredient?.cost_per_unit || 0)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {formatCurrency(pi.quantity * (pi.ingredient?.cost_per_unit || 0))}
                                  </span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => removeTechSheetIngredient.mutate(pi.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {product.ingredients.length > 0 && (
                            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                              <span className="font-semibold">Custo de Produção</span>
                              <div className="text-right">
                                <p className="text-xl font-bold text-primary">
                                  {formatCurrency(product.productionCost)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Preço de venda: {formatCurrency(product.price)}
                                </p>
                                <p className="text-sm font-medium text-accent">
                                  Margem: {((1 - product.productionCost / product.price) * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Products overview */}
              {!selectedProductId && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {productsWithIngredients?.map((product) => (
                    <Card 
                      key={product.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <CardContent className="p-4">
                        <p className="font-semibold mb-2">{product.name}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ingredientes:</span>
                            <span>{product.ingredients.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo:</span>
                            <span className="text-destructive">{formatCurrency(product.productionCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço:</span>
                            <span className="text-accent">{formatCurrency(product.price)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Movement Dialog */}
        <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {movementData.type === 'entry' ? 'Entrada de Estoque' :
                 movementData.type === 'exit' ? 'Saída de Estoque' : 'Ajuste de Estoque'}
              </DialogTitle>
            </DialogHeader>
            {selectedIngredient && (
              <div className="space-y-4 pt-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium">{selectedIngredient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Estoque atual: {selectedIngredient.current_stock} {selectedIngredient.unit}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    {movementData.type === 'adjustment' ? 'Novo valor do estoque' : 'Quantidade'}
                  </Label>
                  <Input
                    type="text"
                    placeholder="0"
                    value={movementData.quantity}
                    onChange={(e) => setMovementData({ ...movementData, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea
                    placeholder={
                      movementData.type === 'entry' ? "Ex: Compra do fornecedor X" :
                      movementData.type === 'exit' ? "Ex: Uso na produção" : "Ex: Inventário realizado"
                    }
                    value={movementData.notes}
                    onChange={(e) => setMovementData({ ...movementData, notes: e.target.value })}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleMovement}
                  disabled={addStockMovement.isPending}
                >
                  Confirmar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PDVLayout>
  );
}
