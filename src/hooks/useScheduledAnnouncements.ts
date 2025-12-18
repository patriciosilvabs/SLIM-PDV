import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeFileName } from '@/lib/sanitizeFileName';

export interface ScheduledAnnouncement {
  id: string;
  name: string;
  file_path: string;
  schedule_type: 'once' | 'daily' | 'weekly';
  scheduled_time: string;
  scheduled_days: number[];
  scheduled_date: string | null;
  is_active: boolean;
  target_screens: string[];
  volume: number;
  created_by: string | null;
  created_at: string;
  last_played_at: string | null;
  // Condition-based fields
  trigger_type: 'scheduled' | 'condition';
  condition_type: 'orders_in_production' | 'orders_pending' | 'orders_total_active' | 'avg_wait_time' | 'max_wait_time' | 'delayed_orders_count' | null;
  condition_threshold: number;
  condition_comparison: 'greater_than' | 'less_than' | 'equals';
  cooldown_minutes: number;
  delay_threshold_minutes: number;
}

export interface OrderCounts {
  pending: number;
  preparing: number;
  total: number;
  // Time metrics
  avgWaitTimeMinutes: number;
  maxWaitTimeMinutes: number;
  delayedOrdersCount: number;
}

const STORAGE_KEY = 'pdv-announcements-played-today';
const COOLDOWN_STORAGE_KEY = 'pdv-announcements-cooldowns';

export function useScheduledAnnouncements(currentScreen?: string, orderCounts?: OrderCounts) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playedToday, setPlayedToday] = useState<Set<string>>(() => {
    try {
      const today = new Date().toDateString();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          return new Set(parsed.ids);
        }
      }
    } catch {}
    return new Set();
  });

  // Cooldown tracking for condition-based announcements
  const [cooldowns, setCooldowns] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(COOLDOWN_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return {};
  });

  // Save played announcements to localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      ids: Array.from(playedToday)
    }));
  }, [playedToday]);

  // Save cooldowns to localStorage
  useEffect(() => {
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(cooldowns));
  }, [cooldowns]);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['scheduled-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_announcements')
        .select('*')
        .eq('is_active', true)
        .order('scheduled_time');
      
      if (error) throw error;
      return data as ScheduledAnnouncement[];
    }
  });

  const createAnnouncement = useMutation({
    mutationFn: async (data: Omit<ScheduledAnnouncement, 'id' | 'created_at' | 'last_played_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('scheduled_announcements')
        .insert({ ...data, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-announcements'] });
      toast.success('Anúncio agendado!');
    },
    onError: (error) => {
      toast.error('Erro ao criar anúncio: ' + error.message);
    }
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ScheduledAnnouncement> & { id: string }) => {
      const { error } = await supabase
        .from('scheduled_announcements')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-announcements'] });
      toast.success('Anúncio atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar anúncio: ' + error.message);
    }
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const announcement = announcements.find(a => a.id === id);
      if (announcement) {
        // Delete from storage
        const filePath = announcement.file_path.split('/announcements/')[1];
        if (filePath) {
          await supabase.storage.from('announcements').remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('scheduled_announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-announcements'] });
      toast.success('Anúncio excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir anúncio: ' + error.message);
    }
  });

  const uploadRecording = async (blob: Blob, name: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const safeName = sanitizeFileName(name);
    
    // Detectar tipo de arquivo e extensão apropriada
    const mimeType = blob.type || 'audio/webm';
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/ogg': 'ogg',
      'audio/x-wav': 'wav',
      'audio/x-m4a': 'm4a',
      'audio/mp4': 'm4a',
    };
    const extension = extensionMap[mimeType] || 'webm';
    
    const fileName = `${user.id}/${safeName}_${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('announcements')
      .upload(fileName, blob, { contentType: mimeType });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('announcements')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const playAnnouncement = useCallback((announcement: ScheduledAnnouncement) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(announcement.file_path);
    audio.volume = announcement.volume;
    audioRef.current = audio;
    
    audio.play().catch(err => {
      console.warn('Erro ao reproduzir anúncio:', err);
    });

    // Mark as played (for scheduled announcements)
    if (announcement.trigger_type === 'scheduled') {
      setPlayedToday(prev => new Set([...prev, announcement.id]));
    }

    // Update cooldown for condition-based announcements
    if (announcement.trigger_type === 'condition') {
      setCooldowns(prev => ({
        ...prev,
        [announcement.id]: Date.now()
      }));
    }

    // Update last_played_at in database
    supabase
      .from('scheduled_announcements')
      .update({ last_played_at: new Date().toISOString() })
      .eq('id', announcement.id)
      .then();
  }, []);

  // Check if a condition is met
  const checkCondition = useCallback((
    announcement: ScheduledAnnouncement,
    counts: OrderCounts
  ): boolean => {
    if (!announcement.condition_type) return false;

    let value: number;
    switch (announcement.condition_type) {
      case 'orders_in_production':
        value = counts.preparing;
        break;
      case 'orders_pending':
        value = counts.pending;
        break;
      case 'orders_total_active':
        value = counts.total;
        break;
      case 'avg_wait_time':
        value = counts.avgWaitTimeMinutes;
        break;
      case 'max_wait_time':
        value = counts.maxWaitTimeMinutes;
        break;
      case 'delayed_orders_count':
        value = counts.delayedOrdersCount;
        break;
      default:
        return false;
    }

    const threshold = announcement.condition_threshold;
    switch (announcement.condition_comparison) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }, []);

  // Check if announcement is in cooldown
  const isInCooldown = useCallback((announcement: ScheduledAnnouncement): boolean => {
    const lastPlayed = cooldowns[announcement.id];
    if (!lastPlayed) return false;
    
    const cooldownMs = announcement.cooldown_minutes * 60 * 1000;
    return (Date.now() - lastPlayed) < cooldownMs;
  }, [cooldowns]);

  // Check and play scheduled announcements every minute
  useEffect(() => {
    if (!currentScreen || announcements.length === 0) return;

    const checkScheduledAnnouncements = () => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM
      const currentDay = now.getDay() || 7; // 1-7 (Monday-Sunday), convert 0 to 7

      announcements
        .filter(a => a.trigger_type === 'scheduled')
        .forEach(announcement => {
          // Skip if not for this screen
          if (!announcement.target_screens.includes(currentScreen)) return;

          // Skip if already played today
          if (playedToday.has(announcement.id)) return;

          // Check time (compare HH:MM)
          const scheduledTime = announcement.scheduled_time.slice(0, 5);
          if (scheduledTime !== currentTimeStr) return;

          // Check schedule type
          if (announcement.schedule_type === 'once') {
            const scheduledDate = announcement.scheduled_date;
            if (scheduledDate && new Date(scheduledDate).toDateString() !== now.toDateString()) {
              return;
            }
          } else if (announcement.schedule_type === 'weekly') {
            if (!announcement.scheduled_days.includes(currentDay)) return;
          }
          // 'daily' runs every day

          // Play the announcement
          playAnnouncement(announcement);
          toast.info(`🔊 ${announcement.name}`, { duration: 3000 });
        });
    };

    // Check immediately
    checkScheduledAnnouncements();

    // Check every minute
    const interval = setInterval(checkScheduledAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [announcements, currentScreen, playedToday, playAnnouncement]);

  // Check condition-based announcements every 30 seconds
  useEffect(() => {
    if (!currentScreen || !orderCounts || announcements.length === 0) return;

    const checkConditionAnnouncements = () => {
      announcements
        .filter(a => a.trigger_type === 'condition')
        .forEach(announcement => {
          // Skip if not for this screen
          if (!announcement.target_screens.includes(currentScreen)) return;

          // Skip if in cooldown
          if (isInCooldown(announcement)) return;

          // Check if condition is met
          if (checkCondition(announcement, orderCounts)) {
            // Play the announcement
            playAnnouncement(announcement);
            
            // Show visual alert
            const conditionLabels: Record<string, string> = {
              orders_in_production: 'pedidos em produção',
              orders_pending: 'pedidos pendentes',
              orders_total_active: 'pedidos ativos',
              avg_wait_time: 'minutos de espera média',
              max_wait_time: 'minutos do pedido mais antigo',
              delayed_orders_count: 'pedidos atrasados'
            };
            const conditionLabel = conditionLabels[announcement.condition_type || ''] || '';
            const isTimeCondition = ['avg_wait_time', 'max_wait_time'].includes(announcement.condition_type || '');
            const unit = isTimeCondition ? 'min' : '';
            toast.warning(`🔴 ALERTA: ${announcement.name}`, { 
              description: `${announcement.condition_threshold}${unit} ${conditionLabel}`,
              duration: 6000 
            });
          }
        });
    };

    // Check immediately
    checkConditionAnnouncements();

    // Check every 30 seconds
    const interval = setInterval(checkConditionAnnouncements, 30000);
    return () => clearInterval(interval);
  }, [announcements, currentScreen, orderCounts, playAnnouncement, checkCondition, isInCooldown]);

  return {
    announcements,
    isLoading,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadRecording,
    playAnnouncement
  };
}
