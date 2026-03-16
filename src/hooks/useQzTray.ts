import { useState, useEffect, useCallback, useRef } from 'react';
import { backendClient } from '@/integrations/backend/client';
import { getFirebaseFunctionUrl } from '@/integrations/firebase/client';
import { usePersistentSettings } from './usePersistentSettings';

// QZ Tray connection status
export type QzConnectionStatus = 'disconnected' | 'waiting_auth' | 'connecting' | 'connected';

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

// Cloud function URL for signing
const QZ_SIGN_URL = getFirebaseFunctionUrl('qz-sign');
const QZ_CERTIFICATE_URL = `${import.meta.env.BASE_URL}qz/digital-certificate.txt`;
const QZ_AUTO_CONNECT_PREFERENCE_KEY = 'pdv_qz_auto_connect_preference';
let qzCertificatePromise: Promise<string> | null = null;

async function loadQzCertificate(): Promise<string> {
  if (!qzCertificatePromise) {
    qzCertificatePromise = fetch(QZ_CERTIFICATE_URL, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Falha ao carregar o certificado QZ (${response.status})`);
        }

        const certificate = (await response.text()).trim();
        if (!certificate.includes('BEGIN CERTIFICATE')) {
          throw new Error('O certificado QZ publicado esta invalido');
        }

        return certificate;
      })
      .catch((error) => {
        qzCertificatePromise = null;
        throw error;
      });
  }

  return qzCertificatePromise;
}

export interface PrinterConfig {
  kitchenPrinter: string | null;
  cashierPrinter: string | null;
  paperWidth: '58mm' | '80mm';
  autoConnectOnLogin: boolean;
}

// Type for mixed print data (strings or image objects)
export type PrintDataItem = string | {
  type: 'raw';
  format: 'image' | 'base64' | 'command';
  flavor?: 'base64' | 'file' | 'plain';
  data: string;
  options?: {
    language?: string;
    dotDensity?: 'single' | 'double';
  };
};

const DEFAULT_CONFIG: PrinterConfig = {
  kitchenPrinter: null,
  cashierPrinter: null,
  paperWidth: '80mm',
  autoConnectOnLogin: true,
};

export function useQzTray() {
  // Usar persistência no banco de dados para configurações de impressora
  const { 
    settings: config, 
    updateSettings: updateConfigDb, 
    isLoading: isLoadingConfig 
  } = usePersistentSettings<PrinterConfig>({
    settingsKey: 'printer_config',
    defaults: DEFAULT_CONFIG,
    localStorageKey: 'pdv_printer_config',
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const qzLoadedRef = useRef(false);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const [isQzReady, setIsQzReady] = useState(() => typeof window !== 'undefined' && !!window.qz);

  // Get connection status for UI
  const connectionStatus: QzConnectionStatus = isConnected 
    ? 'connected' 
    : isConnecting 
      ? 'connecting' 
      : waitingForAuth 
        ? 'waiting_auth' 
        : 'disconnected';

  // Load QZ Tray script
  useEffect(() => {
    if (qzLoadedRef.current) return;

    if (window.qz) {
      qzLoadedRef.current = true;
      setIsQzReady(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    script.async = true;
    script.onload = () => {
      qzLoadedRef.current = true;
      setIsQzReady(true);
    };
    script.onerror = () => {
      setError('Falha ao carregar QZ Tray. Verifique sua conexão.');
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup to avoid reloading
    };
  }, []);

  useEffect(() => {
    if (isLoadingConfig || config.autoConnectOnLogin) {
      return;
    }

    const hasConfiguredPrinter = Boolean(config.kitchenPrinter || config.cashierPrinter);
    const hasManualPreference = localStorage.getItem(QZ_AUTO_CONNECT_PREFERENCE_KEY) === 'manual';

    if (!hasConfiguredPrinter || hasManualPreference) {
      return;
    }

    updateConfigDb({ autoConnectOnLogin: true });
  }, [
    config.autoConnectOnLogin,
    config.cashierPrinter,
    config.kitchenPrinter,
    isLoadingConfig,
    updateConfigDb,
  ]);


  const connect = useCallback(async () => {
    if (!window.qz) {
      setError('QZ Tray não está carregado. Recarregue a página.');
      return false;
    }

    if (window.qz.websocket.isActive()) {
      setIsConnected(true);
      setWaitingForAuth(false);

      try {
        const availablePrinters = await window.qz.printers.find();
        setPrinters(Array.isArray(availablePrinters) ? availablePrinters : [availablePrinters]);
      } catch (err) {
        console.warn('Unable to refresh printers from existing QZ connection:', err);
      }

      return true;
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    const connectPromise = (async () => {
      setIsConnecting(true);
      setError(null);

      try {
      const certificate = await loadQzCertificate();

      // Configure QZ security with certificate
      window.qz.security.setCertificatePromise((resolve) => {
        resolve(certificate);
      });
      
      // Set signature algorithm
      window.qz.security.setSignatureAlgorithm('SHA512');
      
      // Configure signature promise to call Edge Function
      window.qz.security.setSignaturePromise((toSign: string) => {
        return async (resolve: (sig: string) => void, reject: (err: Error) => void) => {
          try {
            // Get current session for authorization
            const { data: { session } } = await backendClient.auth.getSession();
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
      setWaitingForAuth(false);
      
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
        setWaitingForAuth(false);
        return true;
      } else {
        setError(`Erro ao conectar: ${errorMessage}`);
      }
        return false;
      } finally {
        setIsConnecting(false);
        connectPromiseRef.current = null;
      }
    })();

    connectPromiseRef.current = connectPromise;
    return connectPromise;
  }, []);

  useEffect(() => {
    if (isLoadingConfig || !config.autoConnectOnLogin || !isQzReady || isConnected || isConnecting) {
      return;
    }

    let cancelled = false;

    const tryAutoConnect = async () => {
      const { data: { session } } = await backendClient.auth.getSession();
      if (cancelled) {
        return;
      }

      if (!session?.access_token) {
        setWaitingForAuth(true);
        return;
      }

      await connect();
    };

    void tryAutoConnect();

    return () => {
      cancelled = true;
    };
  }, [
    config.autoConnectOnLogin,
    connect,
    isConnected,
    isConnecting,
    isLoadingConfig,
    isQzReady,
  ]);

  useEffect(() => {
    if (!config.autoConnectOnLogin || !isQzReady) {
      return;
    }

    const reconnectWhenVisible = async () => {
      if (document.visibilityState !== 'visible' || isConnected || isConnecting) {
        return;
      }

      const { data: { session } } = await backendClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      await connect();
    };

    const handleVisibilityChange = () => {
      void reconnectWhenVisible();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [config.autoConnectOnLogin, connect, isConnected, isConnecting, isQzReady]);

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

  // Listen for auth state changes to keep local status in sync
  useEffect(() => {
    const { data: { subscription } } = backendClient.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.access_token) {
          setWaitingForAuth(false);
          if (config.autoConnectOnLogin && isQzReady) {
            void connect();
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          setWaitingForAuth(false);
          if (config.autoConnectOnLogin && isQzReady && !isConnected && !isConnecting) {
            void connect();
          }
        } else if (event === 'SIGNED_OUT') {
          setWaitingForAuth(false);
          disconnect().catch(console.error);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [
    config.autoConnectOnLogin,
    connect,
    disconnect,
    isConnected,
    isConnecting,
    isQzReady,
  ]);

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

  const print = useCallback(async (
    printerName: string | null, 
    data: string | PrintDataItem[], 
    isRaw = true
  ) => {
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

      // Handle mixed array of strings and image objects
      let printData: any[];
      
      if (Array.isArray(data)) {
        printData = data.map(item => 
          typeof item === 'string' 
            ? { type: 'raw', format: 'command', data: item }
            : item
        );
      } else {
        printData = isRaw 
          ? [{ type: 'raw', format: 'command', data }]
          : [{ type: 'html', format: 'plain', data }];
      }

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
    if (typeof updates.autoConnectOnLogin === 'boolean') {
      localStorage.setItem(QZ_AUTO_CONNECT_PREFERENCE_KEY, 'manual');
    }

    updateConfigDb(updates);
  }, [updateConfigDb]);

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
    waitingForAuth,
    connectionStatus,
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
    isQzAvailable: isQzReady && !!window.qz,
  };
}



