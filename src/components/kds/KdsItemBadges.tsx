import { useKdsSettings } from '@/hooks/useKdsSettings';
import { getBadgeColorClasses } from '@/lib/badgeColors';
import { cn } from '@/lib/utils';

interface OrderItemExtra {
  extra_name: string;
  price?: number;
}

interface KdsItemBadgesProps {
  notes?: string | null;
  extras?: OrderItemExtra[];
  compact?: boolean;
}

// Extrair informação da borda dos extras e verificar se deve destacar
const getBorderInfo = (
  extras?: OrderItemExtra[],
  hasSpecialBorder?: (text: string) => boolean,
  highlightEnabled?: boolean
): { text: string; shouldHighlight: boolean } | null => {
  if (!extras || extras.length === 0) return null;
  
  // Encontrar extra que contém "borda" ou "massa" (para extrair o nome)
  const borderExtra = extras.find(e => {
    const lower = e.extra_name.toLowerCase();
    return lower.includes('borda') || lower.includes('massa');
  });
  
  if (!borderExtra) return null;
  
  // "Massa & Borda: Borda de Chocolate" → "Borda de Chocolate"
  const parts = borderExtra.extra_name.split(':');
  const borderText = parts.length > 1 ? parts[1].trim() : borderExtra.extra_name;
  
  // Verificar se deve destacar baseado nas palavras-chave configuradas
  const shouldHighlight = highlightEnabled && hasSpecialBorder 
    ? hasSpecialBorder(borderText) 
    : false;
  
  return { text: borderText, shouldHighlight };
};

// Extrair sabores dos extras (exclui bordas)
export const getFlavorsFromExtras = (extras?: OrderItemExtra[]): string[] => {
  if (!extras || extras.length === 0) return [];
  
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
  
  // Só mostra borda se houver E se deveria destacar
  const showBorder = borderInfo?.shouldHighlight;
  
  if (!showBorder && !notes) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "mt-0.5" : "mt-1")}>
      {/* Badge de borda - só aparece se shouldHighlight for true */}
      {showBorder && borderInfo && (
        <span className={cn(
          "inline-flex rounded font-bold relative overflow-hidden animate-pulse",
          sizeClasses
        )}>
          <span className={cn("absolute inset-0", borderColors.bg)}></span>
          <span className={cn("relative z-10", borderColors.text)}>🟡 {borderInfo.text}</span>
        </span>
      )}
      
      {/* Badge de observações - SEMPRE pisca */}
      {notes && (
        <span className={cn(
          "inline-flex rounded font-bold relative overflow-hidden animate-pulse",
          sizeClasses
        )}>
          <span className={cn("absolute inset-0", notesColors.bg)}></span>
          <span className={cn("relative z-10", notesColors.text)}>📝 {notes}</span>
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
  
  // Só mostra se shouldHighlight for true
  if (!borderInfo?.shouldHighlight) {
    return null;
  }
  
  const sizeClasses = compact 
    ? "px-1.5 py-0.5 text-[10px]" 
    : "px-2 py-1 text-xs";

  return (
    <span className={cn(
      "inline-flex rounded font-bold relative overflow-hidden animate-pulse",
      sizeClasses
    )}>
      <span className={cn("absolute inset-0", borderColors.bg)}></span>
      <span className={cn("relative z-10", borderColors.text)}>🟡 {borderInfo.text}</span>
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
      "inline-flex rounded font-bold relative overflow-hidden animate-pulse",
      sizeClasses
    )}>
      <span className={cn("absolute inset-0", notesColors.bg)}></span>
      <span className={cn("relative z-10", notesColors.text)}>📝 {notes}</span>
    </span>
  );
}

export { getBorderInfo };
