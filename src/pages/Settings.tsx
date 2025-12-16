import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAllUsers, AppRole, UserWithRoles } from '@/hooks/useUserRole';
import { RequireRole } from '@/components/auth/RequireRole';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, Plus, X, Settings2, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  cashier: 'Caixa',
  waiter: 'Garçom',
  kitchen: 'Cozinha',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  cashier: 'bg-primary text-primary-foreground',
  waiter: 'bg-info text-info-foreground',
  kitchen: 'bg-warning text-warning-foreground',
};

export default function Settings() {
  const { data: users, isLoading, refetch } = useAllUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUser, role: selectedRole });
      
      if (error) throw error;
      
      toast({ title: 'Função adicionada com sucesso!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error: any) {
      toast({ 
        title: 'Erro ao adicionar função', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      
      if (error) throw error;
      
      toast({ title: 'Função removida!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao remover função', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <PDVLayout>
      <RequireRole roles={['admin']}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie usuários e permissões do sistema</p>
          </div>

          {/* Role Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Funções do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <Badge className={roleColors.admin}>Admin</Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Acesso total ao sistema. Pode gerenciar usuários, configurações e todos os módulos.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Badge className={roleColors.cashier}>Caixa</Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Gerencia caixa, pagamentos e pode ver relatórios financeiros.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Badge className={roleColors.waiter}>Garçom</Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Gerencia mesas, pedidos e reservas. Acesso ao cardápio.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Badge className={roleColors.kitchen}>Cozinha</Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Visualiza e atualiza status dos pedidos. Acesso ao estoque.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Role */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Atribuir Função
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roleLabels) as AppRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddRole} disabled={!selectedUser || !selectedRole}>
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : users?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuário cadastrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Funções</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-medium">
                                {user.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {user.user_roles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">Sem funções</span>
                            ) : (
                              user.user_roles.map((ur) => (
                                <Badge key={ur.role} className={roleColors[ur.role]}>
                                  {roleLabels[ur.role]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {user.user_roles.map((ur) => (
                              <Button
                                key={ur.role}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRole(user.id, ur.role)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </RequireRole>
    </PDVLayout>
  );
}
