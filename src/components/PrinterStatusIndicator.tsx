import { Printer, PrinterCheck } from 'lucide-react';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function PrinterStatusIndicator() {
  const printer = usePrinterOptional();
  
  // Don't show if printer context not available
  if (!printer) return null;
  
  const isConnected = printer.isConnected;
  const hasKitchen = printer.canPrintToKitchen;
  const hasCashier = printer.canPrintToCashier;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-default",
            isConnected 
              ? "bg-green-500/20 text-green-600 dark:text-green-400" 
              : "bg-muted text-muted-foreground"
          )}>
            {isConnected ? (
              <PrinterCheck className="h-3.5 w-3.5" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isConnected ? 'QZ' : 'Offline'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">
              {isConnected ? 'QZ Tray Conectado' : 'QZ Tray Desconectado'}
            </p>
            {isConnected && (
              <>
                <p>Cozinha: {hasKitchen ? '✅ Configurada' : '❌ Não configurada'}</p>
                <p>Caixa: {hasCashier ? '✅ Configurada' : '❌ Não configurada'}</p>
              </>
            )}
            {!isConnected && (
              <p className="text-muted-foreground">
                Vá em Configurações → Impressoras
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
