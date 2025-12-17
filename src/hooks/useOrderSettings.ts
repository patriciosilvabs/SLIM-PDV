import { useState, useEffect } from 'react';

const DUPLICATE_ITEMS_KEY = 'pdv_duplicate_items';
const AUTO_PRINT_KITCHEN_KEY = 'pdv_auto_print_kitchen';
const AUTO_PRINT_RECEIPT_KEY = 'pdv_auto_print_receipt';
const PRINT_FONT_SIZE_KEY = 'pdv_print_font_size';

export type PrintFontSize = 'normal' | 'large' | 'extra_large';

export function useOrderSettings() {
  const [duplicateItems, setDuplicateItems] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DUPLICATE_ITEMS_KEY) === 'true';
  });

  const [autoPrintKitchenTicket, setAutoPrintKitchenTicket] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(AUTO_PRINT_KITCHEN_KEY) === 'true';
  });

  const [autoPrintCustomerReceipt, setAutoPrintCustomerReceipt] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(AUTO_PRINT_RECEIPT_KEY) === 'true';
  });

  const [printFontSize, setPrintFontSize] = useState<PrintFontSize>(() => {
    if (typeof window === 'undefined') return 'normal';
    return (localStorage.getItem(PRINT_FONT_SIZE_KEY) as PrintFontSize) || 'normal';
  });

  const toggleDuplicateItems = (value: boolean) => {
    localStorage.setItem(DUPLICATE_ITEMS_KEY, String(value));
    setDuplicateItems(value);
  };

  const toggleAutoPrintKitchenTicket = (value: boolean) => {
    localStorage.setItem(AUTO_PRINT_KITCHEN_KEY, String(value));
    setAutoPrintKitchenTicket(value);
  };

  const toggleAutoPrintCustomerReceipt = (value: boolean) => {
    localStorage.setItem(AUTO_PRINT_RECEIPT_KEY, String(value));
    setAutoPrintCustomerReceipt(value);
  };

  const updatePrintFontSize = (value: PrintFontSize) => {
    localStorage.setItem(PRINT_FONT_SIZE_KEY, value);
    setPrintFontSize(value);
  };

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DUPLICATE_ITEMS_KEY) {
        setDuplicateItems(e.newValue === 'true');
      }
      if (e.key === AUTO_PRINT_KITCHEN_KEY) {
        setAutoPrintKitchenTicket(e.newValue === 'true');
      }
      if (e.key === AUTO_PRINT_RECEIPT_KEY) {
        setAutoPrintCustomerReceipt(e.newValue === 'true');
      }
      if (e.key === PRINT_FONT_SIZE_KEY) {
        setPrintFontSize((e.newValue as PrintFontSize) || 'normal');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { 
    duplicateItems, 
    toggleDuplicateItems,
    autoPrintKitchenTicket,
    toggleAutoPrintKitchenTicket,
    autoPrintCustomerReceipt,
    toggleAutoPrintCustomerReceipt,
    printFontSize,
    updatePrintFontSize
  };
}
