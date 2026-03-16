import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAllUsers, AppRole, useUserRoleMutations } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Plus } from 'lucide-react';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  cashier: 'Caixa',
  waiter: 'Garcom',
  kitchen: 'Cozinha',
  kds: 'KDS',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  cashier: 'bg-primary text-primary-foreground',
  waiter: 'bg-info text-info-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  kds: 'bg-orange-500 text-white',
};

export function RolesSettings() {
  const { data: users, refetch } = useAllUsers();
  const { assignRole } = useUserRoleMutations();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      await assignRole(selectedUser, selectedRole);
      toast({ title: 'Funcao adicionada com sucesso!' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar funcao',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Funcoes do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.admin}>Admin</Badge>
              <p className="text-sm text-muted-foreground mt-2">Acesso total ao sistema.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.cashier}>Caixa</Badge>
              <p className="text-sm text-muted-foreground mt-2">Gerencia caixa e pagamentos.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.waiter}>Garcom</Badge>
              <p className="text-sm text-muted-foreground mt-2">Gerencia mesas, pedidos e reservas.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.kitchen}>Cozinha</Badge>
              <p className="text-sm text-muted-foreground mt-2">Visualiza e atualiza status dos pedidos.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Badge className={roleColors.kds}>KDS</Badge>
              <p className="text-sm text-muted-foreground mt-2">Acesso exclusivo a tela KDS.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Atribuir Funcao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um usuario" />
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
                <SelectValue placeholder="Selecione uma funcao" />
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
    </div>
  );
}
