import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

const STORAGE_KEY = 'pdv-announcements-played-today';

export function useScheduledAnnouncements(currentScreen?: string) {
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

  // Save played announcements to localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      ids: Array.from(playedToday)
    }));
  }, [playedToday]);

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

    const fileName = `${user.id}/${name.replace(/\s+/g, '_')}_${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from('announcements')
      .upload(fileName, blob, { contentType: 'audio/webm' });

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

    // Mark as played
    setPlayedToday(prev => new Set([...prev, announcement.id]));

    // Update last_played_at in database
    supabase
      .from('scheduled_announcements')
      .update({ last_played_at: new Date().toISOString() })
      .eq('id', announcement.id)
      .then();
  }, []);

  // Check and play announcements every minute
  useEffect(() => {
    if (!currentScreen || announcements.length === 0) return;

    const checkAndPlay = () => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM
      const currentDay = now.getDay() || 7; // 1-7 (Monday-Sunday), convert 0 to 7

      announcements.forEach(announcement => {
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
    checkAndPlay();

    // Check every minute
    const interval = setInterval(checkAndPlay, 60000);
    return () => clearInterval(interval);
  }, [announcements, currentScreen, playedToday, playAnnouncement]);

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
