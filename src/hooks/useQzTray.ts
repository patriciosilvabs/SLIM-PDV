import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// QZ Tray types
declare global {
  interface Window {
    qz: {
      websocket: {
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        isActive: () => boolean;
      };
      printers: {
        find: (query?: string) => Promise<string | string[]>;
        getDefault: () => Promise<string>;
      };
      print: (config: any, data: any[]) => Promise<void>;
      configs: {
        create: (printer: string | null, options?: any) => any;
      };
      api: {
        setSha256Type: (type: (data: string) => Promise<string>) => void;
        setPromiseType: (type: (resolve: () => void) => void) => void;
      };
      security: {
        setCertificatePromise: (promise: (resolve: (cert: string) => void, reject: () => void) => void) => void;
        setSignaturePromise: (promise: (toSign: string) => (resolve: (sig: string) => void, reject: (err: Error) => void) => void) => void;
        setSignatureAlgorithm: (algorithm: string) => void;
      };
    };
  }
}

// QZ Tray Certificate - Patricio Org (cardapio-offline-pos.lovable.app)
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDsTCCApmgAwIBAgIUL2TOyAvipG4lxJcoDPOzaEVx+V0wDQYJKoZIhvcNAQEL
BQAwgYAxCzAJBgNVBAYTAkJSMREwDwYDVQQIDAhBbWF6b25hczEPMA0GA1UEBwwG
TWFuYXVzMRUwEwYDVQQKDAxQYXRyaWNpbyBPcmcxCzAJBgNVBAsMAlRJMSkwJwYD
VQQDDCBjYXJkYXBpby1vZmZsaW5lLXBvcy5sb3ZhYmxlLmFwcDAeFw0yNTEyMTcy
MjA0MjhaFw0zNTEyMTUyMjA0MjhaMIGAMQswCQYDVQQGEwJCUjERMA8GA1UECAwI
QW1hem9uYXMxDzANBgNVBAcMBk1hbmF1czEVMBMGA1UECgwMUGF0cmljaW8gT3Jn
MQswCQYDVQQLDAJUSTEpMCcGA1UEAwwgY2FyZGFwaW8tb2ZmbGluZS1wb3MubG92
YWJsZS5hcHAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDw8HnQSJqv
1DURAS13MUDTe0tFUFCAu/Ga7Tv1Ym0wVthKNaKwwzUoUnUUwODSQQqhxmlnVveE
+udw1Q34LzTerHj4QG+TThvpeRO2yPnV2Orz9HLezNWy4EvtpicpnaTkuubeztY9
2CeYIamAyDEl5gNZy4xA5t99Sn0a0Lr1/T1eKgKD6U4ooWvCRpgh+DCGslTdDKW9
BbmmRX09/RePWky+zQXqPHGdlDiGThUCtbgOlv7MiCwbPr/tIcLBIrOGRWttKI7+
7SSIWJlLtayn8PIm/hxGmYAYd+m5+viaIhaS/ojR+/qxDmp/6EAPsH06tnr/hGbP
ahfVFO8v/WyLAgMBAAGjITAfMB0GA1UdDgQWBBSiomD8fAYhTWlm+qnYg+B2m+Na
XjANBgkqhkiG9w0BAQsFAAOCAQEAzZvsM6EE7HoxcypvXFgakxqvbPdvt7yK5W4N
lNbnxqE+D+x6QUhLfM5Jm3fYLUeAed+Ph+AMmqpVD32yxLEXgF9efLI/oMzoiM38
ZNMO0oLMuzR8Xvs82aBN3eMFNetGMOPNkHoJYtJUchjsr+ygt2I6QvQAaHiwE1Kj
VJFNGVDe0oph584yDwkDdPbDMlsEbDBOqjSPFQ3KNH7Xane+x1xWdWac7VUQryfL
PaZBU+2zZLU5SWrl9keysLTgMNq/9ib6c+6c3rAfEgIckRKxm65qaf9l64ynxKO4
+UGca9q3m0bOI6ybyUNG4pNuW7XfhiVroYbEhyG3GttBwhgM4Q==
-----END CERTIFICATE-----`;

// Edge function URL for signing
const QZ_SIGN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qz-sign`;

export interface PrinterConfig {
  kitchenPrinter: string | null;
  cashierPrinter: string | null;
  paperWidth: '58mm' | '80mm';
}

const DEFAULT_CONFIG: PrinterConfig = {
  kitchenPrinter: null,
  cashierPrinter: null,
  paperWidth: '80mm',
};

const STORAGE_KEY = 'pdv_printer_config';

export function useQzTray() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PrinterConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  
  const qzLoadedRef = useRef(false);
  const connectAttemptedRef = useRef(false);

  // Load QZ Tray script
  useEffect(() => {
    if (qzLoadedRef.current) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    script.async = true;
    script.onload = () => {
      qzLoadedRef.current = true;
      // Auto-connect on load if QZ is available
      if (window.qz && !connectAttemptedRef.current) {
        connectAttemptedRef.current = true;
        // Small delay to ensure qz is fully initialized
        setTimeout(() => {
          connect().catch(console.error);
        }, 500);
      }
    };
    script.onerror = () => {
      setError('Falha ao carregar QZ Tray. Verifique sua conexão.');
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup to avoid reloading
    };
  }, []);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const connect = useCallback(async () => {
    if (!window.qz) {
      setError('QZ Tray não está carregado. Recarregue a página.');
      return false;
    }

    if (window.qz.websocket.isActive()) {
      setIsConnected(true);
      return true;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Configure QZ security with certificate
      window.qz.security.setCertificatePromise((resolve, reject) => {
        if (QZ_CERTIFICATE.includes('PASTE_YOUR_CERTIFICATE_HERE')) {
          // Fallback to unsigned if certificate not configured
          console.warn('QZ Certificate not configured, using unsigned mode');
          resolve('');
        } else {
          resolve(QZ_CERTIFICATE);
        }
      });
      
      // Set signature algorithm
      window.qz.security.setSignatureAlgorithm('SHA512');
      
      // Configure signature promise to call Edge Function
      window.qz.security.setSignaturePromise((toSign: string) => {
        return async (resolve: (sig: string) => void, reject: (err: Error) => void) => {
          if (QZ_CERTIFICATE.includes('PASTE_YOUR_CERTIFICATE_HERE')) {
            // Unsigned mode
            resolve('');
            return;
          }
          
          try {
            // Get current session for authorization
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              throw new Error('User not authenticated');
            }
            
            const response = await fetch(QZ_SIGN_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ data: toSign }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to sign');
            }
            
            const { signature } = await response.json();
            resolve(signature);
          } catch (err: any) {
            console.error('Error signing QZ request:', err);
            reject(err);
          }
        };
      });

      await window.qz.websocket.connect();
      setIsConnected(true);
      
      // Fetch available printers
      const availablePrinters = await window.qz.printers.find();
      setPrinters(Array.isArray(availablePrinters) ? availablePrinters : [availablePrinters]);
      
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes('Unable to establish')) {
        setError('QZ Tray não está em execução. Baixe e instale em qz.io');
      } else if (errorMessage.includes('Already connected')) {
        setIsConnected(true);
        return true;
      } else {
        setError(`Erro ao conectar: ${errorMessage}`);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!window.qz || !window.qz.websocket.isActive()) {
      setIsConnected(false);
      return;
    }

    try {
      await window.qz.websocket.disconnect();
      setIsConnected(false);
      setPrinters([]);
    } catch (err: any) {
      console.error('Error disconnecting:', err);
    }
  }, []);

  const refreshPrinters = useCallback(async () => {
    if (!window.qz || !isConnected) {
      setError('Não conectado ao QZ Tray');
      return [];
    }

    try {
      const availablePrinters = await window.qz.printers.find();
      const printerList = Array.isArray(availablePrinters) ? availablePrinters : [availablePrinters];
      setPrinters(printerList);
      return printerList;
    } catch (err: any) {
      setError(`Erro ao listar impressoras: ${err?.message || String(err)}`);
      return [];
    }
  }, [isConnected]);

  const print = useCallback(async (printerName: string | null, data: string, isRaw = true) => {
    if (!window.qz) {
      throw new Error('QZ Tray não está carregado');
    }

    if (!isConnected) {
      const connected = await connect();
      if (!connected) {
        throw new Error('Não foi possível conectar ao QZ Tray');
      }
    }

    if (!printerName) {
      throw new Error('Nenhuma impressora selecionada');
    }

    try {
      const printerConfig = window.qz.configs.create(printerName, {
        encoding: 'UTF-8',
      });

      const printData = isRaw 
        ? [{ type: 'raw', format: 'plain', data }]
        : [{ type: 'html', format: 'plain', data }];

      await window.qz.print(printerConfig, printData);
      return true;
    } catch (err: any) {
      throw new Error(`Erro ao imprimir: ${err?.message || String(err)}`);
    }
  }, [isConnected, connect]);

  const printToKitchen = useCallback(async (data: string) => {
    return print(config.kitchenPrinter, data);
  }, [print, config.kitchenPrinter]);

  const printToCashier = useCallback(async (data: string) => {
    return print(config.cashierPrinter, data);
  }, [print, config.cashierPrinter]);

  const openCashDrawer = useCallback(async () => {
    const printer = config.cashierPrinter;
    if (!printer) {
      throw new Error('Nenhuma impressora de caixa configurada');
    }
    
    // ESC/POS command to open cash drawer
    const drawerCommand = '\x1B\x70\x00\x19\xFA';
    return print(printer, drawerCommand);
  }, [print, config.cashierPrinter]);

  const updateConfig = useCallback((updates: Partial<PrinterConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const testPrint = useCallback(async (printerName: string) => {
    const testData = [
      '\x1B@', // Initialize
      '\x1Ba\x01', // Center align
      '\x1B!\x30', // Double size
      'TESTE DE IMPRESSAO\n',
      '\x1B!\x00', // Normal size
      '\n',
      'Se voce consegue ler isso,\n',
      'a impressora esta funcionando!\n',
      '\n',
      `Data: ${new Date().toLocaleString('pt-BR')}\n`,
      '\n\n\n',
      '\x1DVA\x03', // Cut paper
    ].join('');

    return print(printerName, testData);
  }, [print]);

  return {
    isConnected,
    isConnecting,
    printers,
    error,
    config,
    connect,
    disconnect,
    refreshPrinters,
    print,
    printToKitchen,
    printToCashier,
    openCashDrawer,
    updateConfig,
    testPrint,
    isQzAvailable: qzLoadedRef.current && !!window.qz,
  };
}
