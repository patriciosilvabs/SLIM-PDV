import { useState, useEffect } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAllUsers, useUserRole, AppRole, UserWithRoles } from '@/hooks/useUserRole';
import { useTables, useTableMutations } from '@/hooks/useTables';
import { RequireRole } from '@/components/auth/RequireRole';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Shield, Plus, X, Crown, Sparkles, AlertTriangle, UtensilsCrossed, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { data: users, isLoading, refetch } = useAllUsers();
  const { roles, isAdmin, refetch: refetchRoles } = useUserRole();
  const { data: hasAdmins, isLoading: checkingAdmins, refetch: refetchAdmins } = useHasAdmins();
  const { data: tables } = useTables();
  const { createTable, updateTable, deleteTable } = useTableMutations();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Table management state
  const [tablesToCreate, setTablesToCreate] = useState(5);
  const [defaultCapacity, setDefaultCapacity] = useState(4);
  const [isCreatingTables, setIsCreatingTables] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [tableForm, setTableForm] = useState({ number: 0, capacity: 4 });
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);

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
      
      refetch();
      refetchRoles();
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
      refetchAdmins();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['has-admins'] });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao remover função', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  // Table management handlers
  const handleCreateTables = async () => {
    if (tablesToCreate <= 0) return;
    
    setIsCreatingTables(true);
    try {
      const existingNumbers = tables?.map(t => t.number) || [];
      let startNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      
      for (let i = 0; i < tablesToCreate; i++) {
        await createTable.mutateAsync({ 
          number: startNumber + i, 
          capacity: defaultCapacity,
          status: 'available',
          position_x: 0,
          position_y: 0
        });
      }
      
      toast({ title: `${tablesToCreate} mesa(s) criada(s) com sucesso!` });
      setTablesToCreate(5);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao criar mesas', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsCreatingTables(false);
    }
  };

  const handleEditTable = (table: any) => {
    setEditingTable(table);
    setTableForm({ number: table.number, capacity: table.capacity || 4 });
    setIsTableDialogOpen(true);
  };

  const handleSaveTable = async () => {
    if (!editingTable) return;
    
    try {
      await updateTable.mutateAsync({ 
        id: editingTable.id, 
        number: tableForm.number, 
        capacity: tableForm.capacity 
      });
      toast({ title: 'Mesa atualizada!' });
      setIsTableDialogOpen(false);
      setEditingTable(null);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao atualizar mesa', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const table = tables?.find(t => t.id === tableId);
    if (table?.status === 'occupied') {
      toast({ 
        title: 'Mesa ocupada', 
        description: 'Não é possível excluir uma mesa ocupada', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      await deleteTable.mutateAsync(tableId);
      toast({ title: 'Mesa excluída!' });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao excluir mesa', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  // Show bootstrap UI if no admins exist
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

  return (
    <PDVLayout>
      <RequireRole roles={['admin']}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie usuários, permissões e mesas do sistema</p>
          </div>

          {/* Table Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Configuração de Mesas
              </CardTitle>
              <CardDescription>
                Gerencie as mesas do estabelecimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create Tables in Batch */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1 space-y-2">
                  <Label>Quantidade de Mesas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={tablesToCreate}
                    onChange={(e) => setTablesToCreate(Number(e.target.value))}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Capacidade Padrão</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={defaultCapacity}
                    onChange={(e) => setDefaultCapacity(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateTables} disabled={isCreatingTables || tablesToCreate <= 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isCreatingTables ? 'Criando...' : 'Criar Mesas'}
                  </Button>
                </div>
              </div>

              {/* Existing Tables */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Mesas Existentes ({tables?.length || 0})
                </Label>
                {tables && tables.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mesa</TableHead>
                        <TableHead>Capacidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.map((table) => (
                        <TableRow key={table.id}>
                          <TableCell className="font-medium">Mesa {table.number}</TableCell>
                          <TableCell>{table.capacity || 4} pessoas</TableCell>
                          <TableCell>
                            <Badge variant={table.status === 'available' ? 'secondary' : 'default'}>
                              {table.status === 'available' ? 'Livre' : 
                               table.status === 'occupied' ? 'Ocupada' : 
                               table.status === 'reserved' ? 'Reservada' : 'Conta'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTable(table)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTable(table.id)}
                                disabled={table.status === 'occupied'}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mesa cadastrada</p>
                    <p className="text-sm">Use o formulário acima para criar mesas</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit Table Dialog */}
          <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Mesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Número da Mesa</Label>
                  <Input
                    type="number"
                    value={tableForm.number}
                    onChange={(e) => setTableForm({ ...tableForm, number: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacidade</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: Number(e.target.value) })}
                  />
                </div>
                <Button onClick={handleSaveTable} className="w-full">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Notification Settings */}
          <NotificationSettings />

          {/* Push Notification Settings */}
          <PushNotificationSettings />

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
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
