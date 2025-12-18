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
const RESTAURANT_CNPJ_KEY = 'pdv_restaurant_cnpj';
const DUPLICATE_KITCHEN_TICKET_KEY = 'pdv_duplicate_kitchen_ticket';
const ASCII_MODE_KEY = 'pdv_ascii_mode';
const CHAR_SPACING_KEY = 'pdv_char_spacing';
const TOP_MARGIN_KEY = 'pdv_top_margin';
const BOTTOM_MARGIN_KITCHEN_KEY = 'pdv_bottom_margin_kitchen';
const BOTTOM_MARGIN_RECEIPT_KEY = 'pdv_bottom_margin_receipt';
const RESTAURANT_LOGO_URL_KEY = 'pdv_restaurant_logo_url';

// General print settings keys
const PRINT_SHOW_ITEM_NUMBER_KEY = 'pdv_print_show_item_number';
const PRINT_SHOW_COMPLEMENT_PRICE_KEY = 'pdv_print_show_complement_price';
const PRINT_SHOW_COMPLEMENT_NAME_KEY = 'pdv_print_show_complement_name';
const PRINT_LARGE_FONT_PRODUCTION_KEY = 'pdv_print_large_font_production';
const PRINT_MULTIPLY_OPTIONS_KEY = 'pdv_print_multiply_options';
const PRINT_SHOW_LOGO_KEY = 'pdv_print_show_logo';
const PRINT_CANCELLATION_KEY = 'pdv_print_cancellation';
const PRINT_RATING_QR_KEY = 'pdv_print_rating_qr';

// Custom message keys
const PRINT_MESSAGE_STANDARD_KEY = 'pdv_print_message_standard';
const PRINT_MESSAGE_TABLE_KEY = 'pdv_print_message_table';
const PRINT_QR_STANDARD_KEY = 'pdv_print_qr_standard';
const PRINT_QR_TABLE_KEY = 'pdv_print_qr_table';

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
    if (typeof window === 'undefined') return 'TOTAL';
    return localStorage.getItem(RESTAURANT_NAME_KEY) || 'TOTAL';
  });

  const [restaurantAddress, setRestaurantAddress] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_ADDRESS_KEY) || '';
  });

  const [restaurantPhone, setRestaurantPhone] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_PHONE_KEY) || '';
  });

  const [restaurantCnpj, setRestaurantCnpj] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_CNPJ_KEY) || '';
  });

  const [duplicateKitchenTicket, setDuplicateKitchenTicket] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DUPLICATE_KITCHEN_TICKET_KEY) === 'true';
  });

  const [asciiMode, setAsciiMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ASCII_MODE_KEY) === 'true';
  });

  const [charSpacing, setCharSpacing] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return parseInt(localStorage.getItem(CHAR_SPACING_KEY) || '1');
  });

  const [topMargin, setTopMargin] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(TOP_MARGIN_KEY) || '0');
  });

  const [bottomMarginKitchen, setBottomMarginKitchen] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    return parseInt(localStorage.getItem(BOTTOM_MARGIN_KITCHEN_KEY) || '3');
  });

  const [bottomMarginReceipt, setBottomMarginReceipt] = useState<number>(() => {
    if (typeof window === 'undefined') return 4;
    return parseInt(localStorage.getItem(BOTTOM_MARGIN_RECEIPT_KEY) || '4');
  });

  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(RESTAURANT_LOGO_URL_KEY) || '';
  });

  // General print settings
  const [showItemNumber, setShowItemNumber] = useState(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(PRINT_SHOW_ITEM_NUMBER_KEY);
    return val === null ? true : val === 'true';
  });

  const [showComplementPrice, setShowComplementPrice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PRINT_SHOW_COMPLEMENT_PRICE_KEY) === 'true';
  });

  const [showComplementName, setShowComplementName] = useState(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(PRINT_SHOW_COMPLEMENT_NAME_KEY);
    return val === null ? true : val === 'true';
  });

  const [largeFontProduction, setLargeFontProduction] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PRINT_LARGE_FONT_PRODUCTION_KEY) === 'true';
  });

  const [multiplyOptions, setMultiplyOptions] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PRINT_MULTIPLY_OPTIONS_KEY) === 'true';
  });

  const [showLogo, setShowLogo] = useState(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(PRINT_SHOW_LOGO_KEY);
    return val === null ? true : val === 'true';
  });

  const [printCancellation, setPrintCancellation] = useState(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(PRINT_CANCELLATION_KEY);
    return val === null ? true : val === 'true';
  });

  const [printRatingQr, setPrintRatingQr] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PRINT_RATING_QR_KEY) === 'true';
  });

  // Custom messages
  const [printMessageStandard, setPrintMessageStandard] = useState(() => {
    if (typeof window === 'undefined') return 'Obrigado pelo seu pedido!';
    return localStorage.getItem(PRINT_MESSAGE_STANDARD_KEY) || 'Obrigado pelo seu pedido!';
  });

  const [printMessageTable, setPrintMessageTable] = useState(() => {
    if (typeof window === 'undefined') return 'Obrigado pela preferência!';
    return localStorage.getItem(PRINT_MESSAGE_TABLE_KEY) || 'Obrigado pela preferência!';
  });

  const [printQrStandard, setPrintQrStandard] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(PRINT_QR_STANDARD_KEY) || '';
  });

  const [printQrTable, setPrintQrTable] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(PRINT_QR_TABLE_KEY) || '';
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

  const updateRestaurantCnpj = (value: string) => {
    localStorage.setItem(RESTAURANT_CNPJ_KEY, value);
    setRestaurantCnpj(value);
  };

  const toggleDuplicateKitchenTicket = (value: boolean) => {
    localStorage.setItem(DUPLICATE_KITCHEN_TICKET_KEY, String(value));
    setDuplicateKitchenTicket(value);
  };

  const toggleAsciiMode = (value: boolean) => {
    localStorage.setItem(ASCII_MODE_KEY, String(value));
    setAsciiMode(value);
  };

  const updateCharSpacing = (value: number) => {
    localStorage.setItem(CHAR_SPACING_KEY, String(value));
    setCharSpacing(value);
  };

  const updateTopMargin = (value: number) => {
    localStorage.setItem(TOP_MARGIN_KEY, String(value));
    setTopMargin(value);
  };

  const updateBottomMarginKitchen = (value: number) => {
    localStorage.setItem(BOTTOM_MARGIN_KITCHEN_KEY, String(value));
    setBottomMarginKitchen(value);
  };

  const updateBottomMarginReceipt = (value: number) => {
    localStorage.setItem(BOTTOM_MARGIN_RECEIPT_KEY, String(value));
    setBottomMarginReceipt(value);
  };

  const updateRestaurantLogoUrl = (value: string) => {
    localStorage.setItem(RESTAURANT_LOGO_URL_KEY, value);
    setRestaurantLogoUrl(value);
  };

  // General print settings toggles
  const toggleShowItemNumber = (value: boolean) => {
    localStorage.setItem(PRINT_SHOW_ITEM_NUMBER_KEY, String(value));
    setShowItemNumber(value);
  };

  const toggleShowComplementPrice = (value: boolean) => {
    localStorage.setItem(PRINT_SHOW_COMPLEMENT_PRICE_KEY, String(value));
    setShowComplementPrice(value);
  };

  const toggleShowComplementName = (value: boolean) => {
    localStorage.setItem(PRINT_SHOW_COMPLEMENT_NAME_KEY, String(value));
    setShowComplementName(value);
  };

  const toggleLargeFontProduction = (value: boolean) => {
    localStorage.setItem(PRINT_LARGE_FONT_PRODUCTION_KEY, String(value));
    setLargeFontProduction(value);
  };

  const toggleMultiplyOptions = (value: boolean) => {
    localStorage.setItem(PRINT_MULTIPLY_OPTIONS_KEY, String(value));
    setMultiplyOptions(value);
  };

  const toggleShowLogo = (value: boolean) => {
    localStorage.setItem(PRINT_SHOW_LOGO_KEY, String(value));
    setShowLogo(value);
  };

  const togglePrintCancellation = (value: boolean) => {
    localStorage.setItem(PRINT_CANCELLATION_KEY, String(value));
    setPrintCancellation(value);
  };

  const togglePrintRatingQr = (value: boolean) => {
    localStorage.setItem(PRINT_RATING_QR_KEY, String(value));
    setPrintRatingQr(value);
  };

  // Custom message updates
  const updatePrintMessageStandard = (value: string) => {
    localStorage.setItem(PRINT_MESSAGE_STANDARD_KEY, value);
    setPrintMessageStandard(value);
  };

  const updatePrintMessageTable = (value: string) => {
    localStorage.setItem(PRINT_MESSAGE_TABLE_KEY, value);
    setPrintMessageTable(value);
  };

  const updatePrintQrStandard = (value: string) => {
    localStorage.setItem(PRINT_QR_STANDARD_KEY, value);
    setPrintQrStandard(value);
  };

  const updatePrintQrTable = (value: string) => {
    localStorage.setItem(PRINT_QR_TABLE_KEY, value);
    setPrintQrTable(value);
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
        setRestaurantName(e.newValue || 'TOTAL');
      }
      if (e.key === RESTAURANT_ADDRESS_KEY) {
        setRestaurantAddress(e.newValue || '');
      }
      if (e.key === RESTAURANT_PHONE_KEY) {
        setRestaurantPhone(e.newValue || '');
      }
      if (e.key === RESTAURANT_CNPJ_KEY) {
        setRestaurantCnpj(e.newValue || '');
      }
      if (e.key === DUPLICATE_KITCHEN_TICKET_KEY) {
        setDuplicateKitchenTicket(e.newValue === 'true');
      }
      if (e.key === ASCII_MODE_KEY) {
        setAsciiMode(e.newValue === 'true');
      }
      if (e.key === CHAR_SPACING_KEY) {
        setCharSpacing(parseInt(e.newValue || '1'));
      }
      if (e.key === TOP_MARGIN_KEY) {
        setTopMargin(parseInt(e.newValue || '0'));
      }
      if (e.key === BOTTOM_MARGIN_KITCHEN_KEY) {
        setBottomMarginKitchen(parseInt(e.newValue || '3'));
      }
      if (e.key === BOTTOM_MARGIN_RECEIPT_KEY) {
        setBottomMarginReceipt(parseInt(e.newValue || '4'));
      }
      if (e.key === RESTAURANT_LOGO_URL_KEY) {
        setRestaurantLogoUrl(e.newValue || '');
      }
      // General print settings
      if (e.key === PRINT_SHOW_ITEM_NUMBER_KEY) {
        setShowItemNumber(e.newValue === 'true');
      }
      if (e.key === PRINT_SHOW_COMPLEMENT_PRICE_KEY) {
        setShowComplementPrice(e.newValue === 'true');
      }
      if (e.key === PRINT_SHOW_COMPLEMENT_NAME_KEY) {
        setShowComplementName(e.newValue === 'true');
      }
      if (e.key === PRINT_LARGE_FONT_PRODUCTION_KEY) {
        setLargeFontProduction(e.newValue === 'true');
      }
      if (e.key === PRINT_MULTIPLY_OPTIONS_KEY) {
        setMultiplyOptions(e.newValue === 'true');
      }
      if (e.key === PRINT_SHOW_LOGO_KEY) {
        setShowLogo(e.newValue === 'true');
      }
      if (e.key === PRINT_CANCELLATION_KEY) {
        setPrintCancellation(e.newValue === 'true');
      }
      if (e.key === PRINT_RATING_QR_KEY) {
        setPrintRatingQr(e.newValue === 'true');
      }
      // Custom messages
      if (e.key === PRINT_MESSAGE_STANDARD_KEY) {
        setPrintMessageStandard(e.newValue || 'Obrigado pelo seu pedido!');
      }
      if (e.key === PRINT_MESSAGE_TABLE_KEY) {
        setPrintMessageTable(e.newValue || 'Obrigado pela preferência!');
      }
      if (e.key === PRINT_QR_STANDARD_KEY) {
        setPrintQrStandard(e.newValue || '');
      }
      if (e.key === PRINT_QR_TABLE_KEY) {
        setPrintQrTable(e.newValue || '');
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
    restaurantCnpj,
    updateRestaurantCnpj,
    duplicateKitchenTicket,
    toggleDuplicateKitchenTicket,
    asciiMode,
    toggleAsciiMode,
    charSpacing,
    updateCharSpacing,
    topMargin,
    updateTopMargin,
    bottomMarginKitchen,
    updateBottomMarginKitchen,
    bottomMarginReceipt,
    updateBottomMarginReceipt,
    restaurantLogoUrl,
    updateRestaurantLogoUrl,
    // General print settings
    showItemNumber,
    toggleShowItemNumber,
    showComplementPrice,
    toggleShowComplementPrice,
    showComplementName,
    toggleShowComplementName,
    largeFontProduction,
    toggleLargeFontProduction,
    multiplyOptions,
    toggleMultiplyOptions,
    showLogo,
    toggleShowLogo,
    printCancellation,
    togglePrintCancellation,
    printRatingQr,
    togglePrintRatingQr,
    // Custom messages
    printMessageStandard,
    updatePrintMessageStandard,
    printMessageTable,
    updatePrintMessageTable,
    printQrStandard,
    updatePrintQrStandard,
    printQrTable,
    updatePrintQrTable
  };
}
