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
  // We still use this for UI display, but read from localStorage at print time
  useOrderSettings();

  const printKitchenTicket = async (data: KitchenTicketData): Promise<boolean> => {
    if (!qz.config.kitchenPrinter) {
      console.warn('No kitchen printer configured');
      return false;
    }

    try {
      // Read from localStorage at print time to ensure latest value
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      
      const ticketData = buildKitchenTicket(data, qz.config.paperWidth, currentKitchenFontSize, currentLineSpacing, currentLeftMargin);
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
      // Read from localStorage at print time to ensure latest value
      const currentReceiptFontSize = (localStorage.getItem('pdv_receipt_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRestaurantName = localStorage.getItem('pdv_restaurant_name') || 'Minha Pizzaria';
      const currentRestaurantAddress = localStorage.getItem('pdv_restaurant_address') || '';
      const currentRestaurantPhone = localStorage.getItem('pdv_restaurant_phone') || '';
      const currentRestaurantCnpj = localStorage.getItem('pdv_restaurant_cnpj') || '';
      
      // Get custom messages based on order type
      const isTableOrder = data.orderType === 'dine_in';
      const customMessage = isTableOrder 
        ? localStorage.getItem('pdv_print_message_table') || 'Obrigado pela preferência!'
        : localStorage.getItem('pdv_print_message_standard') || 'Obrigado pelo seu pedido!';
      const qrCodeContent = isTableOrder
        ? localStorage.getItem('pdv_print_qr_table') || ''
        : localStorage.getItem('pdv_print_qr_standard') || '';
      
      // Merge restaurant info into data
      const enrichedData: CustomerReceiptData = {
        ...data,
        restaurantName: currentRestaurantName,
        restaurantAddress: currentRestaurantAddress || undefined,
        restaurantPhone: currentRestaurantPhone || undefined,
        restaurantCnpj: currentRestaurantCnpj || undefined,
        customMessage: customMessage || undefined,
        qrCodeContent: qrCodeContent || undefined,
      };
      
      const receiptData = buildCustomerReceipt(enrichedData, qz.config.paperWidth, currentReceiptFontSize, currentLineSpacing, currentLeftMargin);
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
