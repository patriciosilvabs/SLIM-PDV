import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface StoreCategoriesProps {
  categories: Array<{ id: string; name: string; icon: string | null }>;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function StoreCategories({ categories, selected, onSelect }: StoreCategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <div className="sticky top-[108px] z-20 bg-background border-b border-border">
      <ScrollArea className="w-full">
        <div className="flex gap-2 px-4 py-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={cn(
                "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                selected === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.icon && <span className="mr-1">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
