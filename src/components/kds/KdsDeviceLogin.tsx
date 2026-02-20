import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tablet, LogIn, Loader2, Home } from 'lucide-react';
import logoSlim from '@/assets/logo-slim.png';

interface KdsDeviceLoginProps {
  onLoginSuccess: (device: any) => void;
}

const DEVICE_AUTH_KEY = 'kds_device_auth';

export function getStoredDeviceAuth(): { deviceId: string; deviceName: string; stationId: string | null; tenantId: string | null } | null {
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
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6 || authCode.length !== 6) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kds-device-auth', {
        body: {
          action: 'login_by_codes',
          verification_code: verificationCode,
          auth_code: authCode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const device = data.device;
      
      const authData = {
        deviceId: device.device_id,
        deviceName: device.name,
        stationId: device.station_id,
        tenantId: device.tenant_id || null,
      };
      localStorage.setItem(DEVICE_AUTH_KEY, JSON.stringify(authData));
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
            Insira os códigos fornecidos pelo administrador
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label>Código Verificador</Label>
              <p className="text-xs text-muted-foreground">Vincula o dispositivo à conta</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Código de Autenticação</Label>
              <p className="text-xs text-muted-foreground">Faz login no dispositivo</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={authCode} onChange={setAuthCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={verificationCode.length !== 6 || authCode.length !== 6 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate('/')}
            >
              <Home className="h-4 w-4" />
              Voltar para Home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
