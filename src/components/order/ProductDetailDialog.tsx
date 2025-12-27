import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  promotion_price?: number | null;
  is_promotion?: boolean | null;
  image_url?: string | null;
}

interface ComplementGroup {
  id: string;
  name: string;
  description?: string | null;
  selection_type: 'single' | 'multiple' | 'multiple_repeat';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest';
}

interface ComplementOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  price_override?: number | null;
}

interface GroupWithOptions extends ComplementGroup {
  options: ComplementOption[];
}

export interface SelectedComplement {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
  quantity: number;
}

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onAdd: (product: Product, quantity: number, complements: SelectedComplement[], notes: string) => void;
  duplicateItems?: boolean;
  channel?: 'counter' | 'delivery' | 'table';
}

export function ProductDetailDialog({ open, onOpenChange, product, onAdd, duplicateItems, channel }: ProductDetailDialogProps) {
  const [groups, setGroups] = useState<GroupWithOptions[]>([]);
  const [selections, setSelections] = useState<Record<string, SelectedComplement[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch complement groups and options for this product
  useEffect(() => {
    if (!product || !open) return;

    const fetchGroups = async () => {
      setLoading(true);
      try {
        // Get groups linked to this product
        const { data: productGroups } = await supabase
          .from('product_complement_groups')
          .select('group_id, sort_order')
          .eq('product_id', product.id)
          .order('sort_order');

        if (!productGroups || productGroups.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const groupIds = productGroups.map(pg => pg.group_id);

        // Get group details - filter by channel if provided
        let groupsQuery = supabase
          .from('complement_groups')
          .select('*')
          .in('id', groupIds)
          .eq('is_active', true);

        if (channel) {
          groupsQuery = groupsQuery.contains('channels', [channel]);
        }

        const { data: groupsData } = await groupsQuery;

        if (!groupsData) {
          setGroups([]);
          setLoading(false);
          return;
        }

        // Step 1: Get all complement_group_options links
        const { data: groupOptionLinks, error: linksError } = await supabase
          .from('complement_group_options')
          .select('id, group_id, option_id, price_override, sort_order')
          .in('group_id', groupIds)
          .order('sort_order');

        console.log('[ProductDetailDialog] groupIds:', groupIds);
        console.log('[ProductDetailDialog] groupOptionLinks:', groupOptionLinks);
        console.log('[ProductDetailDialog] linksError:', linksError);

        if (!groupOptionLinks || groupOptionLinks.length === 0) {
          // No options linked to these groups
          const groupsWithoutOptions: GroupWithOptions[] = groupsData.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description,
            selection_type: group.selection_type as 'single' | 'multiple' | 'multiple_repeat',
            is_required: group.is_required ?? false,
            min_selections: group.min_selections ?? 0,
            max_selections: group.max_selections ?? 1,
            sort_order: productGroups.find(pg => pg.group_id === group.id)?.sort_order ?? 0,
            price_calculation_type: (group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest') ?? 'sum',
            options: [],
          })).sort((a, b) => a.sort_order - b.sort_order);
          setGroups(groupsWithoutOptions);
          setLoading(false);
          return;
        }

        // Step 2: Get all complement_options by their IDs
        const optionIds = [...new Set(groupOptionLinks.map(go => go.option_id))];
        const { data: optionsData, error: optionsError } = await supabase
          .from('complement_options')
          .select('*')
          .in('id', optionIds);

        console.log('[ProductDetailDialog] optionIds:', optionIds);
        console.log('[ProductDetailDialog] optionsData:', optionsData);
        console.log('[ProductDetailDialog] optionsError:', optionsError);

        // Step 3: Build a map of options for quick lookup
        const optionsMap = new Map(optionsData?.map(opt => [opt.id, opt]) || []);

        // Build groups with options - filter active options only
        const groupsWithOptions: GroupWithOptions[] = groupsData.map(group => {
          const groupLinks = groupOptionLinks.filter(go => go.group_id === group.id);
          console.log(`[ProductDetailDialog] Group ${group.name} - links:`, groupLinks);
          
          const options = groupLinks
            .map(link => {
              const opt = optionsMap.get(link.option_id);
              if (!opt) return null;
              // Treat null, undefined, or true as active
              if (opt.is_active !== true && opt.is_active !== null && opt.is_active !== undefined) {
                return null;
              }
              return {
                ...opt,
                price_override: link.price_override,
              };
            })
            .filter((opt): opt is NonNullable<typeof opt> => opt !== null)
            .sort((a, b) => {
              const aLink = groupLinks.find(l => l.option_id === a.id);
              const bLink = groupLinks.find(l => l.option_id === b.id);
              return (aLink?.sort_order || 0) - (bLink?.sort_order || 0);
            });
          
          console.log(`[ProductDetailDialog] Group ${group.name} - final options:`, options);

          return {
            id: group.id,
            name: group.name,
            description: group.description,
            selection_type: group.selection_type as 'single' | 'multiple' | 'multiple_repeat',
            is_required: group.is_required ?? false,
            min_selections: group.min_selections ?? 0,
            max_selections: group.max_selections ?? 1,
            sort_order: productGroups.find(pg => pg.group_id === group.id)?.sort_order ?? 0,
            price_calculation_type: (group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest') ?? 'sum',
            options,
          };
        }).sort((a, b) => a.sort_order - b.sort_order);

        setGroups(groupsWithOptions);
      } catch (error) {
        console.error('Error fetching complement groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    // Reset state when product changes
    setSelections({});
    setQuantity(1);
    setNotes('');
  }, [product, open, channel]);

  const handleSingleSelect = (group: GroupWithOptions, option: ComplementOption) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => ({
      ...prev,
      [group.id]: [{
        group_id: group.id,
        group_name: group.name,
        option_id: option.id,
        option_name: option.name,
        price,
        quantity: 1,
      }],
    }));
  };

  const handleMultipleSelect = (group: GroupWithOptions, option: ComplementOption, checked: boolean) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (checked) {
        // Check max selections
        if (current.length >= group.max_selections) return prev;
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
          }],
        };
      } else {
        return {
          ...prev,
          [group.id]: current.filter(s => s.option_id !== option.id),
        };
      }
    });
  };

  const handleRepeatQuantity = (group: GroupWithOptions, option: ComplementOption, delta: number) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      const existing = current.find(s => s.option_id === option.id);
      
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return {
            ...prev,
            [group.id]: current.filter(s => s.option_id !== option.id),
          };
        }
        // Check total selections in group
        const totalOthers = current.filter(s => s.option_id !== option.id).reduce((sum, s) => sum + s.quantity, 0);
        if (totalOthers + newQty > group.max_selections) return prev;
        
        return {
          ...prev,
          [group.id]: current.map(s => 
            s.option_id === option.id ? { ...s, quantity: newQty } : s
          ),
        };
      } else if (delta > 0) {
        const totalCurrent = current.reduce((sum, s) => sum + s.quantity, 0);
        if (totalCurrent >= group.max_selections) return prev;
        
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
          }],
        };
      }
      return prev;
    });
  };

  const getSelectionCount = (groupId: string) => {
    const groupSelections = selections[groupId] || [];
    return groupSelections.reduce((sum, s) => sum + s.quantity, 0);
  };

  const isOptionSelected = (groupId: string, optionId: string) => {
    return (selections[groupId] || []).some(s => s.option_id === optionId);
  };

  const getOptionQuantity = (groupId: string, optionId: string) => {
    return (selections[groupId] || []).find(s => s.option_id === optionId)?.quantity || 0;
  };

  const calculateGroupPrice = (groupId: string, priceType: 'sum' | 'average' | 'highest' | 'lowest'): number => {
    const groupSelections = selections[groupId] || [];
    if (groupSelections.length === 0) return 0;

    switch (priceType) {
      case 'sum':
        return groupSelections.reduce((total, s) => total + (s.price * s.quantity), 0);
      case 'average': {
        const totalQty = groupSelections.reduce((sum, s) => sum + s.quantity, 0);
        const totalPrice = groupSelections.reduce((sum, s) => sum + (s.price * s.quantity), 0);
        return totalQty > 0 ? totalPrice / totalQty : 0;
      }
      case 'highest':
        return Math.max(...groupSelections.map(s => s.price));
      case 'lowest':
        return Math.min(...groupSelections.map(s => s.price));
      default:
        return groupSelections.reduce((total, s) => total + (s.price * s.quantity), 0);
    }
  };

  const complementsTotal = useMemo(() => {
    return groups.reduce((total, group) => {
      return total + calculateGroupPrice(group.id, group.price_calculation_type);
    }, 0);
  }, [selections, groups]);

  const productPrice = product?.is_promotion && product?.promotion_price 
    ? product.promotion_price 
    : product?.price ?? 0;

  const totalPrice = (productPrice + complementsTotal) * quantity;

  const invalidGroups = groups.filter(group => {
    const count = getSelectionCount(group.id);
    return group.is_required && count < group.min_selections;
  });

  const canAdd = invalidGroups.length === 0;

  const handleAdd = () => {
    if (!product || !canAdd) return;
    const allComplements = Object.values(selections).flat();
    onAdd(product, quantity, allComplements, notes);
    onOpenChange(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header with image */}
        <div className="relative">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Sem imagem</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
            <h2 className="text-xl font-bold">{product.name}</h2>
            <div className="flex items-center gap-2">
              {product.is_promotion && product.promotion_price ? (
                <>
                  <span className="text-muted-foreground line-through text-sm">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-primary font-bold text-lg">
                    {formatCurrency(product.promotion_price)}
                  </span>
                </>
              ) : (
                <span className="text-primary font-bold text-lg">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {product.description && (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            )}

            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Carregando opções...
              </div>
            ) : groups.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Este produto não possui complementos
              </div>
            ) : (
              groups.map(group => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{group.name}</h3>
                        {group.is_required && (
                          <Badge variant="destructive" className="text-xs">
                            OBRIGATÓRIO
                          </Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {getSelectionCount(group.id)}/{group.max_selections}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.selection_type === 'single' ? (
                      <RadioGroup
                        value={selections[group.id]?.[0]?.option_id || ''}
                        onValueChange={(value) => {
                          const option = group.options.find(o => o.id === value);
                          if (option) handleSingleSelect(group, option);
                        }}
                      >
                        {group.options.map(option => (
                          <div
                            key={option.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                              isOptionSelected(group.id, option.id)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => handleSingleSelect(group, option)}
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={option.id} />
                              {option.image_url && (
                                <img 
                                  src={option.image_url} 
                                  alt={option.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium text-sm">{option.name}</p>
                                {option.description && (
                                  <p className="text-xs text-muted-foreground">{option.description}</p>
                                )}
                              </div>
                            </div>
                            {(option.price_override ?? option.price) > 0 && (
                              <span className="text-sm text-primary font-medium">
                                +{formatCurrency(option.price_override ?? option.price)}
                              </span>
                            )}
                          </div>
                        ))}
                      </RadioGroup>
                    ) : group.selection_type === 'multiple' ? (
                      group.options.map(option => (
                        <div
                          key={option.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                            isOptionSelected(group.id, option.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => handleMultipleSelect(
                            group, 
                            option, 
                            !isOptionSelected(group.id, option.id)
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={isOptionSelected(group.id, option.id)}
                              onCheckedChange={(checked) => 
                                handleMultipleSelect(group, option, !!checked)
                              }
                            />
                            {option.image_url && (
                              <img 
                                src={option.image_url} 
                                alt={option.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium text-sm">{option.name}</p>
                              {option.description && (
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              )}
                            </div>
                          </div>
                          {(option.price_override ?? option.price) > 0 && (
                            <span className="text-sm text-primary font-medium">
                              +{formatCurrency(option.price_override ?? option.price)}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      // multiple_repeat
                      group.options.map(option => {
                        const qty = getOptionQuantity(group.id, option.id);
                        return (
                          <div
                            key={option.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border transition-colors',
                              qty > 0 ? 'border-primary bg-primary/5' : ''
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {option.image_url && (
                                <img 
                                  src={option.image_url} 
                                  alt={option.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium text-sm">{option.name}</p>
                                {option.description && (
                                  <p className="text-xs text-muted-foreground">{option.description}</p>
                                )}
                                {(option.price_override ?? option.price) > 0 && (
                                  <span className="text-xs text-primary font-medium">
                                    +{formatCurrency(option.price_override ?? option.price)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleRepeatQuantity(group, option, -1)}
                                disabled={qty === 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-6 text-center font-medium">{qty}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleRepeatQuantity(group, option, 1)}
                                disabled={getSelectionCount(group.id) >= group.max_selections}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Ex: SEM CEBOLA, BEM PASSADO..."
                value={notes}
                onChange={(e) => setNotes(e.target.value.toUpperCase())}
                rows={2}
                className="uppercase"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3">
          {invalidGroups.length > 0 && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Selecione: {invalidGroups.map(g => g.name).join(', ')}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {!duplicateItems && (
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button 
              size="lg" 
              className={duplicateItems ? "flex-1" : "min-w-[180px]"}
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Adicionar {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
