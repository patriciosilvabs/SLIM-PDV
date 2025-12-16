import { useCallback, useState, useEffect } from 'react';
import { PREDEFINED_SOUNDS, SoundType } from './useCustomSounds';

const STORAGE_KEY = 'pdv-notification-settings';

interface NotificationSettings {
  enabled: boolean;
  volume: number;
  enabledSounds: Record<SoundType, boolean>;
  selectedSounds: Record<SoundType, string>; // ID of selected sound
  customSoundUrls: Record<SoundType, string>; // URL of the sound to play
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  enabledSounds: {
    newOrder: true,
    newReservation: true,
    orderReady: true,
    kdsNewOrder: true,
  },
  selectedSounds: {
    newOrder: 'beepClassic',
    newReservation: 'bell',
    orderReady: 'dingDong',
    kdsNewOrder: 'urgentAlert',
  },
  customSoundUrls: {
    newOrder: PREDEFINED_SOUNDS.beepClassic.data,
    newReservation: PREDEFINED_SOUNDS.bell.data,
    orderReady: PREDEFINED_SOUNDS.dingDong.data,
    kdsNewOrder: PREDEFINED_SOUNDS.urgentAlert.data,
  },
};

export function useAudioNotification() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new fields
        return {
          ...defaultSettings,
          ...parsed,
          enabledSounds: { ...defaultSettings.enabledSounds, ...parsed.enabledSounds },
          selectedSounds: { ...defaultSettings.selectedSounds, ...parsed.selectedSounds },
          customSoundUrls: { ...defaultSettings.customSoundUrls, ...parsed.customSoundUrls },
        };
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const playSound = useCallback(async (type: SoundType) => {
    if (!settings.enabled || !settings.enabledSounds[type]) return;

    try {
      const soundUrl = settings.customSoundUrls[type] || PREDEFINED_SOUNDS.beepClassic.data;
      const audio = new Audio(soundUrl);
      audio.volume = settings.volume;
      await audio.play();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [settings]);

  const playNewOrderSound = useCallback(() => playSound('newOrder'), [playSound]);
  const playNewReservationSound = useCallback(() => playSound('newReservation'), [playSound]);
  const playOrderReadySound = useCallback(() => playSound('orderReady'), [playSound]);
  const playKdsNewOrderSound = useCallback(() => playSound('kdsNewOrder'), [playSound]);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleSound = useCallback((type: SoundType) => {
    setSettings(prev => ({
      ...prev,
      enabledSounds: {
        ...prev.enabledSounds,
        [type]: !prev.enabledSounds[type],
      },
    }));
  }, []);

  const setSelectedSound = useCallback((type: SoundType, soundId: string, soundUrl: string) => {
    setSettings(prev => ({
      ...prev,
      selectedSounds: {
        ...prev.selectedSounds,
        [type]: soundId,
      },
      customSoundUrls: {
        ...prev.customSoundUrls,
        [type]: soundUrl,
      },
    }));
  }, []);

  const testSound = useCallback((type: SoundType) => {
    const soundUrl = settings.customSoundUrls[type] || PREDEFINED_SOUNDS.beepClassic.data;
    const audio = new Audio(soundUrl);
    audio.volume = settings.volume;
    audio.play().catch(console.warn);
  }, [settings.customSoundUrls, settings.volume]);

  return {
    settings,
    updateSettings,
    toggleSound,
    setSelectedSound,
    testSound,
    playSound,
    playNewOrderSound,
    playNewReservationSound,
    playOrderReadySound,
    playKdsNewOrderSound,
  };
}
