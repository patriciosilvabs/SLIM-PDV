import { useCallback, useEffect, useRef } from 'react';
import { useOfflineSupport, OfflineOperation } from './useOfflineSupport';
import { useToast } from './use-toast';
import { usePushNotifications } from './usePushNotifications';
import {
  createCashMovement,
  createCustomer,
  createKdsStation,
  createOrder,
  createOrderItem,
  createPayment,
  createReservation,
  createTable,
  deleteOrderItemCascade,
  deleteTable,
  updateCustomer,
  updateKdsStation,
  updateOrderById,
  updateOrderItemById,
  updateReservation,
  updateTable,
} from '@/lib/firebaseTenantCrud';

export function useOfflineSync() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    syncOperations,
    clearQueue 
  } = useOfflineSupport();
  const { toast } = useToast();
  const {
    notifyPendingSync,
    notifySyncStarted,
    notifySyncComplete,
    notifyOfflineWithPending,
    notifyOldPendingOperations,
  } = usePushNotifications();
  
  const syncAttemptedRef = useRef(false);
  const wasOnlineRef = useRef(true);
  const oldOperationsCheckedRef = useRef(false);

  const processSingleOperation = useCallback(async (operation: OfflineOperation): Promise<boolean> => {
    try {
      const { action, table, data } = operation;
      const tenantId = data?.tenant_id;

      if (!tenantId) {
        console.warn('Offline sync skipped operation without tenant_id', operation);
        return false;
      }

      switch (action) {
        case 'create': {
          switch (table) {
            case 'orders':
              await createOrder(tenantId, data);
              return true;
            case 'order_items':
              await createOrderItem(tenantId, data);
              return true;
            case 'tables':
              await createTable(tenantId, data);
              return true;
            case 'payments':
              await createPayment(tenantId, data);
              return true;
            case 'customers':
              await createCustomer(tenantId, data);
              return true;
            case 'reservations':
              await createReservation(tenantId, data);
              return true;
            case 'cash_movements':
              await createCashMovement(tenantId, data);
              return true;
            case 'kds_stations':
              await createKdsStation(tenantId, data);
              return true;
            default:
              console.warn(`Offline sync create not implemented for table: ${table}`);
              return false;
          }
        }
        case 'update': {
          const { id, ...updateData } = data;
          if (!id) return false;

          switch (table) {
            case 'orders':
              await updateOrderById(tenantId, id, updateData);
              return true;
            case 'order_items':
              await updateOrderItemById(tenantId, id, updateData);
              return true;
            case 'tables':
              await updateTable(tenantId, id, updateData);
              return true;
            case 'customers':
              await updateCustomer(tenantId, id, updateData);
              return true;
            case 'reservations':
              await updateReservation(tenantId, id, updateData);
              return true;
            case 'kds_stations':
              await updateKdsStation(tenantId, id, updateData);
              return true;
            default:
              console.warn(`Offline sync update not implemented for table: ${table}`);
              return false;
          }
        }
        case 'delete': {
          if (!data?.id) return false;

          switch (table) {
            case 'order_items':
              await deleteOrderItemCascade(tenantId, data.id);
              return true;
            case 'tables':
              await deleteTable(tenantId, data.id);
              return true;
            default:
              console.warn(`Offline sync delete not implemented for table: ${table}`);
              return false;
          }
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
      return { success: 0, failed: 0 };
    }

    // Notify sync started
    await notifySyncStarted(pendingOperations.length);

    let successCount = 0;
    let failCount = 0;

    await syncOperations(async (operation) => {
      const result = await processSingleOperation(operation);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
      return result;
    });

    // Notify sync complete
    await notifySyncComplete(successCount, failCount);

    return { success: successCount, failed: failCount };
  }, [isOnline, pendingOperations.length, isSyncing, syncOperations, processSingleOperation, notifySyncStarted, notifySyncComplete]);

  // Notify when going offline with pending operations
  useEffect(() => {
    if (!isOnline && wasOnlineRef.current && pendingOperations.length > 0) {
      notifyOfflineWithPending(pendingOperations.length);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, pendingOperations.length, notifyOfflineWithPending]);

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

  // Check for old pending operations (>1 hour)
  useEffect(() => {
    if (pendingOperations.length === 0) {
      oldOperationsCheckedRef.current = false;
      return;
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oldOperations = pendingOperations.filter(op => op.timestamp < oneHourAgo);

    if (oldOperations.length > 0 && !oldOperationsCheckedRef.current) {
      oldOperationsCheckedRef.current = true;
      notifyOldPendingOperations(oldOperations.length);
    }
  }, [pendingOperations, notifyOldPendingOperations]);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    triggerSync,
    clearQueue,
    pendingCount: pendingOperations.length
  };
}




