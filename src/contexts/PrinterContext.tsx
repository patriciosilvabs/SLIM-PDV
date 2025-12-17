import React, { createContext, useContext, ReactNode } from 'react';
import { useQzTray, PrinterConfig } from '@/hooks/useQzTray';
import { 
  buildKitchenTicket, 
  buildCustomerReceipt, 
  buildCashDrawerCommand,
  KitchenTicketData,
  CustomerReceiptData,
  PrintFontSize
} from '@/utils/escpos';
import { useOrderSettings } from '@/hooks/useOrderSettings';

interface PrinterContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Available printers
  printers: string[];
  
  // Configuration
  config: PrinterConfig;
  updateConfig: (updates: Partial<PrinterConfig>) => void;
  
  // Connection methods
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshPrinters: () => Promise<string[]>;
  
  // High-level print methods
  printKitchenTicket: (data: KitchenTicketData) => Promise<boolean>;
  printCustomerReceipt: (data: CustomerReceiptData) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;
  testPrint: (printerName: string) => Promise<boolean>;
  
  // Low-level print
  print: (printerName: string | null, data: string, isRaw?: boolean) => Promise<boolean>;
  
  // Utility
  isQzAvailable: boolean;
  canPrintToKitchen: boolean;
  canPrintToCashier: boolean;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const qz = useQzTray();
  const { printFontSize } = useOrderSettings();

  const printKitchenTicket = async (data: KitchenTicketData): Promise<boolean> => {
    if (!qz.config.kitchenPrinter) {
      console.warn('No kitchen printer configured');
      return false;
    }

    try {
      const ticketData = buildKitchenTicket(data, qz.config.paperWidth, printFontSize as PrintFontSize);
      await qz.printToKitchen(ticketData);
      return true;
    } catch (err) {
      console.error('Failed to print kitchen ticket:', err);
      return false;
    }
  };

  const printCustomerReceipt = async (data: CustomerReceiptData): Promise<boolean> => {
    if (!qz.config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const receiptData = buildCustomerReceipt(data, qz.config.paperWidth, printFontSize as PrintFontSize);
      await qz.printToCashier(receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print customer receipt:', err);
      return false;
    }
  };

  const openCashDrawer = async (): Promise<boolean> => {
    if (!qz.config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const command = buildCashDrawerCommand();
      await qz.print(qz.config.cashierPrinter, command);
      return true;
    } catch (err) {
      console.error('Failed to open cash drawer:', err);
      return false;
    }
  };

  const value: PrinterContextValue = {
    isConnected: qz.isConnected,
    isConnecting: qz.isConnecting,
    error: qz.error,
    printers: qz.printers,
    config: qz.config,
    updateConfig: qz.updateConfig,
    connect: qz.connect,
    disconnect: qz.disconnect,
    refreshPrinters: qz.refreshPrinters,
    printKitchenTicket,
    printCustomerReceipt,
    openCashDrawer,
    testPrint: qz.testPrint,
    print: qz.print,
    isQzAvailable: qz.isQzAvailable,
    canPrintToKitchen: qz.isConnected && !!qz.config.kitchenPrinter,
    canPrintToCashier: qz.isConnected && !!qz.config.cashierPrinter,
  };

  return (
    <PrinterContext.Provider value={value}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
}

// Hook for optional printer access (doesn't throw if not in provider)
export function usePrinterOptional() {
  return useContext(PrinterContext);
}
