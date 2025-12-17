import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { usePrinter } from '@/contexts/PrinterContext';
import { useOrderSettings, PrintFontSize } from '@/hooks/useOrderSettings';
import {
  Printer, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle, 
  Download,
  Loader2,
  Wifi,
  WifiOff,
  TestTube,
  ChefHat,
  CreditCard,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PrinterSettings() {
  const printer = usePrinter();
  const { toast } = useToast();
  const { 
    autoPrintKitchenTicket, 
    toggleAutoPrintKitchenTicket,
    autoPrintCustomerReceipt,
    toggleAutoPrintCustomerReceipt,
    printFontSize,
    updatePrintFontSize
  } = useOrderSettings();
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);

  const handleConnect = async () => {
    const success = await printer.connect();
    if (success) {
      toast({
        title: 'Conectado!',
        description: 'QZ Tray conectado com sucesso.',
      });
    } else {
      toast({
        title: 'Erro ao conectar',
        description: printer.error || 'Não foi possível conectar ao QZ Tray.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    await printer.disconnect();
    toast({
      title: 'Desconectado',
      description: 'QZ Tray desconectado.',
    });
  };

  const handleRefreshPrinters = async () => {
    const printers = await printer.refreshPrinters();
    if (printers.length > 0) {
      toast({
        title: 'Impressoras atualizadas',
        description: `${printers.length} impressora(s) encontrada(s).`,
      });
    } else {
      toast({
        title: 'Nenhuma impressora',
        description: 'Nenhuma impressora foi encontrada.',
        variant: 'destructive',
      });
    }
  };

  const handleTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      await printer.testPrint(printerName);
      toast({
        title: 'Teste enviado!',
        description: `Página de teste enviada para ${printerName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro no teste',
        description: err?.message || 'Falha ao enviar teste.',
        variant: 'destructive',
      });
    } finally {
      setTestingPrinter(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Impressoras (QZ Tray)
        </CardTitle>
        <CardDescription>
          Configure impressoras térmicas para impressão silenciosa de comandas e recibos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            {printer.isConnected ? (
              <div className="p-2 rounded-full bg-green-500/20">
                <Wifi className="w-5 h-5 text-green-500" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-muted">
                <WifiOff className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="font-medium">
                Status: {printer.isConnected ? 'Conectado' : 'Desconectado'}
              </div>
              <div className="text-sm text-muted-foreground">
                {printer.isConnected 
                  ? `${printer.printers.length} impressora(s) disponível(is)`
                  : 'Clique em Conectar para iniciar'}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {printer.isConnected ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshPrinters}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDisconnect}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={printer.isConnecting}
              >
                {printer.isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4 mr-2" />
                )}
                Conectar
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {printer.error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{printer.error}</AlertDescription>
          </Alert>
        )}

        {/* Download QZ Tray */}
        {!printer.isConnected && (
          <Alert>
            <Download className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                QZ Tray precisa estar instalado e em execução no computador.
              </span>
              <Button 
                variant="link" 
                className="p-0 h-auto"
                onClick={() => window.open('https://qz.io/download/', '_blank')}
              >
                Baixar QZ Tray
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Printer Configuration */}
        {printer.isConnected && (
          <div className="space-y-4">
            {/* Paper Width */}
            <div className="space-y-2">
              <Label>Largura do Papel</Label>
              <Select
                value={printer.config.paperWidth}
                onValueChange={(value: '58mm' | '80mm') => printer.updateConfig({ paperWidth: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (bobina pequena)</SelectItem>
                  <SelectItem value="80mm">80mm (bobina padrão)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label>Tamanho da Fonte</Label>
              <Select
                value={printFontSize}
                onValueChange={(value: PrintFontSize) => updatePrintFontSize(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Grande (altura 2x)</SelectItem>
                  <SelectItem value="extra_large">Extra Grande (2x)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ajusta o tamanho do texto nas impressões térmicas
              </p>
            </div>

            {/* Kitchen Printer */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ChefHat className="w-4 h-4" />
                Impressora da Cozinha
              </Label>
              <div className="flex gap-2">
                <Select
                  value={printer.config.kitchenPrinter || '__none__'}
                  onValueChange={(value) => printer.updateConfig({ kitchenPrinter: value === '__none__' ? null : value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {printer.printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printer.config.kitchenPrinter && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleTestPrint(printer.config.kitchenPrinter!)}
                    disabled={testingPrinter === printer.config.kitchenPrinter}
                  >
                    {testingPrinter === printer.config.kitchenPrinter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para imprimir comandas na cozinha
              </p>
            </div>

            {/* Cashier Printer */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Impressora do Caixa
              </Label>
              <div className="flex gap-2">
                <Select
                  value={printer.config.cashierPrinter || '__none__'}
                  onValueChange={(value) => printer.updateConfig({ cashierPrinter: value === '__none__' ? null : value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {printer.printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printer.config.cashierPrinter && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleTestPrint(printer.config.cashierPrinter!)}
                    disabled={testingPrinter === printer.config.cashierPrinter}
                  >
                    {testingPrinter === printer.config.cashierPrinter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para imprimir recibos do cliente e abrir gaveta
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="flex gap-2 pt-2">
              <Badge variant={printer.canPrintToKitchen ? 'default' : 'secondary'}>
                {printer.canPrintToKitchen ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Cozinha
              </Badge>
              <Badge variant={printer.canPrintToCashier ? 'default' : 'secondary'}>
                {printer.canPrintToCashier ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Caixa
              </Badge>
            </div>

            {/* Auto Print Settings */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Impressão Automática
              </Label>
              
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">Imprimir comanda automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Imprime na cozinha quando itens são adicionados ao pedido
                  </p>
                </div>
                <Switch 
                  checked={autoPrintKitchenTicket}
                  onCheckedChange={toggleAutoPrintKitchenTicket}
                  disabled={!printer.canPrintToKitchen}
                />
              </div>
              
              {!printer.canPrintToKitchen && autoPrintKitchenTicket && (
                <p className="text-xs text-amber-600">
                  ⚠️ Configure a impressora da cozinha para ativar a impressão automática
                </p>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">Imprimir recibo automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Imprime recibo do cliente após confirmação do pagamento
                  </p>
                </div>
                <Switch 
                  checked={autoPrintCustomerReceipt}
                  onCheckedChange={toggleAutoPrintCustomerReceipt}
                  disabled={!printer.canPrintToCashier}
                />
              </div>
              
              {!printer.canPrintToCashier && autoPrintCustomerReceipt && (
                <p className="text-xs text-amber-600">
                  ⚠️ Configure a impressora do caixa para ativar a impressão automática
                </p>
              )}
            </div>
          </div>
        )}

        {/* Available Printers List */}
        {printer.isConnected && printer.printers.length > 0 && (
          <div className="space-y-2">
            <Label>Impressoras Disponíveis</Label>
            <div className="rounded-lg border divide-y">
              {printer.printers.map((p) => (
                <div key={p} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{p}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestPrint(p)}
                    disabled={testingPrinter === p}
                  >
                    {testingPrinter === p ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Testar'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
