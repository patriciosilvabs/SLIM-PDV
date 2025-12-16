import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineOperation } from '@/hooks/useOfflineSupport';

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: OfflineOperation[];
  pendingCount: number;
  triggerSync: () => Promise<{ success: number; failed: number }>;
  clearQueue: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const syncState = useOfflineSync();

  // Listen for notification actions from service worker
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { type, action } = event.data || {};
      
      if (type === 'NOTIFICATION_ACTION') {
        switch (action) {
          case 'sync':
          case 'retry':
            syncState.triggerSync();
            break;
          case 'view':
            // Could navigate to sync status page
            break;
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [syncState.triggerSync]);

  return (
    <OfflineSyncContext.Provider value={syncState}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (context === undefined) {
    throw new Error('useOfflineSyncContext must be used within an OfflineSyncProvider');
  }
  return context;
}
