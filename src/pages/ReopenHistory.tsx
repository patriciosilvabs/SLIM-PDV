import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useOrderReopens } from '@/hooks/useOrderReopens';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, RotateCcw, AlertTriangle, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  preparing: 'Em Preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Mesa',
  takeaway: 'Balcão',
  delivery: 'Delivery',
};

export default function ReopenHistory() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data: reopens, isLoading } = useOrderReopens(
    startOfDay(startDate),
    endOfDay(endDate)
  );

  // Statistics
  const stats = useMemo(() => {
    if (!reopens || reopens.length === 0) {
      return { total: 0, totalValue: 0, topUsers: [] };
    }

    const totalValue = reopens.reduce((sum, r) => sum + (r.total_value || 0), 0);
    
    // Count by user
    const userCounts: Record<string, { name: string; count: number }> = {};
    reopens.forEach(r => {
      if (r.reopened_by_name) {
        if (!userCounts[r.reopened_by_name]) {
          userCounts[r.reopened_by_name] = { name: r.reopened_by_name, count: 0 };
        }
        userCounts[r.reopened_by_name].count++;
      }
    });
    
    const topUsers = Object.values(userCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total: reopens.length, totalValue, topUsers };
  }, [reopens]);

  return (
    <PDVLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCcw className="h-6 w-6" />
              Histórico de Reaberturas
            </h1>
            <p className="text-muted-foreground">
              Auditoria de mesas e pedidos reabertos
            </p>
          </div>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: startDate, to: endDate }}
                  onSelect={(range) => {
                    if (range?.from) setStartDate(range.from);
                    if (range?.to) setEndDate(range.to);
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Reaberturas</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total Movimentado</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-lg">
                  <User className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Usuário</p>
                  <p className="text-xl font-bold">
                    {stats.topUsers[0]?.name || '-'}
                    {stats.topUsers[0] && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({stats.topUsers[0].count}x)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reaberturas no Período</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !reopens || reopens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma reabertura encontrada no período selecionado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Mesa</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status Anterior</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reopens.map((reopen) => (
                      <TableRow key={reopen.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(reopen.reopened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {orderTypeLabels[reopen.order_type || ''] || reopen.order_type || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reopen.table?.number ? `Mesa ${reopen.table.number}` : '-'}
                        </TableCell>
                        <TableCell>
                          {reopen.customer_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {statusLabels[reopen.previous_status] || reopen.previous_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {reopen.total_value ? formatCurrency(reopen.total_value) : '-'}
                        </TableCell>
                        <TableCell>
                          {reopen.reopened_by_name || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {reopen.reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Users */}
        {stats.topUsers.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Usuários que mais Reabriram</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topUsers.map((user, index) => (
                  <div key={user.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        index === 0 && "bg-yellow-500/20 text-yellow-500",
                        index === 1 && "bg-gray-400/20 text-gray-500",
                        index === 2 && "bg-amber-600/20 text-amber-600",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </span>
                      <span className="font-medium">{user.name}</span>
                    </div>
                    <Badge variant="outline">{user.count} reaberturas</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PDVLayout>
  );
}
