import { useEffect, useRef, useCallback } from 'react';
import { useBottleneckAnalysis, BottleneckInfo } from './useKdsStationLogs';
import { useAudioNotification } from './useAudioNotification';
import { useKdsSettings } from './useKdsSettings';
import { toast } from 'sonner';

const BOTTLENECK_ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutos entre alertas

interface AlertedBottleneck {
  stationId: string;
  severity: BottleneckInfo['severity'];
  alertedAt: number;
}

export function useBottleneckAlerts(enabled: boolean = true, soundEnabled: boolean = true) {
  const { settings } = useKdsSettings();
  const { bottleneckSettings } = settings;
  
  // Pass configured thresholds to the analysis hook
  const { data: bottlenecks } = useBottleneckAnalysis(
    bottleneckSettings.enabled ? {
      defaultMaxQueueSize: bottleneckSettings.defaultMaxQueueSize,
      defaultMaxTimeRatio: bottleneckSettings.defaultMaxTimeRatio,
      stationOverrides: bottleneckSettings.stationOverrides,
    } : undefined
  );
  
  const { playBottleneckAlertSound, settings: audioSettings } = useAudioNotification();
  const alertedBottlenecksRef = useRef<Map<string, AlertedBottleneck>>(new Map());
  const lastCriticalAlertRef = useRef<number>(0);

  const shouldAlertBottleneck = useCallback((bottleneck: BottleneckInfo): boolean => {
    const now = Date.now();
    const existing = alertedBottlenecksRef.current.get(bottleneck.stationId);

    // Se nunca alertou, pode alertar
    if (!existing) return true;

    // Se a severidade aumentou, pode alertar novamente
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    if (severityOrder[bottleneck.severity] > severityOrder[existing.severity]) {
      return true;
    }

    // Se passou o cooldown, pode alertar novamente
    if (now - existing.alertedAt > BOTTLENECK_ALERT_COOLDOWN) {
      return true;
    }

    return false;
  }, []);

  const triggerAlert = useCallback((bottleneck: BottleneckInfo) => {
    const now = Date.now();

    // Atualiza registro do alerta
    alertedBottlenecksRef.current.set(bottleneck.stationId, {
      stationId: bottleneck.stationId,
      severity: bottleneck.severity,
      alertedAt: now,
    });

    // Toast visual
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const severityLabel = {
      critical: 'CRÍTICO',
      high: 'ALTO',
      medium: 'MODERADO',
      low: 'BAIXO',
    };

    toast.warning(
      `${severityEmoji[bottleneck.severity]} Gargalo ${severityLabel[bottleneck.severity]}: ${bottleneck.stationName}`,
      {
        description: bottleneck.reason,
        duration: bottleneck.severity === 'critical' ? 10000 : 5000,
        id: `bottleneck-${bottleneck.stationId}`,
      }
    );

    // Som apenas para severidades críticas/altas e respeitando cooldown global
    if (
      soundEnabled &&
      audioSettings.enabled &&
      (bottleneck.severity === 'critical' || bottleneck.severity === 'high') &&
      now - lastCriticalAlertRef.current > 30000 // 30s entre sons
    ) {
      playBottleneckAlertSound();
      lastCriticalAlertRef.current = now;
    }
  }, [soundEnabled, audioSettings.enabled, playBottleneckAlertSound]);

  useEffect(() => {
    if (!enabled || !bottleneckSettings.enabled || !bottlenecks || bottlenecks.length === 0) return;

    // Processa gargalos críticos e altos
    const significantBottlenecks = bottlenecks.filter(
      b => b.severity === 'critical' || b.severity === 'high'
    );

    significantBottlenecks.forEach(bottleneck => {
      if (shouldAlertBottleneck(bottleneck)) {
        triggerAlert(bottleneck);
      }
    });

    // Limpa alertas antigos para praças que não são mais gargalos
    const currentBottleneckIds = new Set(bottlenecks.map(b => b.stationId));
    alertedBottlenecksRef.current.forEach((_, stationId) => {
      if (!currentBottleneckIds.has(stationId)) {
        alertedBottlenecksRef.current.delete(stationId);
      }
    });
  }, [enabled, bottleneckSettings.enabled, bottlenecks, shouldAlertBottleneck, triggerAlert]);

  return {
    bottlenecks,
    hasActiveAlerts: bottlenecks && bottlenecks.some(b => b.severity === 'critical' || b.severity === 'high'),
    criticalCount: bottlenecks?.filter(b => b.severity === 'critical').length || 0,
    highCount: bottlenecks?.filter(b => b.severity === 'high').length || 0,
  };
}
