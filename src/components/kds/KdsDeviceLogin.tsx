import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { Tablet, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';

interface KdsDeviceLoginProps {
  onLoginSuccess: (device: any) => void;
}

const DEVICE_AUTH_KEY = 'kds_device_auth';

export function getStoredDeviceAuth(): { deviceId: string; deviceName: string; stationId: string | null } | null {
  try {
    const stored = localStorage.getItem(DEVICE_AUTH_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function clearDeviceAuth() {
  localStorage.removeItem(DEVICE_AUTH_KEY);
}

export function KdsDeviceLogin({ onLoginSuccess }: KdsDeviceLoginProps) {
  const { tenantId } = useTenant();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !tenantId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kds-device-auth', {
        body: {
          action: 'login',
          username: username.trim(),
          password: password.trim(),
          tenant_id: tenantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const device = data.device;
      
      // Store auth in localStorage
      const authData = {
        deviceId: device.device_id,
        deviceName: device.name,
        stationId: device.station_id,
      };
      localStorage.setItem(DEVICE_AUTH_KEY, JSON.stringify(authData));
      
      // Also update KDS device settings for compatibility
      localStorage.setItem('pdv_kds_device_id', device.device_id);
      localStorage.setItem('pdv_kds_device_settings', JSON.stringify({
        deviceId: device.device_id,
        deviceName: device.name,
        assignedStationId: device.station_id,
      }));

      toast.success(`Bem-vindo, ${device.name}!`);
      onLoginSuccess(device);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={logoSlim} alt="Logo" className="h-12 mx-auto" />
          <div className="flex items-center justify-center gap-2">
            <Tablet className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Login do Dispositivo KDS</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Insira as credenciais cadastradas para este dispositivo
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="device-username">Usuário</Label>
              <Input
                id="device-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: cozinha1"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="device-password">Senha</Label>
              <div className="relative">
                <Input
                  id="device-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha do dispositivo"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!username.trim() || !password.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
