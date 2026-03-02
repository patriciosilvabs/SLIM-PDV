import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Minus, MessageSquare } from 'lucide-react';
import { CartItem } from '@/pages/store/StorePage';
import { StoreData } from '@/hooks/usePublicStore';

interface StoreProductDetailProps {
  product: StoreData['products'][0];
  store: StoreData;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function StoreProductDetail({ product, store, open, onClose, onAddToCart }: StoreProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedComplements, setSelectedComplements] = useState<Record<string, Record<string, number>>>({});

  // Get variations for this product
  const variations = store.variations.filter(v => v.product_id === product.id);

  // Get complement groups for this product
  const productGroupLinks = store.productGroups.filter(pg => pg.product_id === product.id);
  const groups = productGroupLinks
    .map(link => store.complementGroups.find(g => g.id === link.group_id))
    .filter(Boolean)
    .filter(g => g!.visibility !== 'hidden' && (!g!.channels || g!.channels.includes('delivery')));

  const getGroupOptions = (groupId: string) => {
    const links = store.groupOptions.filter(go => go.group_id === groupId);
    return links.map(link => {
      const option = store.complementOptions.find(o => o.id === link.option_id);
      if (!option) return null;
      return {
        ...option,
        price: link.price_override ?? option.price,
        max_quantity: link.max_quantity || 1,
      };
    }).filter(Boolean) as Array<{ id: string; name: string; price: number; max_quantity: number; image_url: string | null }>;
  };

  const toggleComplement = (groupId: string, optionId: string, group: any) => {
    setSelectedComplements(prev => {
      const groupSelections = { ...(prev[groupId] || {}) };
      
      if (group.selection_type === 'single') {
        // Radio - only one selection
        if (groupSelections[optionId]) {
          delete groupSelections[optionId];
        } else {
          return { ...prev, [groupId]: { [optionId]: 1 } };
        }
      } else {
        // Checkbox
        if (groupSelections[optionId]) {
          delete groupSelections[optionId];
        } else {
          const currentCount = Object.keys(groupSelections).length;
          if (group.max_selections && currentCount >= group.max_selections) return prev;
          groupSelections[optionId] = 1;
        }
      }
      
      return { ...prev, [groupId]: groupSelections };
    });
  };

  const basePrice = product.is_promotion && product.promotion_price 
    ? product.promotion_price 
    : product.price;

  const variationModifier = selectedVariation 
    ? variations.find(v => v.id === selectedVariation)?.price_modifier || 0 
    : 0;

  const complementsTotal = useMemo(() => {
    let total = 0;
    for (const [groupId, selections] of Object.entries(selectedComplements)) {
      for (const [optionId, qty] of Object.entries(selections)) {
        const options = getGroupOptions(groupId);
        const option = options.find(o => o.id === optionId);
        if (option) total += option.price * qty;
      }
    }
    return total;
  }, [selectedComplements]);

  const unitPrice = basePrice + variationModifier + complementsTotal;
  const totalPrice = unitPrice * quantity;

  // Validate required groups
  const isValid = useMemo(() => {
    for (const group of groups) {
      if (!group) continue;
      if (group.is_required) {
        const selections = selectedComplements[group.id] || {};
        const count = Object.keys(selections).length;
        if (count < (group.min_selections || 1)) return false;
      }
    }
    if (variations.length > 0 && !selectedVariation) return false;
    return true;
  }, [groups, selectedComplements, variations, selectedVariation]);

  const handleAdd = () => {
    const complements: CartItem['complements'] = [];
    for (const [groupId, selections] of Object.entries(selectedComplements)) {
      const group = store.complementGroups.find(g => g.id === groupId);
      for (const [optionId, qty] of Object.entries(selections)) {
        const option = store.complementOptions.find(o => o.id === optionId);
        if (option) {
          const link = store.groupOptions.find(go => go.group_id === groupId && go.option_id === optionId);
          complements.push({
            option_id: optionId,
            option_name: option.name,
            group_name: group?.name || '',
            price: link?.price_override ?? option.price,
            quantity: qty,
          });
        }
      }
    }

    const variation = selectedVariation ? variations.find(v => v.id === selectedVariation) : null;

    onAddToCart({
      id: `${product.id}-${Date.now()}`,
      product_id: product.id,
      product_name: product.name + (variation ? ` (${variation.name})` : ''),
      variation_id: selectedVariation,
      variation_name: variation?.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes: notes || undefined,
      image_url: product.image_url,
      complements: complements.length > 0 ? complements : undefined,
    });

    // Reset
    setQuantity(1);
    setNotes('');
    setShowNotes(false);
    setSelectedVariation(null);
    setSelectedComplements({});
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 overflow-y-auto">
        {/* Product image */}
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-32 bg-muted flex items-center justify-center text-5xl">🍕</div>
        )}

        <div className="p-4 space-y-4">
          <SheetHeader className="text-left p-0">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-lg">{product.name}</SheetTitle>
                {product.description && (
                  <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                )}
              </div>
              <div className="text-right">
                {product.is_promotion && product.promotion_price ? (
                  <>
                    <p className="text-lg font-bold text-primary">{formatCurrency(product.promotion_price)}</p>
                    <p className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-primary">{formatCurrency(product.price)}</p>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Variations */}
          {variations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tamanho <span className="text-destructive">*</span></Label>
              <RadioGroup value={selectedVariation || ''} onValueChange={setSelectedVariation}>
                {variations.map(v => (
                  <label key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={v.id} />
                      <span className="text-sm font-medium">{v.name}</span>
                    </div>
                    {v.price_modifier > 0 && (
                      <span className="text-sm text-muted-foreground">+{formatCurrency(v.price_modifier)}</span>
                    )}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Complement Groups */}
          {groups.map(group => {
            if (!group) return null;
            const options = getGroupOptions(group.id);
            const selections = selectedComplements[group.id] || {};
            const selCount = Object.keys(selections).length;

            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">
                      {group.name}
                      {group.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {group.description && (
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selCount}/{group.max_selections || '∞'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  {options.map(option => {
                    const isSelected = !!selections[option.id];
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleComplement(group.id, option.id, group)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {isSelected && <span className="text-primary-foreground text-xs">✓</span>}
                          </div>
                          <span className="text-sm">{option.name}</span>
                        </div>
                        {option.price > 0 && (
                          <span className="text-sm text-muted-foreground">+{formatCurrency(option.price)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div>
            {!showNotes ? (
              <button
                onClick={() => setShowNotes(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Adicionar observação
              </button>
            ) : (
              <Textarea
                placeholder="Ex: sem cebola, bem passado..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
                rows={2}
              />
            )}
          </div>

          {/* Quantity + Add button */}
          <div className="flex items-center gap-3 pt-2 pb-4">
            <div className="flex items-center border border-border rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-l-lg rounded-r-none"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-semibold">{quantity}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuantity(q => q + 1)}
                className="h-10 w-10 rounded-r-lg rounded-l-none"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!isValid}
              className="flex-1 h-12 text-base font-semibold rounded-xl"
            >
              Adicionar {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
