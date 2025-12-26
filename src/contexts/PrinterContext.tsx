// PrinterContext - Provides printer functionality throughout the app
import React, { createContext, useContext, ReactNode } from 'react';
import { useQzTray, PrinterConfig, PrintDataItem, QzConnectionStatus } from '@/hooks/useQzTray';
import { 
  buildKitchenTicket, 
  buildCustomerReceipt, 
  buildCashDrawerCommand,
  buildCancellationTicket,
  buildPartialPaymentReceipt,
  KitchenTicketData,
  CustomerReceiptData,
  CancellationTicketData,
  PartialPaymentReceiptData,
  PrintFontSize,
  INIT,
  ALIGN_CENTER,
  LF
} from '@/utils/escpos';

import { PrintSector } from '@/hooks/usePrintSectors';
import { imageUrlToBase64Cached, extractBase64Data, resizeImage, convertToGrayscale, convertToDithered } from '@/utils/imageToBase64';

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
  waitingForAuth: boolean;
  connectionStatus: QzConnectionStatus;
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
  printPartialPaymentReceipt: (data: PartialPaymentReceiptData) => Promise<boolean>;
  printCancellationTicket: (data: CancellationTicketData) => Promise<boolean>;
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
      const logoMaxWidth = parseInt(localStorage.getItem('pdv_logo_max_width') || '300');
      
      // Debug: Log logo settings
      console.log('🖨️ [CustomerReceipt] Logo settings:', { showLogo, logoUrl: logoUrl ? `${logoUrl.substring(0, 50)}...` : '(empty)', logoMaxWidth });
      
      // Get custom messages based on order type
      const isTableOrder = data.orderType === 'dine_in';
      const customMessage = isTableOrder 
        ? localStorage.getItem('pdv_print_message_table') || 'Obrigado pela preferência!'
        : localStorage.getItem('pdv_print_message_standard') || 'Obrigado pelo seu pedido!';
      const qrCodeContent = isTableOrder
        ? localStorage.getItem('pdv_print_qr_table') || ''
        : localStorage.getItem('pdv_print_qr_standard') || '';
      const qrCodeSize = parseInt(localStorage.getItem('pdv_qr_code_size') || '5');
      
      // Check if we should print logo instead of text restaurant name
      const shouldPrintLogo = showLogo && !!logoUrl;
      console.log('🖨️ [CustomerReceipt] shouldPrintLogo:', shouldPrintLogo);
      
      // Merge restaurant info into data
      const enrichedData: CustomerReceiptData = {
        ...data,
        restaurantName: currentRestaurantName,
        restaurantAddress: currentRestaurantAddress || undefined,
        restaurantPhone: currentRestaurantPhone || undefined,
        restaurantCnpj: currentRestaurantCnpj || undefined,
        customMessage: customMessage || undefined,
        qrCodeContent: qrCodeContent || undefined,
        qrCodeSize,
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
        console.log('🖼️ [CustomerReceipt] Tentando carregar logo...');
        const logoBase64 = await imageUrlToBase64Cached(logoUrl);
        
        if (logoBase64) {
          console.log('✅ [CustomerReceipt] Logo carregado! Tamanho base64:', logoBase64.length);
          // Resize image to configured max width before sending to printer
          let resizedLogo = await resizeImage(logoBase64, logoMaxWidth);
          console.log('✅ [CustomerReceipt] Logo redimensionado');
          
          // Apply color mode conversion (grayscale or dithering)
          const currentLogoPrintMode = localStorage.getItem('pdv_logo_print_mode') || 'original';
          if (currentLogoPrintMode === 'grayscale') {
            resizedLogo = await convertToGrayscale(resizedLogo);
            console.log('✅ [CustomerReceipt] Convertido para escala de cinza');
          } else if (currentLogoPrintMode === 'dithered') {
            resizedLogo = await convertToDithered(resizedLogo);
            console.log('✅ [CustomerReceipt] Convertido com dithering');
          }
          
          const pureBase64 = extractBase64Data(resizedLogo);
          console.log('🖨️ [CustomerReceipt] Enviando para impressora com logo...');
          
          // Build print array: init + center + logo image + spacing + receipt text
          const printArray: PrintDataItem[] = [
            // Initialize and center align for logo
            INIT + ALIGN_CENTER,
            // Logo image object - using flavor: 'base64' and pure base64 data
            {
              type: 'raw',
              format: 'image',
              flavor: 'base64',
              data: pureBase64,
              options: {
                language: 'ESCPOS',
                dotDensity: 'double'
              }
            },
            // Spacing after logo
            LF + LF,
            // Receipt text (without restaurant name)
            receiptData
          ];
          
          await qz.print(qz.config.cashierPrinter, printArray);
          console.log('✅ [CustomerReceipt] Impresso com logo!');
          return true;
        } else {
          console.warn('⚠️ [CustomerReceipt] Falha ao carregar logo, imprimindo sem logo');
        }
      } else {
        console.log('ℹ️ [CustomerReceipt] Logo desabilitado ou URL vazia, imprimindo sem logo');
      }
      
      // Fallback: print text-only receipt
      await qz.printToCashier(receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print customer receipt:', err);
      return false;
    }
  };

  const printCancellationTicket = async (data: CancellationTicketData): Promise<boolean> => {
    if (!qz.config.kitchenPrinter) {
      console.warn('No kitchen printer configured for cancellation ticket');
      return false;
    }

    try {
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');
      
      const ticketData = buildCancellationTicket(
        data, 
        qz.config.paperWidth, 
        currentKitchenFontSize, 
        currentLineSpacing, 
        currentLeftMargin, 
        currentAsciiMode, 
        currentCharSpacing, 
        currentTopMargin, 
        currentBottomMarginKitchen
      );
      await qz.printToKitchen(ticketData);
      return true;
    } catch (err) {
      console.error('Failed to print cancellation ticket:', err);
      return false;
    }
  };

  const printPartialPaymentReceipt = async (data: PartialPaymentReceiptData): Promise<boolean> => {
    if (!qz.config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const currentReceiptFontSize = (localStorage.getItem('pdv_receipt_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginReceipt = parseInt(localStorage.getItem('pdv_bottom_margin_receipt') || '4');
      
      // Restaurant info
      const currentRestaurantName = localStorage.getItem('pdv_restaurant_name') || 'Minha Pizzaria';
      const currentRestaurantAddress = localStorage.getItem('pdv_restaurant_address') || '';
      const currentRestaurantPhone = localStorage.getItem('pdv_restaurant_phone') || '';
      const currentRestaurantCnpj = localStorage.getItem('pdv_restaurant_cnpj') || '';
      
      // Logo settings
      const showLogo = localStorage.getItem('pdv_print_show_logo') === 'true';
      const logoUrl = localStorage.getItem('pdv_restaurant_logo_url') || '';
      const logoMaxWidth = parseInt(localStorage.getItem('pdv_logo_max_width') || '300');
      
      // Debug: Log logo settings
      console.log('🖨️ [PartialPayment] Logo settings:', { showLogo, logoUrl: logoUrl ? `${logoUrl.substring(0, 50)}...` : '(empty)', logoMaxWidth });
      
      const shouldPrintLogo = showLogo && !!logoUrl;
      console.log('🖨️ [PartialPayment] shouldPrintLogo:', shouldPrintLogo);
      
      // Enrich data with restaurant info
      const enrichedData: PartialPaymentReceiptData = {
        ...data,
        restaurantName: currentRestaurantName,
        restaurantAddress: currentRestaurantAddress || undefined,
        restaurantPhone: currentRestaurantPhone || undefined,
        restaurantCnpj: currentRestaurantCnpj || undefined,
      };
      
      const receiptData = buildPartialPaymentReceipt(
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
        console.log('🖼️ [PartialPayment] Tentando carregar logo...');
        const logoBase64 = await imageUrlToBase64Cached(logoUrl);
        
        if (logoBase64) {
          console.log('✅ [PartialPayment] Logo carregado! Tamanho base64:', logoBase64.length);
          // Resize image to configured max width
          let resizedLogo = await resizeImage(logoBase64, logoMaxWidth);
          console.log('✅ [PartialPayment] Logo redimensionado');
          
          // Apply color mode conversion
          const currentLogoPrintMode = localStorage.getItem('pdv_logo_print_mode') || 'original';
          if (currentLogoPrintMode === 'grayscale') {
            resizedLogo = await convertToGrayscale(resizedLogo);
            console.log('✅ [PartialPayment] Convertido para escala de cinza');
          } else if (currentLogoPrintMode === 'dithered') {
            resizedLogo = await convertToDithered(resizedLogo);
            console.log('✅ [PartialPayment] Convertido com dithering');
          }
          
          const pureBase64 = extractBase64Data(resizedLogo);
          console.log('🖨️ [PartialPayment] Enviando para impressora com logo...');
          
          // Build print array: init + center + logo image + spacing + receipt text
          const printArray: PrintDataItem[] = [
            INIT + ALIGN_CENTER,
            {
              type: 'raw',
              format: 'image',
              flavor: 'base64',
              data: pureBase64,
              options: {
                language: 'ESCPOS',
                dotDensity: 'double'
              }
            },
            LF + LF,
            receiptData
          ];
          
          await qz.print(qz.config.cashierPrinter, printArray);
          console.log('✅ [PartialPayment] Impresso com logo!');
          return true;
        } else {
          console.warn('⚠️ [PartialPayment] Falha ao carregar logo, imprimindo sem logo');
        }
      } else {
        console.log('ℹ️ [PartialPayment] Logo desabilitado ou URL vazia, imprimindo sem logo');
      }
      
      // Fallback: print text-only receipt
      await qz.printToCashier(receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print partial payment receipt:', err);
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
    waitingForAuth: qz.waitingForAuth,
    connectionStatus: qz.connectionStatus,
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
    printPartialPaymentReceipt,
    printCancellationTicket,
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
