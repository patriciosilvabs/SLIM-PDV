// ESC/POS Commands for thermal printers
// Reference: https://reference.epson-biz.com/modules/ref_escpos/index.php

// Basic commands
export const ESC = '\x1B';
export const GS = '\x1D';
export const LF = '\x0A';
export const CR = '\x0D';

// Initialize printer
export const INIT = ESC + '@';

// Text formatting
export const TEXT_NORMAL = ESC + '!' + '\x00';
export const TEXT_BOLD = ESC + 'E' + '\x01';
export const TEXT_BOLD_OFF = ESC + 'E' + '\x00';
export const TEXT_DOUBLE_HEIGHT = ESC + '!' + '\x10';
export const TEXT_DOUBLE_WIDTH = ESC + '!' + '\x20';
export const TEXT_DOUBLE_SIZE = ESC + '!' + '\x30';
export const TEXT_UNDERLINE = ESC + '-' + '\x01';
export const TEXT_UNDERLINE_OFF = ESC + '-' + '\x00';

// Text alignment
export const ALIGN_LEFT = ESC + 'a' + '\x00';
export const ALIGN_CENTER = ESC + 'a' + '\x01';
export const ALIGN_RIGHT = ESC + 'a' + '\x02';

// Paper operations
export const PAPER_CUT = GS + 'V' + '\x00'; // Full cut
export const PAPER_CUT_PARTIAL = GS + 'V' + '\x01'; // Partial cut
export const PAPER_CUT_FEED = GS + 'V' + '\x41' + '\x03'; // Feed and cut

// Cash drawer
export const CASH_DRAWER_OPEN = ESC + 'p' + '\x00' + '\x19' + '\xFA'; // Pin 2
export const CASH_DRAWER_OPEN_PIN5 = ESC + 'p' + '\x01' + '\x19' + '\xFA'; // Pin 5

// Line spacing
export const LINE_SPACING_DEFAULT = ESC + '2';
export const LINE_SPACING_SET = (n: number) => ESC + '3' + String.fromCharCode(n);

// Character size
export const CHAR_SIZE = (width: number, height: number) => {
  const n = ((width - 1) << 4) | (height - 1);
  return GS + '!' + String.fromCharCode(n);
};

// Feed lines
export const FEED_LINES = (n: number) => ESC + 'd' + String.fromCharCode(n);

// Horizontal line (using dashes)
export const HORIZONTAL_LINE = (width: number, char = '-') => char.repeat(width) + LF;

// Separator line
export const SEPARATOR_LINE = (width: number) => '='.repeat(width) + LF;

// Dashed line
export const DASHED_LINE = (width: number) => '-'.repeat(width) + LF;

// Helper to create formatted text
export function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces < 1) {
    return left.substring(0, width - right.length - 1) + ' ' + right + LF;
  }
  return left + ' '.repeat(spaces) + right + LF;
}

// Helper to center text
export function centerText(text: string, width: number): string {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
}

// Helper to wrap text
export function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Font size type
export type PrintFontSize = 'normal' | 'large' | 'extra_large';

// Get font size command based on setting
export function getFontSizeCommand(fontSize: PrintFontSize): string {
  switch (fontSize) {
    case 'large':
      return TEXT_DOUBLE_HEIGHT;
    case 'extra_large':
      return TEXT_DOUBLE_SIZE;
    default:
      return TEXT_NORMAL;
  }
}

// Build kitchen ticket
export interface KitchenTicketData {
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  items: {
    quantity: number;
    productName: string;
    variation?: string | null;
    extras?: string[];
    notes?: string | null;
  }[];
  notes?: string | null;
  createdAt: string;
}

export function buildKitchenTicket(data: KitchenTicketData, paperWidth: '58mm' | '80mm' = '80mm', fontSize: PrintFontSize = 'normal'): string {
  const width = paperWidth === '58mm' ? 32 : 48;
  let ticket = '';
  const fontCmd = getFontSizeCommand(fontSize);

  // Initialize
  ticket += INIT;

  // Header
  ticket += ALIGN_CENTER;
  ticket += TEXT_BOLD;
  ticket += fontCmd;
  ticket += 'COZINHA' + LF;
  ticket += TEXT_DOUBLE_SIZE;
  
  if (data.orderType === 'dine_in' && data.tableNumber) {
    ticket += `MESA ${data.tableNumber}` + LF;
  } else if (data.orderType === 'takeaway') {
    ticket += 'BALCAO' + LF;
  } else {
    ticket += 'DELIVERY' + LF;
  }

  ticket += fontCmd;
  ticket += TEXT_BOLD;
  ticket += `Pedido #${data.orderNumber.slice(-6).toUpperCase()}` + LF;
  ticket += TEXT_BOLD_OFF;
  
  if (data.customerName) {
    ticket += data.customerName + LF;
  }

  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Date/time
  ticket += ALIGN_LEFT;
  ticket += fontCmd;
  const date = new Date(data.createdAt);
  ticket += `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` + LF;
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Items
  for (const item of data.items) {
    ticket += fontCmd;
    ticket += TEXT_BOLD;
    ticket += `${item.quantity}x ${item.productName}` + LF;
    ticket += TEXT_BOLD_OFF;

    if (item.variation) {
      ticket += `  > ${item.variation}` + LF;
    }

    if (item.extras && item.extras.length > 0) {
      for (const extra of item.extras) {
        ticket += `  + ${extra}` + LF;
      }
    }

    if (item.notes) {
      ticket += TEXT_BOLD;
      ticket += `  OBS: ${item.notes}` + LF;
      ticket += TEXT_BOLD_OFF;
    }

    ticket += LF;
  }

  // General notes
  if (data.notes) {
    ticket += TEXT_NORMAL;
    ticket += DASHED_LINE(width);
    ticket += fontCmd;
    ticket += TEXT_BOLD;
    ticket += 'OBSERVACOES GERAIS:' + LF;
    ticket += TEXT_BOLD_OFF;
    const wrappedNotes = wrapText(data.notes, width);
    for (const line of wrappedNotes) {
      ticket += line + LF;
    }
  }

  // Footer
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);
  ticket += ALIGN_CENTER;
  ticket += `Impresso: ${new Date().toLocaleString('pt-BR')}` + LF;
  
  // Feed and cut
  ticket += FEED_LINES(3);
  ticket += PAPER_CUT_PARTIAL;

  return ticket;
}

// Build customer receipt
export interface CustomerReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  items: {
    quantity: number;
    productName: string;
    variation?: string | null;
    extras?: { name: string; price: number }[];
    notes?: string | null;
    totalPrice: number;
  }[];
  subtotal: number;
  discount?: { type: 'percentage' | 'fixed'; value: number; amount: number };
  serviceCharge?: { percent: number; amount: number };
  total: number;
  payments: { method: string; amount: number }[];
  change?: number;
  splitBill?: { count: number; amountPerPerson: number };
  createdAt: string;
}

export function buildCustomerReceipt(data: CustomerReceiptData, paperWidth: '58mm' | '80mm' = '80mm', fontSize: PrintFontSize = 'normal'): string {
  const width = paperWidth === '58mm' ? 32 : 48;
  let receipt = '';
  const fontCmd = getFontSizeCommand(fontSize);

  // Initialize
  receipt += INIT;

  // Header
  receipt += ALIGN_CENTER;
  receipt += TEXT_DOUBLE_SIZE;
  receipt += data.restaurantName + LF;
  receipt += fontCmd;
  
  if (data.restaurantAddress) {
    receipt += data.restaurantAddress + LF;
  }
  if (data.restaurantPhone) {
    receipt += `Tel: ${data.restaurantPhone}` + LF;
  }

  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Order info
  receipt += ALIGN_LEFT;
  receipt += fontCmd;
  receipt += `Pedido: #${data.orderNumber.slice(-8).toUpperCase()}` + LF;
  
  const orderTypeLabel = data.orderType === 'dine_in' 
    ? `Mesa ${data.tableNumber || '-'}`
    : data.orderType === 'takeaway' 
      ? 'Retirada' 
      : 'Delivery';
  receipt += orderTypeLabel + (data.customerName ? ` - ${data.customerName}` : '') + LF;
  receipt += new Date(data.createdAt).toLocaleString('pt-BR') + LF;

  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Items header
  receipt += fontCmd;
  receipt += TEXT_BOLD;
  receipt += 'ITENS' + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += TEXT_NORMAL;
  receipt += SEPARATOR_LINE(width);

  // Items
  receipt += fontCmd;
  for (const item of data.items) {
    const itemName = `${item.quantity}x ${item.productName}${item.variation ? ` (${item.variation})` : ''}`;
    const itemPrice = formatCurrency(item.totalPrice);
    
    if (itemName.length + itemPrice.length + 1 > width) {
      receipt += itemName.substring(0, width - 1) + LF;
      receipt += formatLine('', itemPrice, width);
    } else {
      receipt += formatLine(itemName, itemPrice, width);
    }

    if (item.extras && item.extras.length > 0) {
      for (const extra of item.extras) {
        receipt += `  + ${extra.name}` + LF;
      }
    }

    if (item.notes) {
      receipt += `  Obs: ${item.notes}` + LF;
    }
  }

  // Totals
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);
  receipt += fontCmd;
  receipt += formatLine('Subtotal', formatCurrency(data.subtotal), width);

  if (data.discount && data.discount.amount > 0) {
    const discountLabel = data.discount.type === 'percentage' 
      ? `Desconto (${data.discount.value}%)`
      : 'Desconto';
    receipt += formatLine(discountLabel, `-${formatCurrency(data.discount.amount)}`, width);
  }

  if (data.serviceCharge && data.serviceCharge.amount > 0) {
    receipt += formatLine(`Taxa serviço (${data.serviceCharge.percent}%)`, `+${formatCurrency(data.serviceCharge.amount)}`, width);
  }

  receipt += TEXT_NORMAL;
  receipt += SEPARATOR_LINE(width);
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_HEIGHT;
  receipt += formatLine('TOTAL', formatCurrency(data.total), width);
  receipt += fontCmd;

  // Payments
  if (data.payments.length > 0) {
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += 'PAGAMENTO' + LF;
    receipt += TEXT_BOLD_OFF;

    for (const payment of data.payments) {
      const methodLabel = payment.method === 'cash' ? 'Dinheiro' :
        payment.method === 'credit_card' ? 'Crédito' :
        payment.method === 'debit_card' ? 'Débito' : 'Pix';
      receipt += formatLine(methodLabel, formatCurrency(payment.amount), width);
    }

    if (data.change && data.change > 0) {
      receipt += TEXT_BOLD;
      receipt += formatLine('Troco', formatCurrency(data.change), width);
      receipt += TEXT_BOLD_OFF;
    }
  }

  // Split bill
  if (data.splitBill && data.splitBill.count > 1) {
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
    receipt += ALIGN_CENTER;
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += `DIVISAO (${data.splitBill.count} pessoas)` + LF;
    receipt += TEXT_DOUBLE_HEIGHT;
    receipt += `${formatCurrency(data.splitBill.amountPerPerson)} por pessoa` + LF;
    receipt += fontCmd;
    receipt += ALIGN_LEFT;
  }

  // Footer
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);
  receipt += ALIGN_CENTER;
  receipt += fontCmd;
  receipt += TEXT_BOLD;
  receipt += 'Obrigado pela preferencia!' + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += 'Volte sempre!' + LF;
  receipt += LF;
  receipt += new Date().toLocaleString('pt-BR') + LF;

  // Feed and cut
  receipt += FEED_LINES(4);
  receipt += PAPER_CUT_PARTIAL;

  return receipt;
}

// Open cash drawer
export function buildCashDrawerCommand(): string {
  return CASH_DRAWER_OPEN;
}

// Build font size test print
export function buildFontSizeTestPrint(
  paperWidth: '58mm' | '80mm' = '80mm', 
  fontSize: PrintFontSize = 'normal',
  type: 'kitchen' | 'receipt' = 'kitchen'
): string {
  const width = paperWidth === '58mm' ? 32 : 48;
  let print = '';
  const fontCmd = getFontSizeCommand(fontSize);

  // Initialize
  print += INIT;

  // Header
  print += ALIGN_CENTER;
  print += TEXT_BOLD;
  print += fontCmd;
  print += 'MINHA PIZZARIA' + LF;
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Order info
  print += fontCmd;
  print += 'PEDIDO #123' + LF;
  if (type === 'kitchen') {
    print += 'COZINHA - Mesa: 05' + LF;
  } else {
    print += 'Mesa: 05' + LF;
  }
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Items
  print += ALIGN_LEFT;
  print += fontCmd;
  print += '1x Pizza Grande' + LF;
  print += '  - Calabresa' + LF;
  print += '2x Refrigerante' + LF;
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Total (only for receipt)
  if (type === 'receipt') {
    print += fontCmd;
    print += TEXT_BOLD;
    print += formatLine('TOTAL', 'R$ 65,00', width);
    print += TEXT_BOLD_OFF;
    print += TEXT_NORMAL;
    print += DASHED_LINE(width);
  }

  // Footer - test info
  print += ALIGN_CENTER;
  print += fontCmd;
  const fontLabel = fontSize === 'normal' ? 'NORMAL' : fontSize === 'large' ? 'GRANDE' : 'EXTRA GRANDE';
  print += `TESTE DE FONTE: ${fontLabel}` + LF;
  print += TEXT_NORMAL;
  print += new Date().toLocaleString('pt-BR') + LF;
  
  // Feed and cut
  print += FEED_LINES(3);
  print += PAPER_CUT_PARTIAL;

  return print;
}
