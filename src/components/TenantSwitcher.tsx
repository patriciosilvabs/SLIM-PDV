import { Store, ChevronDown, Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantContext } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TenantSwitcherProps {
  collapsed?: boolean;
}

export function TenantSwitcher({ collapsed = false }: TenantSwitcherProps) {
  const { allTenants, activeTenant, setActiveTenant, isOwner } = useTenantContext();
  const navigate = useNavigate();

  // Don't render if only one tenant and not owner (can't add more)
  if (allTenants.length <= 1 && !isOwner) {
    return null;
  }

  const handleSelectTenant = (tenantId: string) => {
    if (tenantId !== activeTenant?.tenant_id) {
      setActiveTenant(tenantId);
    }
  };

  const handleAddStore = () => {
    navigate('/create-store');
  };

  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Store className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          align="start" 
          side="right" 
          className="w-64 p-2"
        >
          <TenantList
            allTenants={allTenants}
            activeTenant={activeTenant}
            isOwner={isOwner}
            onSelectTenant={handleSelectTenant}
            onAddStore={handleAddStore}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Store className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-sm font-medium">
              {activeTenant?.tenant?.name || 'Selecionar loja'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {allTenants.length > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {allTenants.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="start" 
        className="w-64 p-2"
      >
        <TenantList
          allTenants={allTenants}
          activeTenant={activeTenant}
          isOwner={isOwner}
          onSelectTenant={handleSelectTenant}
          onAddStore={handleAddStore}
        />
      </PopoverContent>
    </Popover>
  );
}

interface TenantListProps {
  allTenants: Array<{
    tenant_id: string;
    is_owner: boolean;
    tenant: { id: string; name: string; slug: string } | null;
  }>;
  activeTenant: {
    tenant_id: string;
    tenant: { id: string; name: string; slug: string } | null;
  } | null;
  isOwner: boolean;
  onSelectTenant: (tenantId: string) => void;
  onAddStore: () => void;
}

function TenantList({ 
  allTenants, 
  activeTenant, 
  isOwner, 
  onSelectTenant, 
  onAddStore 
}: TenantListProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground px-2 py-1">
        Suas lojas
      </p>
      
      {allTenants.map((membership) => {
        const isActive = membership.tenant_id === activeTenant?.tenant_id;
        return (
          <button
            key={membership.tenant_id}
            onClick={() => onSelectTenant(membership.tenant_id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted text-foreground"
            )}
          >
            <Store className="h-4 w-4 flex-shrink-0" />
            <span className="truncate flex-1 text-left">
              {membership.tenant?.name || 'Loja sem nome'}
            </span>
            {membership.is_owner && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Dono
              </Badge>
            )}
            {isActive && (
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
          </button>
        );
      })}

      {isOwner && (
        <>
          <div className="border-t my-2" />
          <button
            onClick={onAddStore}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar loja</span>
          </button>
        </>
      )}
    </div>
  );
}
