import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { KitchenTicketData } from '@/utils/escpos';

interface OrderItem {
  id: string;
  quantity: number;
  notes?: string | null;
  product?: { name: string };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number }[];
}

interface KitchenOrderProps {
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  items: OrderItem[];
  notes?: string | null;
  createdAt: string;
}

// Fallback to browser print
function printWithBrowser(props: KitchenOrderProps) {
  const { orderNumber, orderType, tableNumber, customerName, items, notes, createdAt } = props;
  
  const orderTypeLabels = {
    dine_in: tableNumber ? `MESA ${tableNumber}` : 'MESA',
    takeaway: 'BALCÃO',
    delivery: 'DELIVERY',
  };

  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (!printWindow) return;

  const itemsHtml = items.map(item => `
    <div style="margin-bottom: 8px; border-bottom: 1px dashed #999; padding-bottom: 8px;">
      <div style="font-weight: bold; font-size: 14px;">
        ${item.quantity}x ${item.product?.name || 'Produto'}
      </div>
      ${item.variation ? `<div style="font-size: 12px; color: #666;">▸ ${item.variation.name}</div>` : ''}
      ${item.extras && item.extras.length > 0 ? item.extras.map(e => `
        <div style="font-size: 12px; color: #666; padding-left: 8px;">
          • ${e.extra_name.split(': ').slice(1).join(': ') || e.extra_name}
        </div>
      `).join('') : ''}
      ${item.notes ? `<div style="font-size: 11px; color: #c00; margin-top: 4px;">OBS: ${item.notes}</div>` : ''}
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comanda</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          width: 80mm; 
          padding: 8px;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 8px; 
          margin-bottom: 8px;
        }
        .order-type { 
          font-size: 20px; 
          font-weight: bold; 
          margin-bottom: 4px;
        }
        .order-number { 
          font-size: 16px; 
          font-weight: bold;
        }
        .meta { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px dashed #999;
        }
        .items { margin-bottom: 8px; }
        .notes { 
          border: 1px solid #c00; 
          padding: 8px; 
          margin-top: 8px;
          background: #fff0f0;
        }
        .notes-title { font-weight: bold; color: #c00; }
        .footer { 
          text-align: center; 
          margin-top: 16px; 
          padding-top: 8px; 
          border-top: 2px solid #000;
          font-size: 10px;
        }
        @media print {
          body { width: 100%; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="order-type">${orderTypeLabels[orderType]}</div>
        <div class="order-number">Pedido #${orderNumber.slice(-6).toUpperCase()}</div>
      </div>
      
      <div class="meta">
        <span>${format(new Date(createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
        ${customerName ? `<span>${customerName}</span>` : ''}
      </div>
      
      <div class="items">
        ${itemsHtml}
      </div>
      
      ${notes ? `
        <div class="notes">
          <div class="notes-title">OBSERVAÇÕES GERAIS:</div>
          <div>${notes}</div>
        </div>
      ` : ''}
      
      <div class="footer">
        Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Convert props to ESC/POS data format
function propsToTicketData(props: KitchenOrderProps): KitchenTicketData {
  return {
    orderNumber: props.orderNumber,
    orderType: props.orderType,
    tableNumber: props.tableNumber,
    customerName: props.customerName,
    items: props.items.map(item => ({
      quantity: item.quantity,
      productName: item.product?.name || 'Produto',
      variation: item.variation?.name,
      extras: item.extras?.map(e => e.extra_name.split(': ').slice(1).join(': ') || e.extra_name),
      notes: item.notes,
    })),
    notes: props.notes,
    createdAt: props.createdAt,
  };
}

export async function printKitchenOrderTicket(
  props: KitchenOrderProps, 
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Try QZ Tray first
  if (printer?.canPrintToKitchen) {
    try {
      const ticketData = propsToTicketData(props);
      const success = await printer.printKitchenTicket(ticketData);
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printWithBrowser(props);
}

export function KitchenOrderTicketButton({ 
  orderNumber, 
  orderType, 
  tableNumber, 
  customerName, 
  items, 
  notes, 
  createdAt,
  className
}: KitchenOrderProps & { className?: string }) {
  const printer = usePrinterOptional();
  
  const handlePrint = () => {
    printKitchenOrderTicket({ orderNumber, orderType, tableNumber, customerName, items, notes, createdAt }, printer);
  };

  return (
    <button 
      onClick={handlePrint}
      className={className}
      title="Imprimir Comanda"
    >
      🖨️
    </button>
  );
}
