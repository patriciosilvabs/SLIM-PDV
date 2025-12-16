import { useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { Loader2, LayoutDashboard, UtensilsCrossed, ShoppingBag, Package, CreditCard, BarChart3, Settings, LogOut, Menu, X, Pizza, Store } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: AppRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'cashier', 'waiter'] },
  { name: 'Mesas', href: '/tables', icon: UtensilsCrossed, roles: ['admin', 'waiter'] },
  { name: 'Balcão', href: '/counter', icon: Store, roles: ['admin', 'waiter', 'cashier'] },
  { name: 'Pedidos', href: '/orders', icon: ShoppingBag, roles: ['admin', 'waiter', 'kitchen', 'cashier'] },
  { name: 'Cardápio', href: '/menu', icon: Pizza, roles: ['admin', 'waiter', 'kitchen'] },
  { name: 'Estoque', href: '/stock', icon: Package, roles: ['admin', 'kitchen'] },
  { name: 'Caixa', href: '/cash-register', icon: CreditCard, roles: ['admin', 'cashier'] },
  { name: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['admin', 'cashier'] },
  { name: 'Configurações', href: '/settings', icon: Settings, roles: ['admin'] },
];

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  cashier: 'Caixa',
  waiter: 'Garçom',
  kitchen: 'Cozinha',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/20 text-destructive',
  cashier: 'bg-primary/20 text-primary',
  waiter: 'bg-info/20 text-info',
  kitchen: 'bg-warning/20 text-warning',
};

export default function PDVLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { roles, isLoading: rolesLoading } = useUserRole();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize realtime notifications
  useRealtimeNotifications();

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Filter navigation based on user roles
  // If user has no roles, show all items (first user setup scenario)
  const filteredNavigation = roles.length === 0 
    ? navigation 
    : navigation.filter(item => item.roles.some(role => roles.includes(role)));

  // Get primary role to display
  const primaryRole = roles[0] as AppRole | undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <div className="flex items-center gap-3 ml-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Pizza className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-sidebar-foreground font-semibold">PDV Pizzaria</span>
          </div>
        </div>
        <OfflineIndicator />
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:block"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                <Pizza className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sidebar-foreground font-bold text-lg">PDV Pizzaria</h1>
                <p className="text-sidebar-foreground/60 text-xs">Ponto de Venda</p>
              </div>
            </div>
          </div>

          {/* Offline indicator for desktop */}
          <div className="hidden lg:flex px-4 py-2 border-b border-sidebar-border">
            <OfflineIndicator />
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sidebar-foreground font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-sm font-medium truncate">
                  {user.user_metadata?.name || 'Usuário'}
                </p>
                <div className="flex items-center gap-1">
                  {primaryRole ? (
                    <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', roleColors[primaryRole])}>
                      {roleLabels[primaryRole]}
                    </Badge>
                  ) : (
                    <span className="text-sidebar-foreground/60 text-xs truncate">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
