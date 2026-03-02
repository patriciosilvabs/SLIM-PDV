import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_promotion: boolean;
  promotion_price: number | null;
  label: string | null;
}

interface StoreProductGridProps {
  products: Product[];
  onSelect: (product: Product) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function StoreProductGrid({ products, onSelect }: StoreProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-4xl mb-2">🍽️</p>
        <p className="text-sm">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {products.map(product => (
        <button
          key={product.id}
          onClick={() => onSelect(product)}
          className="w-full flex gap-3 p-3 rounded-xl bg-card border border-border hover:shadow-md transition-all text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="text-sm font-semibold leading-tight">{product.name}</h3>
              {product.label && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {product.label}
                </Badge>
              )}
            </div>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {product.is_promotion && product.promotion_price ? (
                <>
                  <span className="text-sm font-bold text-primary">{formatCurrency(product.promotion_price)}</span>
                  <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                </>
              ) : (
                <span className="text-sm font-bold text-primary">{formatCurrency(product.price)}</span>
              )}
            </div>
          </div>
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-2xl">
              🍕
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
