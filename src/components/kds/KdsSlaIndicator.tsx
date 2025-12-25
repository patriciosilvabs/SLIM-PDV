import { useMemo } from 'react';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { differenceInMinutes } from 'date-fns';

interface SlaIndicatorProps {
  createdAt: string;
  size?: 'sm' | 'md' | 'lg';
  showTime?: boolean;
}

export function KdsSlaIndicator({ createdAt, size = 'md', showTime = true }: SlaIndicatorProps) {
  const { getSlaColor } = useKdsSettings();

  const { minutesElapsed, color, bgClass, textClass } = useMemo(() => {
    const minutes = differenceInMinutes(new Date(), new Date(createdAt));
    const slaColor = getSlaColor(minutes);

    const colorMap = {
      green: {
        bg: 'bg-green-500',
        text: 'text-green-600',
        ring: 'ring-green-500/30',
      },
      yellow: {
        bg: 'bg-yellow-500',
        text: 'text-yellow-600',
        ring: 'ring-yellow-500/30',
      },
      red: {
        bg: 'bg-red-500 animate-pulse',
        text: 'text-red-600',
        ring: 'ring-red-500/30',
      },
    };

    return {
      minutesElapsed: minutes,
      color: slaColor,
      bgClass: colorMap[slaColor].bg,
      textClass: colorMap[slaColor].text,
      ringClass: colorMap[slaColor].ring,
    };
  }, [createdAt, getSlaColor]);

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-medium',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`rounded-full ${bgClass} ${sizeClasses[size]}`} />
      {showTime && (
        <span className={`${textSizeClasses[size]} ${textClass} tabular-nums`}>
          {minutesElapsed}min
        </span>
      )}
    </div>
  );
}
