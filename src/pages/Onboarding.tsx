import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Users, Store } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';
import { z } from 'zod';

const tenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { hasTenant, isLoading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Generate slug from name
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
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const checkSlugAvailability = async (slug: string) => {
    if (slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    setCheckingSlug(false);
    setSlugAvailable(!data && !error);
  };

  const handleSlugChange = (slug: string) => {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, slug: cleanSlug }));
    checkSlugAvailability(cleanSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = tenantSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: { name?: string; slug?: string } = {};
      result.error.errors.forEach(err => {
        fieldErrors[err.path[0] as 'name' | 'slug'] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!slugAvailable) {
      setErrors(prev => ({ ...prev, slug: 'Este slug já está em uso' }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          slug: formData.slug,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenant.id,
          user_id: user?.id,
          is_owner: true,
        });

      if (memberError) throw memberError;

      // Add admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user?.id,
          role: 'admin',
          tenant_id: tenant.id,
        });

      if (roleError) throw roleError;

      toast({
        title: 'Restaurante criado!',
        description: 'Você já pode começar a usar o sistema.',
      });

      // Force page reload to refresh tenant context
      window.location.href = '/dashboard';
    } catch (error: unknown) {
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

  if (hasTenant) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-2xl border-border/50">
        <CardHeader className="text-center py-6">
          <img src={logoSlim} alt="slim - Sistema para Restaurante" className="mx-auto max-h-20 w-auto object-contain mb-4" />
          <CardTitle className="text-2xl">Bem-vindo ao Slim!</CardTitle>
          <CardDescription className="text-base">
            Vamos configurar seu restaurante para começar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Features */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <Store className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Cardápio Digital</p>
              </div>
              <div className="text-center">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Gestão de Mesas</p>
              </div>
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">Multi-usuários</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome do Restaurante</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ex: Pizzaria do João"
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
              <Label htmlFor="slug">Identificador único (URL)</Label>
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
                <p className="text-sm text-green-600">Disponível!</p>
              )}
              {slugAvailable === false && (
                <p className="text-sm text-destructive">Já está em uso</p>
              )}
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar meu Restaurante
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
