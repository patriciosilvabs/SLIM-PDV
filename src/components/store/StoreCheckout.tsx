import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Store, Truck, Banknote, CreditCard, QrCode, Loader2 } from 'lucide-react';

interface StoreCheckoutProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    order_type: 'takeaway' | 'delivery';
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    notes: string;
    payment_method: string;
  }) => void;
  total: number;
  isTable: boolean;
  isLoading: boolean;
  storeName: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function StoreCheckout({ open, onClose, onSubmit, total, isTable, isLoading, storeName }: StoreCheckoutProps) {
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const isDelivery = !isTable && orderType === 'delivery';
  const canSubmit = (!isDelivery || address.trim().length > 0);

  const handleSubmit = () => {
    onSubmit({
      order_type: orderType,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      notes,
      payment_method: paymentMethod,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>Finalizar Pedido</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Order type (not shown for table orders) */}
          {!isTable && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo do pedido</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    orderType === 'takeaway' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <Store className="h-5 w-5" />
                  <span className="text-sm font-medium">Retirada</span>
                </button>
                <button
                  onClick={() => setOrderType('delivery')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    orderType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <Truck className="h-5 w-5" />
                  <span className="text-sm font-medium">Entrega</span>
                </button>
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Seus dados</Label>
            <Input
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg"
            />
            <Input
              placeholder="Telefone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg"
            />
            {isDelivery && (
              <Textarea
                placeholder="Endereço completo para entrega *"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-lg"
                rows={2}
              />
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Forma de pagamento</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-1">
              {[
                { value: 'cash', label: 'Dinheiro', icon: Banknote },
                { value: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
                { value: 'debit', label: 'Cartão de Débito', icon: CreditCard },
                { value: 'pix', label: 'Pix', icon: QrCode },
              ].map(method => (
                <label
                  key={method.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === method.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <RadioGroupItem value={method.value} />
                  <method.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{method.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Observações</Label>
            <Textarea
              placeholder="Alguma observação para o pedido?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-3 bg-card">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              `Enviar Pedido`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
