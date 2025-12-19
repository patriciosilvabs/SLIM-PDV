import { Order } from '@/hooks/useOrders';
import { Payment } from '@/hooks/useCashRegister';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { CustomerReceiptData } from '@/utils/escpos';
import { escapeHtml } from '@/lib/htmlEscape';
import { PaymentMethod } from '@/hooks/useCashRegister';

interface CustomerReceiptProps {
  order: Order;
  payments: Payment[];
  discount?: { type: 'percentage' | 'fixed'; value: number; amount: number };
  serviceCharge?: { enabled: boolean; percent: number; amount: number };
  splitBill?: { enabled: boolean; count: number; amountPerPerson: number };
  tableNumber?: number;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  receiptType?: 'summary' | 'fiscal'; // Type of receipt: summary (before payment) or fiscal (after payment)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Convert props to ESC/POS CustomerReceiptData
function propsToReceiptData(props: CustomerReceiptProps): CustomerReceiptData {
  const { order, payments, discount, serviceCharge, splitBill, tableNumber, restaurantName, restaurantAddress, restaurantPhone, receiptType } = props;
  const subtotal = order.subtotal || 0;
  const total = order.total || 0;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const change = totalPaid - total;

  return {
    restaurantName: restaurantName || 'Restaurante',
    restaurantAddress,
    restaurantPhone,
    orderNumber: order.id,
    orderType: order.order_type || 'dine_in',
    tableNumber: tableNumber || order.table?.number,
    customerName: order.customer_name,
    items: order.order_items?.map(item => ({
      quantity: item.quantity,
      productName: item.product?.name || 'Item',
      variation: item.variation?.name,
      extras: item.extras?.map(e => ({
        name: e.extra_name.includes(':') ? e.extra_name.split(': ').slice(1).join(': ') : e.extra_name,
        price: e.price,
      })),
      notes: item.notes,
      totalPrice: item.total_price,
    })) || [],
    subtotal,
    discount: discount?.amount ? {
      type: discount.type,
      value: discount.value,
      amount: discount.amount,
    } : undefined,
    serviceCharge: serviceCharge?.enabled && serviceCharge.amount > 0 ? {
      percent: serviceCharge.percent,
      amount: serviceCharge.amount,
    } : undefined,
    total,
    payments: payments.map(p => ({
      method: p.payment_method,
      amount: Number(p.amount),
    })),
    change: change > 0 ? change : undefined,
    splitBill: splitBill?.enabled && splitBill.count > 1 ? {
      count: splitBill.count,
      amountPerPerson: splitBill.amountPerPerson,
    } : undefined,
    createdAt: order.created_at,
    receiptType,
  };
}

// Fallback to browser print
function printWithBrowser({
  order,
  payments,
  discount,
  serviceCharge,
  splitBill,
  tableNumber,
  restaurantName = 'Restaurante',
  restaurantAddress = '',
  restaurantPhone = '',
  receiptType
}: CustomerReceiptProps) {
  const subtotal = order.subtotal || 0;
  const discountAmount = discount?.amount || order.discount || 0;
  const serviceAmount = serviceCharge?.enabled ? serviceCharge.amount : 0;
  const total = order.total || 0;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const change = totalPaid - total;

  const orderTypeLabel = order.order_type === 'dine_in' 
    ? `Mesa ${tableNumber || order.table?.number || '-'}`
    : order.order_type === 'takeaway' 
      ? 'Retirada' 
      : 'Delivery';

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comprovante - ${order.id.slice(0, 8)}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          width: 72mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          margin: 0;
          padding: 4mm;
          background: white;
          color: black;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed black;
          padding-bottom: 3mm;
          margin-bottom: 3mm;
        }
        .restaurant-name {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 1mm;
        }
        .restaurant-info {
          font-size: 9px;
          color: #333;
        }
        .order-info {
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .items-header {
          font-weight: bold;
          border-bottom: 1px solid black;
          padding-bottom: 1mm;
          margin-bottom: 2mm;
        }
        .item {
          margin-bottom: 2mm;
        }
        .item-line {
          display: flex;
          justify-content: space-between;
        }
        .item-extras {
          margin-left: 3mm;
          font-size: 10px;
          color: #444;
        }
        .item-notes {
          margin-left: 3mm;
          font-size: 10px;
          font-style: italic;
          color: #666;
        }
        .totals {
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 2mm;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1mm;
        }
        .total-line.discount {
          color: #c00;
        }
        .total-line.service {
          color: #060;
        }
        .total-line.final {
          font-weight: bold;
          font-size: 13px;
          border-top: 1px solid black;
          padding-top: 1mm;
          margin-top: 1mm;
        }
        .payments {
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 2mm;
        }
        .payments-header {
          font-weight: bold;
          margin-bottom: 1mm;
        }
        .payment-line {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .change {
          font-weight: bold;
          margin-top: 1mm;
        }
        .split {
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 2mm;
          text-align: center;
        }
        .split-header {
          font-weight: bold;
          margin-bottom: 1mm;
        }
        .split-amount {
          font-size: 12px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          border-top: 1px dashed black;
          padding-top: 3mm;
          margin-top: 4mm;
          font-size: 10px;
        }
        .footer-thanks {
          font-weight: bold;
          margin-bottom: 1mm;
        }
        .receipt-type-banner {
          background: black;
          color: white;
          padding: 2mm;
          text-align: center;
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 2mm;
        }
        .receipt-type-note {
          text-align: center;
          font-size: 9px;
          font-style: italic;
          margin-bottom: 3mm;
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="restaurant-name">${restaurantName}</div>
        ${restaurantAddress ? `<div class="restaurant-info">${restaurantAddress}</div>` : ''}
        ${restaurantPhone ? `<div class="restaurant-info">Tel: ${restaurantPhone}</div>` : ''}
      </div>
      
      ${receiptType ? `
        <div class="receipt-type-banner">
          ${receiptType === 'summary' ? 'RESUMO DA CONTA' : 'CUPOM FISCAL'}
        </div>
        <div class="receipt-type-note">
          ${receiptType === 'summary' 
            ? '* Este não é um documento fiscal *' 
            : '* Documento sem valor fiscal *'}
        </div>
      ` : ''}
      
      <div class="order-info">
        <div>Pedido: #${order.id.slice(0, 8).toUpperCase()}</div>
        <div>${orderTypeLabel}${order.customer_name ? ` - ${escapeHtml(order.customer_name)}` : ''}</div>
        <div>Data: ${new Date(order.created_at).toLocaleString('pt-BR')}</div>
      </div>
      
      <div>
        <div class="items-header">ITENS</div>
        ${order.order_items?.map(item => `
          <div class="item">
            <div class="item-line">
              <span>${item.quantity}x ${escapeHtml(item.product?.name) || 'Item'}${item.variation?.name ? ` (${escapeHtml(item.variation.name)})` : ''}</span>
              <span>${formatCurrency(item.total_price)}</span>
            </div>
            ${item.extras && item.extras.length > 0 ? `
              <div class="item-extras">
                ${item.extras.map(e => `+ ${escapeHtml(e.extra_name.includes(':') ? e.extra_name.split(': ').slice(1).join(': ') : e.extra_name)}`).join('<br>')}
              </div>
            ` : ''}
            ${item.notes ? `<div class="item-notes">Obs: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        `).join('') || ''}
      </div>
      
      <div class="totals">
        <div class="total-line">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${discountAmount > 0 ? `
          <div class="total-line discount">
            <span>Desconto${discount?.type === 'percentage' ? ` (${discount.value}%)` : ''}</span>
            <span>-${formatCurrency(discountAmount)}</span>
          </div>
        ` : ''}
        ${serviceAmount > 0 ? `
          <div class="total-line service">
            <span>Taxa de serviço (${serviceCharge?.percent}%)</span>
            <span>+${formatCurrency(serviceAmount)}</span>
          </div>
        ` : ''}
        <div class="total-line final">
          <span>TOTAL</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
      
      ${payments.length > 0 ? `
        <div class="payments">
          <div class="payments-header">PAGAMENTO</div>
          ${payments.map(p => `
            <div class="payment-line">
              <span>${p.payment_method === 'cash' ? 'Dinheiro' : 
                      p.payment_method === 'credit_card' ? 'Crédito' : 
                      p.payment_method === 'debit_card' ? 'Débito' : 'Pix'}</span>
              <span>${formatCurrency(Number(p.amount))}</span>
            </div>
          `).join('')}
          ${change > 0 ? `
            <div class="payment-line change">
              <span>Troco</span>
              <span>${formatCurrency(change)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${splitBill?.enabled && splitBill.count > 1 ? `
        <div class="split">
          <div class="split-header">DIVISÃO (${splitBill.count} pessoas)</div>
          <div class="split-amount">${formatCurrency(splitBill.amountPerPerson)} por pessoa</div>
        </div>
      ` : ''}
      
      <div class="footer">
        ${receiptType === 'summary' 
          ? `<div class="footer-thanks">Aguardamos seu pagamento!</div>`
          : `<div class="footer-thanks">Obrigado pela preferência!</div>
             <div>Volte sempre!</div>`
        }
        <div style="margin-top: 2mm; font-size: 9px;">
          ${new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

// Print function with QZ Tray support
export async function printCustomerReceipt(
  props: CustomerReceiptProps,
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Try QZ Tray first
  if (printer?.canPrintToCashier) {
    try {
      const receiptData = propsToReceiptData(props);
      const success = await printer.printCustomerReceipt(receiptData);
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printWithBrowser(props);
}

// ============ PARTIAL PAYMENT RECEIPT ============

interface PartialPaymentReceiptProps {
  orderTotal: number;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  existingPayments: Payment[];
  tableNumber?: number;
  customerName?: string;
  orderId: string;
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'Pix',
};

function printPartialPaymentWithBrowser({
  orderTotal,
  paymentAmount,
  paymentMethod,
  existingPayments,
  tableNumber,
  customerName,
  orderId,
}: PartialPaymentReceiptProps) {
  const previousTotal = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = previousTotal + paymentAmount;
  const remainingAmount = orderTotal - totalPaid;

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comprovante de Pagamento Parcial</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          width: 72mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          margin: 0;
          padding: 4mm;
          background: white;
          color: black;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed black;
          padding-bottom: 3mm;
          margin-bottom: 3mm;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 2mm;
        }
        .info-section {
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .info-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1mm;
        }
        .payment-section {
          padding: 3mm 0;
          border-bottom: 1px dashed black;
        }
        .current-payment {
          background: #f0f0f0;
          padding: 2mm;
          margin: 2mm 0;
          text-align: center;
        }
        .current-payment .amount {
          font-size: 16px;
          font-weight: bold;
        }
        .previous-payments {
          margin-top: 2mm;
          font-size: 10px;
        }
        .summary {
          padding-top: 2mm;
          margin-top: 2mm;
        }
        .summary-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1mm;
        }
        .remaining {
          font-weight: bold;
          font-size: 13px;
          border-top: 1px solid black;
          padding-top: 2mm;
          margin-top: 2mm;
        }
        .remaining.paid {
          color: green;
        }
        .footer {
          text-align: center;
          margin-top: 4mm;
          padding-top: 2mm;
          border-top: 1px dashed black;
          font-size: 9px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">PAGAMENTO PARCIAL</div>
        <div>Comprovante de Pagamento</div>
      </div>
      
      <div class="info-section">
        <div class="info-line">
          <span>Pedido:</span>
          <span>#${escapeHtml(orderId.slice(0, 8).toUpperCase())}</span>
        </div>
        ${tableNumber ? `
          <div class="info-line">
            <span>Mesa:</span>
            <span>${tableNumber}</span>
          </div>
        ` : ''}
        ${customerName ? `
          <div class="info-line">
            <span>Cliente:</span>
            <span>${escapeHtml(customerName)}</span>
          </div>
        ` : ''}
        <div class="info-line">
          <span>Data/Hora:</span>
          <span>${new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>
      
      <div class="payment-section">
        <div class="current-payment">
          <div>Pagamento Registrado</div>
          <div class="amount">${formatCurrency(paymentAmount)}</div>
          <div>${paymentMethodLabels[paymentMethod]}</div>
        </div>
        
        ${existingPayments.length > 0 ? `
          <div class="previous-payments">
            <div style="font-weight: bold; margin-bottom: 1mm;">Pagamentos anteriores:</div>
            ${existingPayments.map(p => `
              <div class="info-line">
                <span>${paymentMethodLabels[p.payment_method]}</span>
                <span>${formatCurrency(Number(p.amount))}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="summary">
        <div class="summary-line">
          <span>Total da Conta:</span>
          <span>${formatCurrency(orderTotal)}</span>
        </div>
        <div class="summary-line">
          <span>Total Pago:</span>
          <span>${formatCurrency(totalPaid)}</span>
        </div>
        <div class="summary-line remaining ${remainingAmount <= 0 ? 'paid' : ''}">
          <span>${remainingAmount <= 0 ? 'PAGO' : 'Falta Pagar:'}</span>
          <span>${remainingAmount <= 0 ? '✓' : formatCurrency(remainingAmount)}</span>
        </div>
      </div>
      
      <div class="footer">
        <div>*** Comprovante de pagamento parcial ***</div>
        <div>Mesa continua aberta</div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=500');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

export async function printPartialPaymentReceipt(
  props: PartialPaymentReceiptProps,
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // For now, use browser print for partial payment receipts
  // QZ Tray support can be added later if needed
  printPartialPaymentWithBrowser(props);
}
