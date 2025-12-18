import { cn } from '@/lib/utils';
import { 
  UtensilsCrossed, 
  ChefHat, 
  ShoppingCart, 
  Printer, 
  Bell, 
  Megaphone, 
  Smartphone, 
  Users, 
  Shield 
} from 'lucide-react';

export type SettingsSection = 
  | 'tables' 
  | 'kds' 
  | 'orders' 
  | 'printers' 
  | 'notifications' 
  | 'announcements' 
  | 'push' 
  | 'users' 
  | 'roles';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const sections = [
  {
    group: 'Sistema',
    items: [
      { id: 'tables' as const, label: 'Mesas', icon: UtensilsCrossed },
      { id: 'kds' as const, label: 'KDS', icon: ChefHat },
      { id: 'orders' as const, label: 'Pedidos', icon: ShoppingCart },
      { id: 'printers' as const, label: 'Impressoras', icon: Printer },
    ],
  },
  {
    group: 'Notificações',
    items: [
      { id: 'notifications' as const, label: 'Sons', icon: Bell },
      { id: 'announcements' as const, label: 'Avisos Agendados', icon: Megaphone },
      { id: 'push' as const, label: 'Push', icon: Smartphone },
    ],
  },
  {
    group: 'Usuários',
    items: [
      { id: 'users' as const, label: 'Usuários', icon: Users },
      { id: 'roles' as const, label: 'Funções', icon: Shield },
    ],
  },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <nav className="w-56 flex-shrink-0 space-y-6">
      {sections.map((section) => (
        <div key={section.group}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            {section.group}
          </h3>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                    activeSection === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
