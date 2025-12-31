import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface PersistentSettingsOptions<T> {
  /** Unique key for the setting in the database */
  settingsKey: string;
  /** Default values for the settings */
  defaults: T;
  /** Local storage key for caching (optional) */
  localStorageKey?: string;
  /** Version number for migration purposes */
  version?: number;
}

/**
 * Hook genérico para sincronizar configurações entre banco de dados e localStorage.
 * O banco de dados é a fonte de verdade, localStorage é usado como cache.
 * 
 * Comportamento:
 * 1. Carrega do banco de dados (fonte de verdade)
 * 2. Se não existir no banco, tenta localStorage
 * 3. Se encontrar em localStorage mas não no banco, migra para o banco
 * 4. Ao salvar, atualiza ambos simultaneamente
 * 5. Usa merge inteligente com 'in' operator para preservar valores explícitos
 */
export function usePersistentSettings<T extends Record<string, any>>({
  settingsKey,
  defaults,
  localStorageKey,
  version = 1,
}: PersistentSettingsOptions<T>) {
  const queryClient = useQueryClient();
  const migratedRef = useRef(false);
  const storageKey = localStorageKey || `pdv_${settingsKey}`;

  // Helper para merge inteligente - usa 'in' operator para preservar valores explícitos
  const smartMerge = useCallback((saved: Partial<T> | null, defaultValues: T): T => {
    if (!saved) return defaultValues;
    
    const result = { ...defaultValues };
    
    for (const key of Object.keys(defaultValues) as (keyof T)[]) {
      // Usa 'in' operator para verificar se a chave existe (mesmo se valor é null/undefined)
      if (key in saved) {
        const savedValue = saved[key];
        const defaultValue = defaultValues[key];
        
        // Se ambos são objetos (não arrays), faz merge recursivo
        if (
          savedValue !== null &&
          defaultValue !== null &&
          typeof savedValue === 'object' &&
          typeof defaultValue === 'object' &&
          !Array.isArray(savedValue) &&
          !Array.isArray(defaultValue)
        ) {
          result[key] = { ...defaultValue, ...savedValue } as T[keyof T];
        } else {
          result[key] = savedValue as T[keyof T];
        }
      }
    }
    
    return result;
  }, []);

  // Helper para ler do localStorage
  const readFromLocalStorage = useCallback((): { data: Partial<T> | null; version: number } => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Suporta formato com versão ou formato legado
        if (typeof parsed === 'object' && '_version' in parsed && 'data' in parsed) {
          return { data: parsed.data, version: parsed._version };
        }
        // Formato legado sem versão
        return { data: parsed, version: 0 };
      }
    } catch {
      // Ignore parse errors
    }
    return { data: null, version: 0 };
  }, [storageKey]);

  // Helper para salvar no localStorage
  const saveToLocalStorage = useCallback((data: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ 
        _version: version, 
        data 
      }));
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, version]);

  // Query para buscar tenant_id e settings do banco
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['persistent-settings', settingsKey],
    queryFn: async () => {
      const { data: tenantId, error: tenantError } = await supabase.rpc('get_user_tenant_id');
      if (tenantError) throw tenantError;
      
      if (!tenantId) {
        // Usuário não tem tenant, usar localStorage apenas
        const { data: localData } = readFromLocalStorage();
        return { 
          tenantId: null, 
          settings: smartMerge(localData, defaults),
          fromLocalStorage: true 
        };
      }

      const { data: dbSettings, error: settingsError } = await supabase
        .from('global_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('key', settingsKey)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      if (dbSettings?.value) {
        const value = dbSettings.value as Partial<T>;
        return { 
          tenantId, 
          settings: smartMerge(value, defaults),
          fromLocalStorage: false 
        };
      }
      
      // Não existe no banco, verificar localStorage
      const { data: localData } = readFromLocalStorage();
      return { 
        tenantId, 
        settings: smartMerge(localData, defaults),
        fromLocalStorage: localData !== null 
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const tenantId = queryData?.tenantId ?? null;
  const settings = queryData?.settings ?? defaults;
  const fromLocalStorage = queryData?.fromLocalStorage ?? false;

  // Mutation para salvar no banco
  const saveMutation = useMutation({
    mutationFn: async (newSettings: T) => {
      if (!tenantId) {
        // Sem tenant, salva apenas no localStorage
        saveToLocalStorage(newSettings);
        return;
      }

      // Buscar registro existente
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('key', settingsKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('global_settings')
          .update({ 
            value: newSettings as unknown as Json, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert({ 
            tenant_id: tenantId, 
            key: settingsKey, 
            value: newSettings as unknown as Json 
          });
        if (error) throw error;
      }

      // Também salva no localStorage como cache
      saveToLocalStorage(newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persistent-settings', settingsKey] });
    },
  });

  // Migrar localStorage para banco (uma vez)
  useEffect(() => {
    if (migratedRef.current || isLoading || !tenantId || !fromLocalStorage) return;
    
    const { data: localData } = readFromLocalStorage();
    if (localData) {
      console.log(`[usePersistentSettings] Migrando ${settingsKey} de localStorage para banco`);
      migratedRef.current = true;
      saveMutation.mutate(settings);
    }
  }, [isLoading, tenantId, fromLocalStorage, settingsKey, settings]);

  // Manter localStorage sincronizado quando settings mudam
  useEffect(() => {
    if (!isLoading && settings) {
      saveToLocalStorage(settings);
    }
  }, [settings, isLoading, saveToLocalStorage]);

  const updateSettings = useCallback((updates: Partial<T>) => {
    const newSettings = { ...settings, ...updates };
    saveMutation.mutate(newSettings);
  }, [settings, saveMutation]);

  const setSettings = useCallback((newSettings: T) => {
    saveMutation.mutate(newSettings);
  }, [saveMutation]);

  return {
    settings,
    isLoading,
    isSaving: saveMutation.isPending,
    updateSettings,
    setSettings,
    tenantId,
  };
}
