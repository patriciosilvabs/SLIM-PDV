import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOpenCashRegister, useCashRegisterMutations, PaymentMethod } from '@/hooks/useCashRegister';
import { useCashMovements } from '@/hooks/useReports';
import { useOrders, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Lock,
  Unlock,
  CheckCircle,
  Users,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: any }> = {
  cash: { label: 'Dinheiro', icon: DollarSign },
  credit_card: { label: 'Cartão Crédito', icon: CreditCard },
  debit_card: { label: 'Cartão Débito', icon: CreditCard },
  pix: { label: 'PIX', icon: Smartphone },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CashRegister() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  
  // Granular permission checks
  const canOpenCash = hasPermission('cash_open');
  const canCloseCash = hasPermission('cash_close');
  const canWithdraw = hasPermission('cash_withdraw');
  const canSupply = hasPermission('cash_supply');
  const canManage = hasPermission('cash_register_manage');

  // State hooks
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [movementType, setMovementType] = useState<'withdrawal' | 'supply'>('withdrawal');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Query hooks
  const { data: openRegister, isLoading } = useOpenCashRegister();
  const { data: movements } = useCashMovements(openRegister?.id);
  const { data: readyOrders } = useOrders(['ready']);
  const { openCashRegister, closeCashRegister, createPayment } = useCashRegisterMutations();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch partial payments for this cash register WITH receiver profile
  const { data: partialPayments } = useQuery({
    queryKey: ['partial-payments', openRegister?.id],
    queryFn: async () => {
      if (!openRegister?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          order:orders!inner(
            id, customer_name, table_id, total,
            table:tables(number)
          ),
          received_by_profile:profiles!payments_received_by_fkey(id, name)
        `)
        .eq('is_partial', true)
        .eq('cash_register_id', openRegister.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!openRegister?.id,
  });

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('cash_register_view')) {
    return <AccessDenied permission="cash_register_view" />;
  }

  // Calculate totals for the open register
  const calculateTotals = () => {
    if (!openRegister) return { cash: 0, card: 0, pix: 0, total: 0 };
    
    const cashMovementsTotal = movements?.reduce((sum, m) => {
      if (m.movement_type === 'supply') return sum + Number(m.amount);
      if (m.movement_type === 'withdrawal') return sum - Number(m.amount);
      return sum;
    }, 0) || 0;

    return {
      opening: Number(openRegister.opening_amount),
      movements: cashMovementsTotal,
      expected: Number(openRegister.opening_amount) + cashMovementsTotal,
    };
  };

  const totals = calculateTotals();

  // Cash movement mutation
  const addCashMovement = useMutation({
    mutationFn: async ({ type, amount, reason }: { type: 'withdrawal' | 'supply'; amount: number; reason: string }) => {
      if (!openRegister) throw new Error('Caixa não está aberto');
      
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: openRegister.id,
          movement_type: type,
          amount,
          reason,
          created_by: userData.user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['open-cash-register'] });
      toast({ title: movementType === 'withdrawal' ? 'Sangria registrada!' : 'Suprimento registrado!' });
      setIsMovementDialogOpen(false);
      setMovementAmount('');
      setMovementReason('');
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenRegister = async () => {
    const amount = parseFloat(openingAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    await openCashRegister.mutateAsync(amount);
    setIsOpenDialogOpen(false);
    setOpeningAmount('');
  };

  const handleCloseRegister = async () => {
    if (!openRegister) return;
    const amount = parseFloat(closingAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    await closeCashRegister.mutateAsync({ id: openRegister.id, closingAmount: amount });
    setIsCloseDialogOpen(false);
    setClosingAmount('');
  };

  const handleMovement = async () => {
    const amount = parseFloat(movementAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (!movementReason.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }
    await addCashMovement.mutateAsync({ type: movementType, amount, reason: movementReason });
  };

  const handlePayment = async () => {
    if (!selectedOrder || !openRegister) return;
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    await createPayment.mutateAsync({
      order_id: selectedOrder.id,
      payment_method: paymentMethod,
      amount,
      cash_register_id: openRegister.id
    });
    setIsPaymentDialogOpen(false);
    setSelectedOrder(null);
    setPaymentAmount('');
  };

  const selectOrderForPayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentAmount(String(order.total));
    setIsPaymentDialogOpen(true);
  };

  if (isLoading) {
    return (
      <PDVLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PDVLayout>
    );
  }

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Caixa</h1>
            <p className="text-muted-foreground">
              {openRegister ? 'Caixa aberto - Receba pagamentos e gerencie o fluxo' : 'Abra o caixa para iniciar'}
            </p>
          </div>
          
          {!openRegister ? (
            <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2" disabled={!canOpenCash && !canManage}>
                  <Unlock className="h-5 w-5" />
                  Abrir Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abrir Caixa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Valor Inicial (Fundo de Troco)</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleOpenRegister} disabled={openCashRegister.isPending}>
                    Confirmar Abertura
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="lg" className="gap-2" disabled={!canCloseCash && !canManage}>
                  <Lock className="h-5 w-5" />
                  Fechar Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fechar Caixa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Valor de Abertura:</span>
                      <span className="font-medium">{formatCurrency(totals.opening)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Movimentações:</span>
                      <span className={cn("font-medium", totals.movements >= 0 ? "text-accent" : "text-destructive")}>
                        {totals.movements >= 0 ? '+' : ''}{formatCurrency(totals.movements)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Valor Esperado:</span>
                      <span className="font-bold text-primary">{formatCurrency(totals.expected)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Contado</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                    />
                  </div>
                  {closingAmount && (
                    <div className={cn(
                      "p-3 rounded-lg text-center",
                      parseFloat(closingAmount.replace(',', '.')) === totals.expected 
                        ? "bg-accent/20 text-accent" 
                        : "bg-destructive/20 text-destructive"
                    )}>
                      Diferença: {formatCurrency(parseFloat(closingAmount.replace(',', '.') || '0') - totals.expected)}
                    </div>
                  )}
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={handleCloseRegister} 
                    disabled={closeCashRegister.isPending}
                  >
                    Confirmar Fechamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {openRegister ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Status Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Abertura</p>
                        <p className="text-xl font-bold">{formatCurrency(totals.opening)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-info/10 rounded-lg">
                        <Receipt className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Movimentações</p>
                        <p className={cn("text-xl font-bold", totals.movements >= 0 ? "text-accent" : "text-destructive")}>
                          {totals.movements >= 0 ? '+' : ''}{formatCurrency(totals.movements)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Esperado</p>
                        <p className="text-xl font-bold text-accent">{formatCurrency(totals.expected)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Ready for Payment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pedidos Prontos para Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  {readyOrders && readyOrders.length > 0 ? (
                    <div className="space-y-2">
                      {readyOrders.map((order) => (
                        <div 
                          key={order.id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div>
                            <p className="font-medium">
                              {order.table?.number ? `Mesa ${order.table.number}` : 
                               order.customer_name || `#${order.id.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.order_items?.length || 0} itens
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                            <Button size="sm" onClick={() => selectOrderForPayment(order)}>
                              Receber
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum pedido pronto para pagamento
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Movements History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movimentações do Caixa</CardTitle>
                </CardHeader>
                <CardContent>
                  {movements && movements.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {movements.map((m) => (
                        <div 
                          key={m.id} 
                          className="flex items-center justify-between p-3 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            {m.movement_type === 'supply' ? (
                              <ArrowUpCircle className="h-5 w-5 text-accent" />
                            ) : (
                              <ArrowDownCircle className="h-5 w-5 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium">
                                {m.movement_type === 'supply' ? 'Suprimento' : 'Sangria'}
                              </p>
                              <p className="text-sm text-muted-foreground">{m.reason}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "font-bold",
                            m.movement_type === 'supply' ? "text-accent" : "text-destructive"
                          )}>
                            {m.movement_type === 'supply' ? '+' : '-'}{formatCurrency(Number(m.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      Nenhuma movimentação registrada
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Partial Payments History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pagamentos Parciais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {partialPayments && partialPayments.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {partialPayments.map((p: any) => {
                        const Icon = paymentMethodConfig[p.payment_method as PaymentMethod]?.icon || DollarSign;
                        return (
                          <div 
                            key={p.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {p.order?.table?.number 
                                    ? `Mesa ${p.order.table.number}` 
                                    : p.order?.customer_name || `Pedido #${p.order_id.slice(0, 6)}`}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {paymentMethodConfig[p.payment_method as PaymentMethod]?.label || p.payment_method}
                                </p>
                                {p.received_by_profile?.name && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Recebido por: {p.received_by_profile.name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary">
                                {formatCurrency(Number(p.amount))}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                de {formatCurrency(Number(p.order?.total || 0))}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      Nenhum pagamento parcial registrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actions Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
                    {(canWithdraw || canManage) && (
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMovementType('withdrawal')}
                        >
                          <ArrowDownCircle className="h-5 w-5 text-destructive" />
                          Sangria (Retirada)
                        </Button>
                      </DialogTrigger>
                    )}
                    {(canSupply || canManage) && (
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMovementType('supply')}
                        >
                          <ArrowUpCircle className="h-5 w-5 text-accent" />
                          Suprimento (Entrada)
                        </Button>
                      </DialogTrigger>
                    )}
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {movementType === 'withdrawal' ? 'Registrar Sangria' : 'Registrar Suprimento'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Valor</Label>
                          <Input
                            type="text"
                            placeholder="0,00"
                            value={movementAmount}
                            onChange={(e) => setMovementAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Motivo</Label>
                          <Textarea
                            placeholder={movementType === 'withdrawal' 
                              ? "Ex: Pagamento de fornecedor" 
                              : "Ex: Reforço de troco"}
                            value={movementReason}
                            onChange={(e) => setMovementReason(e.target.value)}
                          />
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={handleMovement}
                          disabled={addCashMovement.isPending}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Caixa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aberto em:</span>
                    <span>{new Date(openRegister.opened_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID do Caixa:</span>
                    <span className="font-mono">#{openRegister.id.slice(0, 8)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Caixa Fechado</h2>
              <p className="text-muted-foreground mb-6">
                Abra o caixa para começar a receber pagamentos e gerenciar o fluxo de dinheiro.
              </p>
              <Button size="lg" onClick={() => setIsOpenDialogOpen(true)}>
                <Unlock className="h-5 w-5 mr-2" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receber Pagamento</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 pt-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Pedido</p>
                  <p className="font-semibold">
                    {selectedOrder.table?.number ? `Mesa ${selectedOrder.table.number}` : 
                     selectedOrder.customer_name || `#${selectedOrder.id.slice(0, 8)}`}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    {formatCurrency(selectedOrder.total)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(paymentMethodConfig) as [PaymentMethod, typeof paymentMethodConfig[PaymentMethod]][]).map(([method, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={method}
                          variant={paymentMethod === method ? "default" : "outline"}
                          className="h-auto py-3 flex flex-col items-center gap-1"
                          onClick={() => setPaymentMethod(method)}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{config.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor Recebido</Label>
                  <Input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                {paymentMethod === 'cash' && paymentAmount && (
                  <div className="bg-accent/10 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="text-xl font-bold text-accent">
                      {formatCurrency(Math.max(0, parseFloat(paymentAmount.replace(',', '.') || '0') - selectedOrder.total))}
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handlePayment}
                  disabled={createPayment.isPending}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Confirmar Pagamento
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PDVLayout>
  );
}
