import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingOperations } = useOfflineSupport();

  if (isOnline && pendingOperations.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/50">
              <Wifi className="h-4 w-4 text-accent-foreground" />
              <span className="text-xs text-accent-foreground hidden sm:inline">Online</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Conexão estável</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isOnline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/20">
              <WifiOff className="h-4 w-4 text-destructive" />
              <span className="text-xs text-destructive hidden sm:inline">Offline</span>
              {pendingOperations.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {pendingOperations.length}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sem conexão com internet</p>
            {pendingOperations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pendingOperations.length} operação(ões) pendente(s)
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Online but has pending operations
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/20">
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 text-warning animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs text-warning hidden sm:inline">
              {isSyncing ? 'Sincronizando...' : 'Pendente'}
            </span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-warning text-warning">
              {pendingOperations.length}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSyncing ? 'Sincronizando dados...' : 'Operações pendentes'}</p>
          <p className="text-xs text-muted-foreground">
            {pendingOperations.length} operação(ões) aguardando sync
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
