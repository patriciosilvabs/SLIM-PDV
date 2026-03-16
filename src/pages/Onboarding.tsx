import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantContext } from '@/contexts/TenantContext';
import { backendClient } from '@/integrations/backend/client';
import { isTenantSlugAvailable } from '@/lib/tenantSlugAvailability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Users, Store, LogOut, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import logoSlim from '@/assets/logo-slim.png';
import { z } from 'zod';

const tenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens'),
});

export default function Onboarding() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { hasTenant, isLoading: tenantLoading, refreshTenants, setActiveTenant } = useTenantContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const addingStore = searchParams.get('add') === 'store';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate('/auth');
    } catch {
      toast({
        title: 'Erro ao sair',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  const handleNameChange = (name: string) => {
    const generatedSlug = generateSlug(name);
    const shouldGenerateSlug = !formData.slug;

    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generatedSlug,
    }));

    if (shouldGenerateSlug && generatedSlug.length >= 3) {
      void checkSlugAvailability(generatedSlug);
    }
  };

  const checkSlugAvailability = async (slug: string) => {
    if (slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    try {
      const available = await isTenantSlugAvailable(slug);
      setSlugAvailable(available);
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleSlugChange = (slug: string) => {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, slug: cleanSlug }));
    checkSlugAvailability(cleanSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = tenantSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: { name?: string; slug?: string } = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as 'name' | 'slug'] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (slugAvailable !== true) {
      setErrors((prev) => ({
        ...prev,
        slug: slugAvailable === false ? 'Este slug ja esta em uso' : 'Aguarde a verificacao do slug',
      }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { error: refreshError } = await backendClient.auth.refreshSession();
      if (refreshError) {
        throw new Error('Erro ao validar sessao. Faca login novamente.');
      }

      const available = await isTenantSlugAvailable(formData.slug);
      if (!available) {
        setSlugAvailable(false);
        setErrors((prev) => ({ ...prev, slug: 'Este slug ja esta em uso' }));
        setIsSubmitting(false);
        return;
      }

      const response = await backendClient.functions.invoke('bootstrap-tenant', {
        body: {
          name: formData.name,
          slug: formData.slug,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const payload = response.data as
        | {
            tenant?: {
              id: string;
              name: string;
              slug: string;
            };
          }
        | null;

      if (!payload?.tenant?.id) {
        throw new Error('Falha ao criar restaurante');
      }

      toast({
        title: 'Restaurante criado!',
        description: 'Voce ja pode comecar a usar o sistema.',
      });

      setActiveTenant(payload.tenant.id, payload.tenant, true);
      void refreshTenants();
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Onboarding Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar restaurante',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (hasTenant && !addingStore) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-2xl border-border/50">
        <CardHeader className="text-center py-6">
          <img src={logoSlim} alt="slim - Sistema para Restaurante" className="mx-auto max-h-20 w-auto object-contain mb-4" />
          <CardTitle className="text-2xl">Bem-vindo ao Slim!</CardTitle>
          <CardDescription className="text-base">
            Vamos configurar seu restaurante para comecar
          </CardDescription>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="ml-2"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="ml-1">Sair</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <Store className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Cardapio Digital</p>
              </div>
              <div className="text-center">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Gestao de Mesas</p>
              </div>
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Multi-usuarios</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome do Restaurante</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ex: Pizzaria do Joao"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identificador unico (URL)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">slim.app/</span>
                <Input
                  id="slug"
                  type="text"
                  placeholder="pizzaria-do-joao"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={errors.slug ? 'border-destructive' : slugAvailable === true ? 'border-green-500' : ''}
                  required
                />
                {checkingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug}</p>
              )}
              {slugAvailable === true && formData.slug.length >= 3 && (
                <p className="text-sm text-green-600">Disponivel!</p>
              )}
              {slugAvailable === false && (
                <p className="text-sm text-destructive">Ja esta em uso</p>
              )}
              <p className="text-xs text-muted-foreground">
                Apenas letras minusculas, numeros e hifens
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || checkingSlug || slugAvailable !== true}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {checkingSlug ? 'Verificando...' : 'Criar meu Restaurante'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-0">
          <div className="w-full border-t pt-4">
            <Alert className="bg-muted/50">
              <Mail className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Recebeu um convite?</strong> Verifique seu email e clique no link do convite para entrar em um restaurante existente.
              </AlertDescription>
            </Alert>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
