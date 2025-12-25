import { usePrinter, SectorPrintItem } from '@/contexts/PrinterContext';
import { usePrintQueue } from '@/hooks/usePrintQueue';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { KitchenTicketData, CustomerReceiptData, CancellationTicketData } from '@/utils/escpos';
import { useCallback } from 'react';

/**
 * Hook that provides unified printing functions.
 * If this device is NOT the print server and a print server exists,
 * it will queue jobs for centralized printing.
 * Otherwise, it prints directly.
 */
export function useCentralizedPrinting() {
  const printer = usePrinter();
  const { addPrintJob } = usePrintQueue();
  const { data: printSectors } = usePrintSectors();

  const isPrintServer = localStorage.getItem('is_print_server') === 'true';
  const usePrintQueue_ = localStorage.getItem('use_print_queue') === 'true';

  // Should we queue instead of printing directly?
  const shouldQueue = usePrintQueue_ && !isPrintServer;

  const printKitchenTicket = useCallback(async (ticketData: KitchenTicketData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'kitchen_ticket',
          data: ticketData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue kitchen ticket:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen) {
      return printer.printKitchenTicket(ticketData);
    }
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  const printKitchenTicketsBySector = useCallback(async (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    duplicate: boolean = false
  ): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'kitchen_ticket_sector',
          data: {
            items,
            orderInfo,
            duplicate,
          } as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue sector tickets:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen && printSectors) {
      const activeSectors = printSectors.filter(s => s?.is_active !== false && s?.printer_name);
      return printer.printKitchenTicketsBySector(items, orderInfo, activeSectors, duplicate);
    }
    return false;
  }, [shouldQueue, addPrintJob, printer, printSectors]);

  const printCustomerReceipt = useCallback(async (receiptData: CustomerReceiptData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'customer_receipt',
          data: receiptData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue customer receipt:', err);
        return false;
      }
    } else if (printer?.canPrintToCashier) {
      return printer.printCustomerReceipt(receiptData);
    }
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  const printCancellationTicket = useCallback(async (ticketData: CancellationTicketData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'cancellation_ticket',
          data: ticketData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue cancellation ticket:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen) {
      return printer.printCancellationTicket(ticketData);
    }
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  return {
    // Unified print functions
    printKitchenTicket,
    printKitchenTicketsBySector,
    printCustomerReceipt,
    printCancellationTicket,
    // State
    isPrintServer,
    shouldQueue,
    canPrintToKitchen: shouldQueue || printer?.canPrintToKitchen,
    canPrintToCashier: shouldQueue || printer?.canPrintToCashier,
    // Direct printer access (for UI status)
    printer,
  };
}
