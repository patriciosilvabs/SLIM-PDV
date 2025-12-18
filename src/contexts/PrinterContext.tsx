import React, { createContext, useContext, ReactNode } from 'react';
import { useQzTray, PrinterConfig, PrintDataItem } from '@/hooks/useQzTray';
import { 
  buildKitchenTicket, 
  buildCustomerReceipt, 
  buildCashDrawerCommand,
  KitchenTicketData,
  CustomerReceiptData,
  PrintFontSize,
  INIT,
  ALIGN_CENTER,
  LF
} from '@/utils/escpos';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { PrintSector } from '@/hooks/usePrintSectors';
import { imageUrlToBase64 } from '@/utils/imageToBase64';

// Interface for items with sector info for sector-based printing
export interface SectorPrintItem {
  quantity: number;
  productName: string;
  variation?: string | null;
  extras?: string[];
  notes?: string | null;
  print_sector_id?: string | null;
}

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
  printKitchenTicketsBySector: (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    sectors: PrintSector[],
    duplicate?: boolean
  ) => Promise<boolean>;
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
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');
      
      const ticketData = buildKitchenTicket(data, qz.config.paperWidth, currentKitchenFontSize, currentLineSpacing, currentLeftMargin, currentAsciiMode, currentCharSpacing, currentTopMargin, currentBottomMarginKitchen);
      await qz.printToKitchen(ticketData);
      return true;
    } catch (err) {
      console.error('Failed to print kitchen ticket:', err);
      return false;
    }
  };

  // Print kitchen tickets grouped by sector
  const printKitchenTicketsBySector = async (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    sectors: PrintSector[],
    duplicate: boolean = false
  ): Promise<boolean> => {
    try {
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');

      // Group items by sector
      const itemsBySector: Record<string, SectorPrintItem[]> = {};
      const defaultSectorId = '_default';

      for (const item of items) {
        const sectorId = item.print_sector_id || defaultSectorId;
        if (!itemsBySector[sectorId]) {
          itemsBySector[sectorId] = [];
        }
        itemsBySector[sectorId].push(item);
      }

      // Print to each sector's printer
      for (const [sectorId, sectorItems] of Object.entries(itemsBySector)) {
        let printerName: string | null = null;
        let sectorName: string | undefined = undefined;

        if (sectorId === defaultSectorId) {
          // Use default kitchen printer
          printerName = qz.config.kitchenPrinter;
          sectorName = undefined; // Will show "COZINHA" default
        } else {
          // Find sector and its printer
          const sector = sectors.find(s => s.id === sectorId);
          if (sector) {
            printerName = sector.printer_name || qz.config.kitchenPrinter;
            sectorName = sector.name;
          } else {
            printerName = qz.config.kitchenPrinter;
          }
        }

        if (!printerName) {
          console.warn(`No printer for sector ${sectorId}, skipping`);
          continue;
        }

        // Build ticket for this sector
        const ticketData: KitchenTicketData = {
          ...orderInfo,
          sectorName,
          items: sectorItems.map(item => ({
            quantity: item.quantity,
            productName: item.productName,
            variation: item.variation,
            extras: item.extras,
            notes: item.notes,
          })),
        };

        const printData = buildKitchenTicket(
          ticketData, 
          qz.config.paperWidth, 
          currentKitchenFontSize, 
          currentLineSpacing, 
          currentLeftMargin,
          currentAsciiMode,
          currentCharSpacing,
          currentTopMargin,
          currentBottomMarginKitchen
        );

        // Print to the sector's printer
        await qz.print(printerName, printData);

        // Print duplicate if enabled
        if (duplicate) {
          await qz.print(printerName, printData);
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to print kitchen tickets by sector:', err);
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
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginReceipt = parseInt(localStorage.getItem('pdv_bottom_margin_receipt') || '4');
      
      // Logo settings
      const showLogo = localStorage.getItem('pdv_print_show_logo') === 'true';
      const logoUrl = localStorage.getItem('pdv_restaurant_logo_url') || '';
      
      // Get custom messages based on order type
      const isTableOrder = data.orderType === 'dine_in';
      const customMessage = isTableOrder 
        ? localStorage.getItem('pdv_print_message_table') || 'Obrigado pela preferência!'
        : localStorage.getItem('pdv_print_message_standard') || 'Obrigado pelo seu pedido!';
      const qrCodeContent = isTableOrder
        ? localStorage.getItem('pdv_print_qr_table') || ''
        : localStorage.getItem('pdv_print_qr_standard') || '';
      
      // Check if we should print logo instead of text restaurant name
      const shouldPrintLogo = showLogo && !!logoUrl;
      
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
      
      // Build receipt text (skip restaurant name if logo will be printed)
      const receiptData = buildCustomerReceipt(
        enrichedData, 
        qz.config.paperWidth, 
        currentReceiptFontSize, 
        currentLineSpacing, 
        currentLeftMargin, 
        currentAsciiMode, 
        currentCharSpacing, 
        currentTopMargin, 
        currentBottomMarginReceipt,
        shouldPrintLogo // Skip restaurant name text when logo is enabled
      );
      
      // If logo is enabled, build mixed array with image + text
      if (shouldPrintLogo) {
        const logoBase64 = await imageUrlToBase64(logoUrl);
        
        if (logoBase64) {
          // Build print array: init + center + logo image + spacing + receipt text
          const printArray: PrintDataItem[] = [
            // Initialize and center align for logo
            INIT + ALIGN_CENTER,
            // Logo image object
            {
              type: 'raw' as const,
              format: 'image' as const,
              data: logoBase64,
              options: { language: 'ESCPOS', dotDensity: 'double' as const }
            },
            // Spacing after logo
            LF + LF,
            // Receipt text (without restaurant name)
            receiptData
          ];
          
          await qz.print(qz.config.cashierPrinter, printArray);
          return true;
        }
      }
      
      // Fallback: print text-only receipt
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
    printKitchenTicketsBySector,
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
