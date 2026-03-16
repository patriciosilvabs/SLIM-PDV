import { useState } from 'react';
import { backendClient } from '@/integrations/backend/client';
import { PlatformLayout } from '@/components/platform/PlatformLayout';
import { RequirePlatformAdmin } from '@/components/platform/RequirePlatformAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  getPlatformAdminByEmail,
  listPlatformAdmins,
} from '@/lib/firebaseTenantCrud';

export default function PlatformAdmins() {
  return (
    <RequirePlatformAdmin>
      <PlatformAdminsContent />
    </RequirePlatformAdmin>
  );
}

function PlatformAdminsContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<{ id: string; email: string } | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: admins, isLoading } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      return await listPlatformAdmins();
    },
  });

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast.error('Digite um email valido');
      return;
    }

    setIsSubmitting(true);
    try {
      const existing = await getPlatformAdminByEmail(newAdminEmail);

      if (existing) {
        toast.error('Este email ja e um administrador da plataforma');
        return;
      }

      const response = await backendClient.functions.invoke('platform-admin-create-admin', {
        body: {
          email: newAdminEmail,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast.success('Administrador adicionado com sucesso');
      setIsAddDialogOpen(false);
      setNewAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast.error(error.message || 'Erro ao adicionar administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    if (admins?.find((admin) => admin.id === selectedAdmin.id)?.user_id === user?.id) {
      toast.error('Voce nao pode remover a si mesmo');
      setIsDeleteDialogOpen(false);
      return;
    }

    if (admins?.length === 1) {
      toast.error('Nao e possivel remover o unico administrador');
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      const response = await backendClient.functions.invoke('platform-admin-delete-admin', {
        body: {
          adminId: selectedAdmin.id,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast.success('Administrador removido');
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      toast.error(error.message || 'Erro ao remover administrador');
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Administradores da Plataforma</h2>
          <p className="text-muted-foreground">
            Gerencie quem tem acesso a gestao da plataforma
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Administradores
                </CardTitle>
                <CardDescription>
                  Usuarios com acesso total a gestao da plataforma
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : admins?.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum administrador cadastrado
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {admins?.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{admin.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Adicionado em {format(new Date(admin.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {admin.user_id === user?.id && (
                        <Badge variant="secondary">Voce</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedAdmin({ id: admin.id, email: admin.email });
                          setIsDeleteDialogOpen(true);
                        }}
                        disabled={admin.user_id === user?.id || admins.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Administrador</DialogTitle>
              <DialogDescription>
                Digite o email do usuario que tera acesso a gestao da plataforma.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-amber-500">
                  O usuario tera acesso total a todos os restaurantes e assinaturas.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddAdmin} disabled={isSubmitting}>
                {isSubmitting ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Administrador</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover <strong>{selectedAdmin?.email}</strong> como administrador da plataforma?
                Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAdmin}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PlatformLayout>
  );
}
