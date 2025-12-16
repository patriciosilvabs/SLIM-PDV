import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineSupport, OfflineOperation } from './useOfflineSupport';
import { useToast } from './use-toast';

export function useOfflineSync() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    syncOperations,
    clearQueue 
  } = useOfflineSupport();
  const { toast } = useToast();
  const syncAttemptedRef = useRef(false);

  const processSingleOperation = useCallback(async (operation: OfflineOperation): Promise<boolean> => {
    try {
      const { action, table, data } = operation;

      switch (action) {
        case 'create': {
          const { error } = await supabase
            .from(table as any)
            .insert(data);
          return !error;
        }
        case 'update': {
          const { id, ...updateData } = data;
          const { error } = await supabase
            .from(table as any)
            .update(updateData)
            .eq('id', id);
          return !error;
        }
        case 'delete': {
          const { error } = await supabase
            .from(table as any)
            .delete()
            .eq('id', data.id);
          return !error;
        }
        default:
          return false;
      }
    } catch (error) {
      console.error('Error processing offline operation:', error);
      return false;
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || pendingOperations.length === 0 || isSyncing) {
      return;
    }

    await syncOperations(processSingleOperation);
  }, [isOnline, pendingOperations.length, isSyncing, syncOperations, processSingleOperation]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0 && !syncAttemptedRef.current) {
      syncAttemptedRef.current = true;
      
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        triggerSync();
      }, 2000);

      return () => clearTimeout(timer);
    }

    if (!isOnline) {
      syncAttemptedRef.current = false;
    }
  }, [isOnline, pendingOperations.length, triggerSync]);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    triggerSync,
    clearQueue,
    pendingCount: pendingOperations.length
  };
}
