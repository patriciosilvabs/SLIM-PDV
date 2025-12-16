import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { SyncProgressDialog } from "./SyncProgressDialog";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";

export function OfflineIndicator() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    triggerSync,
    clearQueue 
  } = useOfflineSyncContext();
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: "Offline",
        description: "Sem conexão com a internet. Operações serão salvas localmente.",
        variant: "destructive" as const,
        iconClass: "text-destructive"
      };
    }
    
    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: "Sincronizando...",
        description: "Enviando operações pendentes para o servidor.",
        variant: "secondary" as const,
        iconClass: "text-primary animate-spin"
      };
    }
    
    if (pendingOperations.length > 0) {
      return {
        icon: AlertCircle,
        label: "Pendente",
        description: `${pendingOperations.length} operação(ões) aguardando sincronização.`,
        variant: "secondary" as const,
        iconClass: "text-yellow-500"
      };
    }
    
    return {
      icon: CheckCircle2,
      label: "Online",
      description: "Conectado e sincronizado.",
      variant: "outline" as const,
      iconClass: "text-green-500"
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-9"
              onClick={() => pendingOperations.length > 0 && setDialogOpen(true)}
            >
              <Icon className={`h-4 w-4 ${config.iconClass}`} />
              <span className="hidden sm:inline text-xs">{config.label}</span>
              {pendingOperations.length > 0 && (
                <Badge variant={config.variant} className="h-5 px-1.5 text-xs">
                  {pendingOperations.length}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{config.description}</p>
            {pendingOperations.length > 0 && isOnline && !isSyncing && (
              <p className="text-xs text-muted-foreground mt-1">
                Clique para ver detalhes
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SyncProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendingOperations={pendingOperations}
        isSyncing={isSyncing}
        onSync={triggerSync}
        onClear={clearQueue}
      />
    </>
  );
}
