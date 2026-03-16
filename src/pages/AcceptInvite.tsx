import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAcceptInvitation } from '@/hooks/useTenantInvitations';
import { backendClient } from '@/integrations/backend/client';
import { CheckCircle2, Loader2, LogIn, Mail, XCircle } from 'lucide-react';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const acceptInvitation = useAcceptInvitation();

  const [invitationInfo, setInvitationInfo] = useState<{
    email: string;
    tenant_name: string;
    expires_at: string;
  } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function fetchInvitationInfo() {
      if (!token) {
        setInfoError('Token de convite invalido');
        setLoadingInfo(false);
        return;
      }

      try {
        const response = await backendClient.functions.invoke('tenant-invitation-info', {
          body: { token },
        });

        if (response.error) {
          throw response.error;
        }

        const invitation = response.data as
          | {
              email?: string;
              tenant_name?: string;
              expires_at?: string;
            }
          | null;

        if (!invitation?.email || !invitation.tenant_name || !invitation.expires_at) {
          throw new Error('Convite nao encontrado');
        }

        setInvitationInfo({
          email: invitation.email,
          tenant_name: invitation.tenant_name,
          expires_at: invitation.expires_at,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar convite';
        setInfoError(message);
      } finally {
        setLoadingInfo(false);
      }
    }

    fetchInvitationInfo();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    try {
      await acceptInvitation.mutateAsync(token);
      setAccepted(true);
      setTimeout(() => navigate('/'), 2000);
    } catch {
      // handled in mutation
    }
  };

  if (authLoading || loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (infoError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Convite invalido</CardTitle>
            <CardDescription>{infoError}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Ir para o inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Convite aceito</CardTitle>
            <CardDescription>
              Voce agora faz parte de {invitationInfo?.tenant_name}. Redirecionando...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Voce foi convidado</CardTitle>
            <CardDescription>
              {invitationInfo?.tenant_name} convidou voce para se juntar a equipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Convite para:</p>
              <p className="font-medium">{invitationInfo?.email}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Faca login ou crie uma conta com o email acima para aceitar o convite.
            </p>
            <Button asChild className="w-full">
              <Link to={`/auth?redirect=/invite/${token}`}>
                <LogIn className="h-4 w-4 mr-2" />
                Fazer Login / Criar Conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailMatches = user.email?.toLowerCase() === invitationInfo?.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>Voce foi convidado para {invitationInfo?.tenant_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Convite para:</p>
            <p className="font-medium">{invitationInfo?.email}</p>
          </div>

          {!emailMatches && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-sm">
              <p className="text-warning font-medium">Atencao</p>
              <p className="text-muted-foreground">
                Voce esta logado como {user.email}, mas o convite foi enviado para {invitationInfo?.email}.
                Faca login com o email correto.
              </p>
            </div>
          )}

          {emailMatches ? (
            <Button className="w-full" onClick={handleAccept} disabled={acceptInvitation.isPending}>
              {acceptInvitation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aceitando...
                </>
              ) : (
                'Aceitar Convite'
              )}
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/auth?redirect=/invite/${token}`}>Fazer login com outro email</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
