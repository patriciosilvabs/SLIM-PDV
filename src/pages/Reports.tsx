import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSalesReport, useProductsReport, usePeakHoursAnalysis, useCashRegisterHistory, DateRange, getDateRange } from '@/hooks/useReports';
import { useCancellationHistory, useCancellationSummary } from '@/hooks/useCancellationHistory';
import { useEmployees } from '@/hooks/useEmployees';
import { useTableSwitches } from '@/hooks/useTableSwitches';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  CalendarIcon, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign,
  Clock,
  Receipt,
  ArrowRightLeft,
  User,
  Ban,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  pix: 'PIX'
};

export default function Reports() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState('');

  const { data: employees } = useEmployees();
  const employeeId = selectedEmployee === 'all' ? undefined : selectedEmployee;

  const { data: salesReport, isLoading: salesLoading } = useSalesReport(dateRange, customStart, customEnd, employeeId);
  const { data: productsReport, isLoading: productsLoading } = useProductsReport(dateRange, customStart, customEnd, employeeId);
  const { data: peakHours, isLoading: peakLoading } = usePeakHoursAnalysis(dateRange, customStart, customEnd);
  const { data: cashHistory } = useCashRegisterHistory();
  
  const { start, end } = getDateRange(dateRange, customStart, customEnd);
  const { data: tableSwitches } = useTableSwitches(start, end);
  
  // Cancellation history
  const { data: cancellations = [] } = useCancellationHistory({
    dateFrom: start,
    dateTo: end,
    reason: reasonFilter || undefined,
  });
  const cancellationSummary = useCancellationSummary(cancellations);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('reports_view')) {
    return <AccessDenied permission="reports_view" />;
  }

  // Prepare peak hours heat map data
  const peakHoursGrid = () => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    peakHours?.forEach(p => {
      grid[p.dayOfWeek][p.hour] = p.orderCount;
    });
    return grid;
  };

  const maxOrders = Math.max(...(peakHours?.map(p => p.orderCount) || [1]));

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">
              {format(start, "dd/MM/yyyy", { locale: ptBR })} - {format(end, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap items-center">
            {/* Employee Filter */}
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {employees?.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {(['today', 'yesterday', 'week', 'month'] as DateRange[]).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === 'today' ? 'Hoje' :
                 range === 'yesterday' ? 'Ontem' :
                 range === 'week' ? 'Semana' : 'Mês'}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={dateRange === 'custom' ? "default" : "outline"} size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Período
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customStart, to: customEnd }}
                  onSelect={(range) => {
                    setCustomStart(range?.from);
                    setCustomEnd(range?.to);
                    if (range?.from && range?.to) {
                      setDateRange('custom');
                    }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="sales">Vendas</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="peak">Horários de Pico</TabsTrigger>
            <TabsTrigger value="cash">Histórico de Caixa</TabsTrigger>
            <TabsTrigger value="switches">Trocas de Mesa</TabsTrigger>
            <TabsTrigger value="cancellations">Cancelamentos</TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="mt-4 space-y-6">
            {/* KPIs */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Vendas</p>
                      <p className="text-2xl font-bold">{formatCurrency(salesReport?.totalSales || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <ShoppingBag className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pedidos</p>
                      <p className="text-2xl font-bold">{salesReport?.totalOrders || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-info/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold">{formatCurrency(salesReport?.averageTicket || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Sales by Day Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesReport?.salesByDay || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => format(new Date(v), 'dd/MM')}
                        />
                        <YAxis tickFormatter={(v) => `R$${v}`} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(v) => format(new Date(v), 'dd/MM/yyyy')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Formas de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesReport?.salesByPaymentMethod?.map(p => ({
                            ...p,
                            name: paymentMethodLabels[p.method] || p.method
                          })) || []}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {salesReport?.salesByPaymentMethod?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center mt-4">
                    {salesReport?.salesByPaymentMethod?.map((p, i) => (
                      <div key={p.method} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[i % COLORS.length] }} 
                        />
                        <span className="text-sm">
                          {paymentMethodLabels[p.method]}: {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Products Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Produtos Mais Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={productsReport?.slice(0, 10) || []}
                        layout="vertical"
                        margin={{ left: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={90}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === 'quantitySold' ? `${value} un` : formatCurrency(value),
                            name === 'quantitySold' ? 'Quantidade' : 'Faturamento'
                          ]}
                        />
                        <Bar dataKey="quantitySold" fill="hsl(var(--primary))" name="Quantidade" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Produto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Produto</th>
                          <th className="text-right py-2 font-medium">Qtd</th>
                          <th className="text-right py-2 font-medium">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsReport?.map((product, i) => (
                          <tr key={product.id} className="border-b last:border-0">
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                                <span className="font-medium">{product.name}</span>
                              </div>
                              {product.category && (
                                <span className="text-xs text-muted-foreground ml-7">
                                  {product.category}
                                </span>
                              )}
                            </td>
                            <td className="text-right py-2">{product.quantitySold}</td>
                            <td className="text-right py-2 font-medium">
                              {formatCurrency(product.totalRevenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Peak Hours Tab */}
          <TabsContent value="peak" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Mapa de Calor - Horários de Pico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    {/* Hours header */}
                    <div className="flex gap-1 mb-2">
                      <div className="w-12" />
                      {Array.from({ length: 24 }, (_, i) => (
                        <div 
                          key={i} 
                          className="flex-1 text-center text-xs text-muted-foreground"
                        >
                          {i}h
                        </div>
                      ))}
                    </div>
                    
                    {/* Grid */}
                    {DAYS.map((day, dayIndex) => (
                      <div key={day} className="flex gap-1 mb-1">
                        <div className="w-12 text-sm text-muted-foreground flex items-center">
                          {day}
                        </div>
                        {peakHoursGrid()[dayIndex].map((count, hour) => {
                          const intensity = count / maxOrders;
                          return (
                            <div
                              key={hour}
                              className="flex-1 h-8 rounded transition-colors cursor-default"
                              style={{
                                backgroundColor: count > 0 
                                  ? `hsl(var(--primary) / ${0.2 + intensity * 0.8})`
                                  : 'hsl(var(--muted))'
                              }}
                              title={`${day} ${hour}h: ${count} pedidos`}
                            />
                          );
                        })}
                      </div>
                    ))}

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 justify-center">
                      <span className="text-sm text-muted-foreground">Menos pedidos</span>
                      <div className="flex gap-1">
                        {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                          <div
                            key={intensity}
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: `hsl(var(--primary) / ${intensity})` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">Mais pedidos</span>
                    </div>
                  </div>
                </div>

                {/* Peak Summary */}
                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  {(() => {
                    const sorted = [...(peakHours || [])].sort((a, b) => b.orderCount - a.orderCount);
                    const topThree = sorted.slice(0, 3);
                    return topThree.map((p, i) => (
                      <Card key={i} className="bg-muted/50">
                        <CardContent className="p-3">
                          <p className="text-sm text-muted-foreground">
                            #{i + 1} Horário de Pico
                          </p>
                          <p className="font-semibold">
                            {DAYS[p.dayOfWeek]} às {p.hour}h
                          </p>
                          <p className="text-sm">
                            {p.orderCount} pedidos • {formatCurrency(p.totalSales)}
                          </p>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash History Tab */}
          <TabsContent value="cash" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Histórico de Caixas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashHistory?.map((register) => (
                    <div 
                      key={register.id}
                      className="p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">
                            Caixa #{register.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Aberto: {new Date(register.opened_at).toLocaleString('pt-BR')}
                          </p>
                          {register.closed_at && (
                            <p className="text-sm text-muted-foreground">
                              Fechado: {new Date(register.closed_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          register.status === 'open' 
                            ? "bg-accent text-accent-foreground" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {register.status === 'open' ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Abertura</p>
                          <p className="font-medium">{formatCurrency(Number(register.opening_amount))}</p>
                        </div>
                        {register.closing_amount !== null && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Fechamento</p>
                              <p className="font-medium">{formatCurrency(Number(register.closing_amount))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Esperado</p>
                              <p className="font-medium">{formatCurrency(Number(register.expected_amount || 0))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Diferença</p>
                              <p className={cn(
                                "font-medium",
                                Number(register.difference) === 0 ? "text-accent" :
                                Number(register.difference) > 0 ? "text-info" : "text-destructive"
                              )}>
                                {Number(register.difference) > 0 ? '+' : ''}{formatCurrency(Number(register.difference || 0))}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!cashHistory || cashHistory.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum histórico de caixa encontrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Table Switches Tab */}
          <TabsContent value="switches" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Histórico de Trocas de Mesa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tableSwitches?.map((sw) => (
                    <div 
                      key={sw.id}
                      className="p-4 bg-muted/50 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold">Mesa {sw.from_table?.number || '?'}</span>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">Mesa {sw.to_table?.number || '?'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(sw.switched_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {sw.switched_by_name && (
                          <p className="text-sm text-muted-foreground">
                            Por: {sw.switched_by_name}
                          </p>
                        )}
                        {sw.reason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Motivo: {sw.reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        Pedido #{sw.order_id.slice(0, 8)}
                      </div>
                    </div>
                  ))}
                  {(!tableSwitches || tableSwitches.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma troca de mesa registrada no período
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cancellations Tab */}
          <TabsContent value="cancellations" className="mt-4 space-y-6">
            {/* KPIs */}
            <div className="grid sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cancelados</p>
                      <p className="text-2xl font-bold">{cancellationSummary.totalCancellations}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Perdido</p>
                      <p className="text-2xl font-bold">{formatCurrency(cancellationSummary.totalValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="sm:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/10 rounded-lg">
                      <Ban className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Motivo Mais Comum</p>
                      <p className="text-lg font-medium truncate">{cancellationSummary.mostCommonReason}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Breakdown by Reason */}
              <Card>
                <CardHeader>
                  <CardTitle>Por Motivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {cancellationSummary.reasonBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={cancellationSummary.reasonBreakdown.map(([reason, count]) => ({
                              name: reason.length > 25 ? reason.substring(0, 25) + '...' : reason,
                              value: count
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          >
                            {cancellationSummary.reasonBreakdown.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhum cancelamento no período
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown by User */}
              <Card>
                <CardHeader>
                  <CardTitle>Por Responsável</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {cancellationSummary.userBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cancellationSummary.userBreakdown.slice(0, 5).map(([name, count]) => ({
                          name: name.split(' ')[0],
                          count
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhum cancelamento no período
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Table */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Histórico Detalhado</CardTitle>
                <Input
                  placeholder="Filtrar por motivo..."
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Cancelado Por</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancellations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum cancelamento no período selecionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        cancellations.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="whitespace-nowrap">
                              {record.cancelled_at 
                                ? format(new Date(record.cancelled_at), "dd/MM HH:mm", { locale: ptBR })
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {record.order_type === 'dine_in' ? `Mesa ${record.table_number || '?'}` :
                                 record.order_type === 'delivery' ? '🚚 Delivery' : '📦 Balcão'}
                              </Badge>
                            </TableCell>
                            <TableCell>{record.customer_name || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={record.cancellation_reason || ''}>
                              {record.cancellation_reason || '-'}
                            </TableCell>
                            <TableCell>{record.cancelled_by_name || 'Desconhecido'}</TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {formatCurrency(record.total || 0)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PDVLayout>
  );
}
