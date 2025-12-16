import React, { createContext, useContext, ReactNode } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineOperation } from '@/hooks/useOfflineSupport';

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: OfflineOperation[];
  pendingCount: number;
  triggerSync: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const syncState = useOfflineSync();

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
