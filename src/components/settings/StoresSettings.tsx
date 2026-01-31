import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGroupStores } from '@/hooks/useGroupStores';
import { useTenant } from '@/hooks/useTenant';
import { Building2, Plus, ExternalLink, Check, Settings } from 'lucide-react';
import { useTenantContext } from '@/contexts/TenantContext';

export function StoresSettings() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { setActiveTenant } = useTenantContext();
  const { stores, isLoading, isOwnerOfGroup } = useGroupStores();

  const handleCreateStore = () => {
    navigate('/create-store');
  };

  const handleSwitchToStore = (storeId: string) => {
    if (storeId !== tenantId) {
      setActiveTenant(storeId);
    }
  };

  const getStoreUrl = (slug: string) => {
    // URL base do cardápio web - pode ser configurado depois
    return `/${slug}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Minhas Lojas</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Minhas Lojas
            </CardTitle>
            <CardDescription>
              Gerencie todas as lojas do seu grupo. 
              {stores.length > 1 && ` Você possui ${stores.length} lojas.`}
            </CardDescription>
          </div>
          {isOwnerOfGroup && (
            <Button onClick={handleCreateStore}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Loja
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma loja encontrada.</p>
              <Button className="mt-4" onClick={handleCreateStore}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Loja
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => {
                const isCurrentStore = store.id === tenantId;
                return (
                  <Card 
                    key={store.id} 
                    className={`relative transition-all ${
                      isCurrentStore 
                        ? 'border-primary ring-1 ring-primary/20' 
                        : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{store.name}</span>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              /{store.slug}
                            </code>
                          </CardDescription>
                        </div>
                        {isCurrentStore && (
                          <Badge variant="default" className="flex-shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Atual
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <span>
                          Criada em {new Date(store.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        {!store.is_active && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isCurrentStore ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => navigate('/settings/tables')}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Configurações
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleSwitchToStore(store.id)}
                          >
                            Acessar Loja
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          asChild
                        >
                          <a 
                            href={getStoreUrl(store.slug)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Abrir cardápio"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info sobre replicação */}
      {stores.length > 1 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Replicar Cardápio</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Você pode replicar o cardápio completo de uma loja para outras do seu grupo.
                  Acesse o <strong>Menu</strong> e clique em <strong>"Replicar para outras lojas"</strong>.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/menu')}
                >
                  Ir para Menu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
