import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubItemSelection } from './PizzaUnitCard';
import { useProductComplements, GroupWithOptions } from '@/hooks/useProductComplements';

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
  applies_per_unit?: boolean;
  unit_count?: number;
}

interface ComplementOption {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  price_override?: number | null;
}

interface LocalGroupWithOptions extends ComplementGroup {
  options: ComplementOption[];
}

export interface SelectedComplement {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
  quantity: number;
  price_calculation_type?: 'sum' | 'average' | 'highest' | 'lowest';
}

// Extended interface for sub-items (individual pizzas in a combo)
export interface SubItemComplement {
  sub_item_index: number;
  sub_item_notes: string;
  complements: SelectedComplement[];
}

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onAdd: (
    product: Product, 
    quantity: number, 
    complements: SelectedComplement[], 
    notes: string,
    subItems?: SubItemComplement[]
  ) => void;
  duplicateItems?: boolean;
  channel?: 'counter' | 'delivery' | 'table';
  overrideUnitCount?: number;
}

export function ProductDetailDialog({ open, onOpenChange, product, onAdd, duplicateItems, channel, overrideUnitCount }: ProductDetailDialogProps) {
  const [selections, setSelections] = useState<Record<string, SelectedComplement[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  
  // Per-unit notes (single field for all flavors)
  const [perUnitNotes, setPerUnitNotes] = useState('');
  // Usar o novo hook otimizado com React Query (cache + consultas paralelas)
  const { data: groups = [], isLoading: loading } = useProductComplements(
    open ? product?.id : undefined,
    channel
  );

  // Converter para o formato local com sort_order
  const localGroups: LocalGroupWithOptions[] = useMemo(() => {
    return groups.map((g, index) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      selection_type: g.selection_type as 'single' | 'multiple' | 'multiple_repeat',
      is_required: g.is_required,
      min_selections: g.min_selections,
      max_selections: g.max_selections,
      sort_order: index,
      price_calculation_type: g.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
      applies_per_unit: g.applies_per_unit,
      unit_count: g.unit_count,
      options: g.options.map(opt => ({
        id: opt.id,
        name: opt.name,
        description: opt.description,
        price: opt.price,
        image_url: opt.image_url,
        price_override: opt.price_override,
      })),
    }));
  }, [groups]);

  // Determine if this product has per-unit groups
  const hasPerUnitGroups = useMemo(() => {
    return localGroups.some(g => g.applies_per_unit === true);
  }, [localGroups]);

  // Get the number of units - use override if provided, otherwise from group config
  const unitCount = useMemo(() => {
    if (overrideUnitCount !== undefined) return overrideUnitCount;
    const perUnitGroup = localGroups.find(g => g.applies_per_unit === true);
    return perUnitGroup?.unit_count ?? 1;
  }, [localGroups, overrideUnitCount]);

  // Groups that apply per unit (for each pizza)
  const perUnitGroups = useMemo(() => {
    return localGroups.filter(g => g.applies_per_unit === true);
  }, [localGroups]);

  // Groups that apply to the whole item (shared)
  const sharedGroups = useMemo(() => {
    return localGroups.filter(g => !g.applies_per_unit);
  }, [localGroups]);

  // Reset state when product changes
  useEffect(() => {
    if (open && product) {
      setSelections({});
      setQuantity(1);
      setNotes('');
      setPerUnitNotes('');
    }
  }, [product?.id, open]);

  const handleSingleSelect = (group: LocalGroupWithOptions, option: ComplementOption) => {
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
        price_calculation_type: group.price_calculation_type,
      }],
    }));
  };

  const handleMultipleSelect = (group: LocalGroupWithOptions, option: ComplementOption, checked: boolean) => {
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
            price_calculation_type: group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
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

  const handleRepeatQuantity = (group: LocalGroupWithOptions, option: ComplementOption, delta: number) => {
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
            price_calculation_type: group.price_calculation_type as 'sum' | 'average' | 'highest' | 'lowest',
          }],
        };
      }
      return prev;
    });
  };

  // For per-unit groups, handle selection with unitCount as max
  const handlePerUnitSelect = (group: LocalGroupWithOptions, option: ComplementOption, checked: boolean) => {
    const price = option.price_override ?? option.price;
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (checked) {
        if (current.length >= unitCount) return prev;
        return {
          ...prev,
          [group.id]: [...current, {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price,
            quantity: 1,
            price_calculation_type: group.price_calculation_type,
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

  // Calculate price for per-unit groups using the configured price_calculation_type
  const calculatePerUnitPrice = (): number => {
    let total = 0;
    for (const group of perUnitGroups) {
      total += calculateGroupPrice(group.id, group.price_calculation_type);
    }
    return total;
  };

  const complementsTotal = useMemo(() => {
    const sharedPrice = sharedGroups.reduce((total, group) => {
      return total + calculateGroupPrice(group.id, group.price_calculation_type);
    }, 0);
    
    const perUnitPrice = calculatePerUnitPrice();
    
    return sharedPrice + perUnitPrice;
  }, [selections, groups, sharedGroups, perUnitGroups]);

  const productPrice = product?.is_promotion && product?.promotion_price 
    ? product.promotion_price 
    : product?.price ?? 0;

  const totalPrice = (productPrice + complementsTotal) * quantity;

  // Validate shared groups
  const invalidSharedGroups = sharedGroups.filter(group => {
    const count = getSelectionCount(group.id);
    return group.is_required && count < group.min_selections;
  });

  // Validate per-unit groups (now from unified selections)
  const invalidPerUnitGroups = useMemo(() => {
    if (!hasPerUnitGroups) return [];
    return perUnitGroups.filter(group => {
      if (!group.is_required) return false;
      const count = getSelectionCount(group.id);
      return count < unitCount; // must select exactly unitCount flavors
    });
  }, [selections, perUnitGroups, hasPerUnitGroups, unitCount]);

  const canAdd = invalidSharedGroups.length === 0 && invalidPerUnitGroups.length === 0;

  const handleAdd = () => {
    if (!product || !canAdd) return;
    
    // Shared complements
    const sharedComplements = Object.values(selections).flat();
    
    // Build sub-items from unified selections: each selected flavor becomes a sub_item
    let subItemsData: SubItemComplement[] | undefined;
    if (hasPerUnitGroups) {
      const allPerUnitSelections = perUnitGroups.flatMap(g => selections[g.id] || []);
      if (allPerUnitSelections.length > 0) {
        subItemsData = allPerUnitSelections.map((sel, index) => ({
          sub_item_index: index + 1,
          sub_item_notes: index === 0 ? perUnitNotes : '',
          complements: [{
            group_id: sel.group_id,
            group_name: sel.group_name,
            option_id: sel.option_id,
            option_name: sel.option_name,
            price: sel.price,
            quantity: sel.quantity,
          }],
        }));
      }
    }
    
    onAdd(product, quantity, sharedComplements, notes, subItemsData);
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
              <>
                {/* Per-unit groups - Unified flavor selection */}
                {hasPerUnitGroups && perUnitGroups.map(group => (
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
                        <p className="text-xs text-muted-foreground">
                          {unitCount === 1 ? 'Escolha 1 sabor' : `Escolha até ${unitCount} sabores`}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getSelectionCount(group.id)}/{unitCount}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {unitCount === 1 ? (
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
                                  <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded object-cover" />
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
                      ) : (
                        group.options.map(option => (
                          <div
                            key={option.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                              isOptionSelected(group.id, option.id)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => handlePerUnitSelect(group, option, !isOptionSelected(group.id, option.id))}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isOptionSelected(group.id, option.id)}
                                onCheckedChange={(checked) => handlePerUnitSelect(group, option, !!checked)}
                              />
                              {option.image_url && (
                                <img src={option.image_url} alt={option.name} className="w-10 h-10 rounded object-cover" />
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
                      )}
                    </div>

                    {/* Notes for this pizza group */}
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs">Observações</Label>
                      <Textarea
                        placeholder="Ex: SEM CEBOLA, SEM MOLHO..."
                        value={perUnitNotes}
                        onChange={(e) => setPerUnitNotes(e.target.value.toUpperCase())}
                        rows={2}
                        className="uppercase text-sm"
                      />
                    </div>
                  </div>
                ))}

                {/* Shared groups - apply to whole item */}
                {sharedGroups.map(group => (
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
                ))}
              </>
            )}

            {/* Notes - general observations */}
            {!hasPerUnitGroups && (
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3">
          {(invalidSharedGroups.length > 0 || invalidPerUnitGroups.length > 0) && (
            <div className="flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Selecione: {[...invalidSharedGroups, ...invalidPerUnitGroups].map(g => g.name).join(', ')}
              </span>
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
