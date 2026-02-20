import { useKdsSettings } from '@/hooks/useKdsSettings';
import { getBadgeColorClasses } from '@/lib/badgeColors';
import { cn } from '@/lib/utils';

interface OrderItemExtra {
  extra_name: string;
  price?: number;
  kds_category?: string;
}

interface KdsItemBadgesProps {
  notes?: string | null;
  extras?: OrderItemExtra[];
  compact?: boolean;
}

// Extrair informação da borda dos extras usando kds_category
const getBorderInfo = (
  extras?: OrderItemExtra[],
  hasSpecialBorder?: (text: string) => boolean,
  highlightEnabled?: boolean
): { text: string; shouldHighlight: boolean } | null => {
  if (!extras || extras.length === 0) return null;
  
  // Primeiro tentar por kds_category
  const borderExtra = extras.find(e => e.kds_category === 'border');
  
  // Fallback: buscar por texto (compatibilidade com pedidos antigos)
  const fallbackBorderExtra = !borderExtra ? extras.find(e => {
    const lower = e.extra_name.toLowerCase();
    return lower.includes('borda') || lower.includes('massa');
  }) : null;
  
  const selectedExtra = borderExtra || fallbackBorderExtra;
  if (!selectedExtra) return null;
  
  // "Massa & Borda: Borda de Chocolate" → "Borda de Chocolate"
  const parts = selectedExtra.extra_name.split(':');
  const borderText = parts.length > 1 ? parts[1].trim() : selectedExtra.extra_name;
  
  // Se encontrou por kds_category, sempre destacar
  if (borderExtra) {
    return { text: borderText, shouldHighlight: true };
  }
  
  // Fallback: verificar por palavras-chave configuradas
  const shouldHighlight = highlightEnabled && hasSpecialBorder 
    ? hasSpecialBorder(borderText) 
    : false;
  
  return { text: borderText, shouldHighlight };
};

// Extrair sabores dos extras usando kds_category
export const getFlavorsFromExtras = (extras?: OrderItemExtra[]): string[] => {
  if (!extras || extras.length === 0) return [];
  
  // Primeiro tentar por kds_category
  const flavorExtras = extras.filter(e => e.kds_category === 'flavor');
  
  if (flavorExtras.length > 0) {
    return flavorExtras.map(e => {
      const parts = e.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : e.extra_name;
    });
  }
  
  // Fallback: buscar por texto (compatibilidade com pedidos antigos)
  return extras
    .filter(e => {
      const lower = e.extra_name.toLowerCase();
      return lower.includes('sabor') && !lower.includes('borda') && !lower.includes('massa');
    })
    .map(e => {
      const parts = e.extra_name.split(':');
      return parts.length > 1 ? parts[1].trim() : e.extra_name;
    });
};

/**
 * Componente reutilizável para exibir tarjas de borda e observações
 * em itens de pedido. Exibe badges animados com cores configuráveis.
 */
export function KdsItemBadges({ notes, extras, compact = false }: KdsItemBadgesProps) {
  const { settings, hasSpecialBorder } = useKdsSettings();
  
  const borderInfo = getBorderInfo(extras, hasSpecialBorder, settings.highlightSpecialBorders);
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  // Mostra borda se shouldHighlight for true
  const showBorder = borderInfo?.shouldHighlight;
  
  if (!showBorder && !notes) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <div className={cn("flex flex-col gap-1", compact ? "mt-0.5" : "mt-1")}>
      {showBorder && borderInfo && (
        <span className={cn(
          "inline-flex items-center rounded font-bold animate-pulse bg-orange-600 text-white",
          compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
        )}>
          🟡 {borderInfo.text}
        </span>
      )}
      
      {notes && (
        <span className={cn(
          "inline-flex items-center rounded font-bold animate-pulse bg-red-600 text-white",
          compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
        )}>
          ⚠️ OBS: {notes}
        </span>
      )}
    </div>
  );
}

/**
 * Exibe apenas o badge de borda (para uso em locais com espaço limitado)
 */
export function KdsBorderOnlyBadge({ extras, compact = false }: { extras?: OrderItemExtra[]; compact?: boolean }) {
  const { settings, hasSpecialBorder } = useKdsSettings();
  
  const borderInfo = getBorderInfo(extras, hasSpecialBorder, settings.highlightSpecialBorders);
  const borderColors = getBadgeColorClasses(settings.borderBadgeColor);
  
  if (!borderInfo?.shouldHighlight) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span className={cn(
      "inline-flex items-center rounded font-bold animate-pulse bg-orange-600 text-white",
      compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
    )}>
      🟡 {borderInfo.text}
    </span>
  );
}

/**
 * Exibe apenas o badge de observações (para uso em locais com espaço limitado)
 */
export function KdsNotesOnlyBadge({ notes, compact = false }: { notes?: string | null; compact?: boolean }) {
  const { settings } = useKdsSettings();
  
  const notesColors = getBadgeColorClasses(settings.notesBadgeColor);
  
  if (!notes) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span className={cn(
      "inline-flex items-center rounded font-bold animate-pulse bg-red-600 text-white",
      compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-sm"
    )}>
      ⚠️ OBS: {notes}
    </span>
  );
}

export { getBorderInfo };
