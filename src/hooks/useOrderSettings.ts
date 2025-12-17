import { useState, useEffect } from 'react';

const DUPLICATE_ITEMS_KEY = 'pdv_duplicate_items';
const AUTO_PRINT_KITCHEN_KEY = 'pdv_auto_print_kitchen';
const AUTO_PRINT_RECEIPT_KEY = 'pdv_auto_print_receipt';
const KITCHEN_FONT_SIZE_KEY = 'pdv_kitchen_font_size';
const RECEIPT_FONT_SIZE_KEY = 'pdv_receipt_font_size';
const LINE_SPACING_KEY = 'pdv_line_spacing';
const LEFT_MARGIN_KEY = 'pdv_left_margin';
const RESTAURANT_NAME_KEY = 'pdv_restaurant_name';
const RESTAURANT_ADDRESS_KEY = 'pdv_restaurant_address';
const RESTAURANT_PHONE_KEY = 'pdv_restaurant_phone';
const DUPLICATE_KITCHEN_TICKET_KEY = 'pdv_duplicate_kitchen_ticket';

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

  const [kitchenFontSize, setKitchenFontSize] = useState<PrintFontSize>(() => {
    if (typeof window === 'undefined') return 'normal';
    return (localStorage.getItem(KITCHEN_FONT_SIZE_KEY) as PrintFontSize) || 'normal';
  });

  const [receiptFontSize, setReceiptFontSize] = useState<PrintFontSize>(() => {
    if (typeof window === 'undefined') return 'normal';
    return (localStorage.getItem(RECEIPT_FONT_SIZE_KEY) as PrintFontSize) || 'normal';
  });

  const [lineSpacing, setLineSpacing] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(LINE_SPACING_KEY) || '0');
  });

  const [leftMargin, setLeftMargin] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(LEFT_MARGIN_KEY) || '0');
  });

  const [restaurantName, setRestaurantName] = useState(() => {
    if (typeof window === 'undefined') return 'Minha Pizzaria';
    return localStorage.getItem(RESTAURANT_NAME_KEY) || 'Minha Pizzaria';
  });

  const [restaurantAddress, setRestaurantAddress] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_ADDRESS_KEY) || '';
  });

  const [restaurantPhone, setRestaurantPhone] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_PHONE_KEY) || '';
  });

  const [duplicateKitchenTicket, setDuplicateKitchenTicket] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DUPLICATE_KITCHEN_TICKET_KEY) === 'true';
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

  const updateKitchenFontSize = (value: PrintFontSize) => {
    localStorage.setItem(KITCHEN_FONT_SIZE_KEY, value);
    setKitchenFontSize(value);
  };

  const updateReceiptFontSize = (value: PrintFontSize) => {
    localStorage.setItem(RECEIPT_FONT_SIZE_KEY, value);
    setReceiptFontSize(value);
  };

  const updateLineSpacing = (value: number) => {
    localStorage.setItem(LINE_SPACING_KEY, String(value));
    setLineSpacing(value);
  };

  const updateLeftMargin = (value: number) => {
    localStorage.setItem(LEFT_MARGIN_KEY, String(value));
    setLeftMargin(value);
  };

  const updateRestaurantName = (value: string) => {
    localStorage.setItem(RESTAURANT_NAME_KEY, value);
    setRestaurantName(value);
  };

  const updateRestaurantAddress = (value: string) => {
    localStorage.setItem(RESTAURANT_ADDRESS_KEY, value);
    setRestaurantAddress(value);
  };

  const updateRestaurantPhone = (value: string) => {
    localStorage.setItem(RESTAURANT_PHONE_KEY, value);
    setRestaurantPhone(value);
  };

  const toggleDuplicateKitchenTicket = (value: boolean) => {
    localStorage.setItem(DUPLICATE_KITCHEN_TICKET_KEY, String(value));
    setDuplicateKitchenTicket(value);
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
      if (e.key === KITCHEN_FONT_SIZE_KEY) {
        setKitchenFontSize((e.newValue as PrintFontSize) || 'normal');
      }
      if (e.key === RECEIPT_FONT_SIZE_KEY) {
        setReceiptFontSize((e.newValue as PrintFontSize) || 'normal');
      }
      if (e.key === LINE_SPACING_KEY) {
        setLineSpacing(parseInt(e.newValue || '0'));
      }
      if (e.key === LEFT_MARGIN_KEY) {
        setLeftMargin(parseInt(e.newValue || '0'));
      }
      if (e.key === RESTAURANT_NAME_KEY) {
        setRestaurantName(e.newValue || 'Minha Pizzaria');
      }
      if (e.key === RESTAURANT_ADDRESS_KEY) {
        setRestaurantAddress(e.newValue || '');
      }
      if (e.key === RESTAURANT_PHONE_KEY) {
        setRestaurantPhone(e.newValue || '');
      }
      if (e.key === DUPLICATE_KITCHEN_TICKET_KEY) {
        setDuplicateKitchenTicket(e.newValue === 'true');
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
    kitchenFontSize,
    updateKitchenFontSize,
    receiptFontSize,
    updateReceiptFontSize,
    lineSpacing,
    updateLineSpacing,
    leftMargin,
    updateLeftMargin,
    restaurantName,
    updateRestaurantName,
    restaurantAddress,
    updateRestaurantAddress,
    restaurantPhone,
    updateRestaurantPhone,
    duplicateKitchenTicket,
    toggleDuplicateKitchenTicket
  };
}
