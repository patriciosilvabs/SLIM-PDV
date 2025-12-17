import { useState, useEffect } from 'react';

const DUPLICATE_ITEMS_KEY = 'pdv_duplicate_items';
const AUTO_PRINT_KITCHEN_KEY = 'pdv_auto_print_kitchen';
const AUTO_PRINT_RECEIPT_KEY = 'pdv_auto_print_receipt';

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
    toggleAutoPrintCustomerReceipt
  };
}
