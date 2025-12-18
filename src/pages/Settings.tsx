import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/RequireRole';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';
import { ScheduledAnnouncementsSettings } from '@/components/ScheduledAnnouncementsSettings';
import { PrinterSettings } from '@/components/PrinterSettings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Sparkles, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Settings components
import { SettingsSidebar, SettingsSection } from '@/components/settings/SettingsSidebar';
import { TablesSettings } from '@/components/settings/TablesSettings';
import { KdsSettingsSection } from '@/components/settings/KdsSettingsSection';
import { OrderSettingsSection } from '@/components/settings/OrderSettingsSection';
import { UsersSettings } from '@/components/settings/UsersSettings';
import { RolesSettings } from '@/components/settings/RolesSettings';

// Hook to check if system has any admins
function useHasAdmins() {
  return useQuery({
    queryKey: ['has-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
      
      if (error) throw error;
      return (data?.length || 0) > 0;
    },
  });
}

export default function Settings() {
  const { user } = useAuth();
  const { data: hasAdmins, isLoading: checkingAdmins, refetch: refetchAdmins } = useHasAdmins();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('tables');

  // Check if current user can bootstrap (no admins exist)
  const canBootstrap = !checkingAdmins && hasAdmins === false && user?.id;

  const handleBootstrapAdmin = async () => {
    if (!user?.id || !canBootstrap) return;
    
    setIsBootstrapping(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' });
      
      if (error) throw error;
      
      toast({ 
        title: 'Parabéns! 🎉', 
        description: 'Você agora é o administrador do sistema!' 
      });
      
      refetchAdmins();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['has-admins'] });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao se tornar admin', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  if (canBootstrap) {
    return (
      <PDVLayout>
        <div className="max-w-2xl mx-auto space-y-6 pt-8">
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Bem-vindo ao PDV Pizzaria!</CardTitle>
              <CardDescription className="text-base">
                Você é o primeiro usuário do sistema. Configure-se como administrador para começar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">Atenção</p>
                  <p className="text-muted-foreground">
                    Como administrador, você terá acesso total ao sistema e poderá gerenciar outros usuários.
                    Esta ação só pode ser feita uma vez.
                  </p>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleBootstrapAdmin}
                disabled={isBootstrapping}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                {isBootstrapping ? 'Configurando...' : 'Tornar-me Administrador'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PDVLayout>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'tables':
        return <TablesSettings />;
      case 'kds':
        return <KdsSettingsSection />;
      case 'orders':
        return <OrderSettingsSection />;
      case 'printers':
        return <PrinterSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'announcements':
        return <ScheduledAnnouncementsSettings />;
      case 'push':
        return <PushNotificationSettings />;
      case 'users':
        return <UsersSettings />;
      case 'roles':
        return <RolesSettings />;
      default:
        return <TablesSettings />;
    }
  };

  return (
    <PDVLayout>
      <RequireRole roles={['admin']}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie usuários, permissões e mesas do sistema</p>
          </div>

          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="hidden md:block">
              <SettingsSidebar 
                activeSection={activeSection} 
                onSectionChange={setActiveSection} 
              />
            </div>

            {/* Mobile select */}
            <div className="md:hidden w-full">
              <select 
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as SettingsSection)}
                className="w-full p-3 rounded-lg border bg-card text-card-foreground mb-4"
              >
                <optgroup label="Sistema">
                  <option value="tables">Mesas</option>
                  <option value="kds">KDS</option>
                  <option value="orders">Pedidos</option>
                  <option value="printers">Impressoras</option>
                </optgroup>
                <optgroup label="Notificações">
                  <option value="notifications">Sons</option>
                  <option value="announcements">Avisos Agendados</option>
                  <option value="push">Push</option>
                </optgroup>
                <optgroup label="Usuários">
                  <option value="users">Usuários</option>
                  <option value="roles">Funções</option>
                </optgroup>
              </select>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
          </div>
        </div>
      </RequireRole>
    </PDVLayout>
  );
}
