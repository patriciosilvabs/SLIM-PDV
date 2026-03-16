import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantContext } from '@/contexts/TenantContext';
import { backendClient } from '@/integrations/backend/client';
import { isTenantSlugAvailable } from '@/lib/tenantSlugAvailability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, ArrowLeft, Store, AlertCircle } from 'lucide-react';
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

export default function CreateStore() {
  const { allTenants, refreshTenants, setActiveTenant } = useTenantContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const storeLimit = 100;
  const canCreateMore = allTenants.length < storeLimit;

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
      checkSlugAvailability(generatedSlug);
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

    if (!canCreateMore) {
      toast({
        title: 'Limite atingido',
        description: `Voce ja possui ${allTenants.length} lojas. Atualize seu plano para adicionar mais.`,
        variant: 'destructive',
      });
      return;
    }

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
        throw new Error('Falha ao criar loja');
      }

      toast({
        title: 'Loja criada!',
        description: 'Sua nova loja foi configurada com sucesso.',
      });

      setActiveTenant(payload.tenant.id, payload.tenant, true);
      void refreshTenants();
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error creating store:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar loja',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-2xl border-border/50">
        <CardHeader className="text-center py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <img src={logoSlim} alt="slim" className="max-h-10 w-auto object-contain" />
            <div className="w-16" />
          </div>

          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Store className="h-6 w-6" />
            Nova Loja
          </CardTitle>
          <CardDescription className="text-base">
            Adicione mais uma unidade ao seu negocio
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!canCreateMore ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Voce atingiu o limite de {storeLimit} lojas do seu plano.
                Entre em contato para aumentar seu limite.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Alert className="bg-muted/50">
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Voce possui <strong>{allTenants.length}</strong> {allTenants.length === 1 ? 'loja' : 'lojas'} ativas
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Loja</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Pizzaria Centro"
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
                    placeholder="pizzaria-centro"
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || checkingSlug || slugAvailable !== true}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {checkingSlug ? 'Verificando...' : 'Criar Loja'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
