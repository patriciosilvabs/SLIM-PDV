import { Input } from '@/components/ui/input';
import { Search, MapPin, Phone } from 'lucide-react';

interface StoreHeaderProps {
  tenant: {
    name: string;
    logo_url: string;
    phone: string;
    address: string;
  };
  table: { id: string; number: number } | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function StoreHeader({ tenant, table, searchQuery, onSearchChange }: StoreHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {tenant.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{tenant.name}</h1>
            {table ? (
              <p className="text-xs text-primary font-medium">Mesa {table.number}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {tenant.address && (
                  <span className="flex items-center gap-0.5 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {tenant.address}
                  </span>
                )}
              </div>
            )}
          </div>
          {tenant.phone && (
            <a href={`tel:${tenant.phone}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no cardápio..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0 rounded-lg text-sm"
          />
        </div>
      </div>
    </div>
  );
}
