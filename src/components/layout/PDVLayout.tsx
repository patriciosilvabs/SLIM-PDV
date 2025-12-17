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
import { PrinterStatusIndicator } from '@/components/PrinterStatusIndicator';
import { Loader2, LayoutDashboard, UtensilsCrossed, ShoppingBag, Package, CreditCard, BarChart3, Settings, LogOut, Menu, X, Store, Users, Kanban, ChefHat, History, Target, UserCircle, Pizza, RotateCcw, Shield } from 'lucide-react';
import logoTotal from '@/assets/logo-total.png';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: AppRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'cashier', 'waiter'] },
  { name: 'Gestão de Pedidos', href: '/order-management', icon: Kanban, roles: ['admin', 'cashier'] },
  { name: 'KDS', href: '/kds', icon: ChefHat, roles: ['admin', 'kitchen'] },
  { name: 'Mesas', href: '/tables', icon: UtensilsCrossed, roles: ['admin', 'waiter'] },
  { name: 'Balcão', href: '/counter', icon: Store, roles: ['admin', 'waiter', 'cashier'] },
  { name: 'Pedidos', href: '/orders', icon: ShoppingBag, roles: ['admin', 'waiter', 'kitchen', 'cashier'] },
  { name: 'Cardápio', href: '/menu', icon: Pizza, roles: ['admin', 'waiter', 'kitchen'] },
  { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'cashier', 'waiter'] },
  { name: 'Estoque', href: '/stock', icon: Package, roles: ['admin', 'kitchen'] },
  { name: 'Caixa', href: '/cash-register', icon: CreditCard, roles: ['admin', 'cashier'] },
  { name: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['admin', 'cashier'] },
  { name: 'Histórico', href: '/closing-history', icon: History, roles: ['admin', 'cashier'] },
  { name: 'Reaberturas', href: '/reopen-history', icon: RotateCcw, roles: ['admin'] },
  { name: 'Auditoria', href: '/audit-dashboard', icon: Shield, roles: ['admin'] },
  { name: 'Desempenho', href: '/performance', icon: Target, roles: ['admin', 'cashier'] },
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
          <div className="flex items-center ml-4">
            <img src={logoTotal} alt="TOTAL" className="max-h-10 max-w-full object-contain" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <PrinterStatusIndicator />
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-52 bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:block"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-center px-4 border-b border-sidebar-border">
            <img src={logoTotal} alt="TOTAL - Sistema PDV" className="max-h-12 max-w-full object-contain" />
          </div>

          {/* Status indicators for desktop */}
          <div className="hidden lg:flex px-4 py-2 border-b border-sidebar-border gap-2">
            <OfflineIndicator />
            <PrinterStatusIndicator />
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
            <Link to="/profile" onClick={() => setSidebarOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent mb-1"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Meu Perfil
              </Button>
            </Link>
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
      <main className="lg:ml-52 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
