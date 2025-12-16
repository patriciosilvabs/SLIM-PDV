import { useCallback, useRef, useEffect, useState } from 'react';

type SoundType = 'newOrder' | 'newReservation' | 'orderReady';

// Base64 encoded short beep sounds (very small files)
const SOUNDS: Record<SoundType, string> = {
  newOrder: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1NOU1JYXWcuZZyUDdDWIWz5OPTtpBjPkFeiLHf+/bpybV1UVR4q9Xp7+3btYdhW3ek0unp3sq7lW9xe6vT4+Pkz7mXgYGCqc7c3trNsJWLgoKfrdbj3NnLrJKGgoWip8zW2NLMqJGEhIqkosDJysW/oYmGh5GjsL29ubGdiIaFkZ+usLKtnJOFhYaQnamusq2kkIKFhpCdqK6tqJyOgYaGk52mqKijnI2CiIqYoKekoZaKhIiLmJ6joZ2VjImMkZebnpyWjouOkpibm5mUj4+QlZmbmpaPkJGVl5qZl5OQk5aYmpqXk5KUl5mampeTlJaYmZqZlpWWmJmampeTlZaYmZqZl5WXmJmampeVl5iZmpmXlpeYmZmZl5aXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmQ==',
  newReservation: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1NOU1JYXWcuZZyUDdDWIWz5OPTtpBjPkFeiLHf+/bpybV1UVR4q9Xp7+3btYdhW3ek0unp3sq7lW9xe6vT4+Pkz7mXgYGCqc7c3trNsJWLgoKfrdbj3NnLrJKGgoWip8zW2NLMqJGEhIqkosDJysW/oYmGh5GjsL29ubGdiIaFkZ+usLKtnJOFhYaQnamusq2kkIKFhpCdqK6tqJyOgYaGk52mqKijnI2CiIqYoKekoZaKhIiLmJ6joZ2VjImMkZebnpyWjouOkpibm5mUj4+QlZmbmpaPkJGVl5qZl5OQk5aYmpqXk5KUl5mampeTlJaYmZqZlpWWmJmampeTlZaYmZqZl5WXmJmampeVl5iZmpmXlpeYmZmZl5aXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmQ==',
  orderReady: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1NOU1JYXWcuZZyUDdDWIWz5OPTtpBjPkFeiLHf+/bpybV1UVR4q9Xp7+3btYdhW3ek0unp3sq7lW9xe6vT4+Pkz7mXgYGCqc7c3trNsJWLgoKfrdbj3NnLrJKGgoWip8zW2NLMqJGEhIqkosDJysW/oYmGh5GjsL29ubGdiIaFkZ+usLKtnJOFhYaQnamusq2kkIKFhpCdqK6tqJyOgYaGk52mqKijnI2CiIqYoKekoZaKhIiLmJ6joZ2VjImMkZebnpyWjouOkpibm5mUj4+QlZmbmpaPkJGVl5qZl5OQk5aYmpqXk5KUl5mampeTlJaYmZqZlpWWmJmampeTlZaYmZqZl5WXmJmampeVl5iZmpmXlpeYmZmZl5aXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmQ==',
};

const STORAGE_KEY = 'pdv-notification-settings';

interface NotificationSettings {
  enabled: boolean;
  volume: number;
  enabledSounds: Record<SoundType, boolean>;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  volume: 0.7,
  enabledSounds: {
    newOrder: true,
    newReservation: true,
    orderReady: true,
  },
};

export function useAudioNotification() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback(async (type: SoundType) => {
    if (!settings.enabled || !settings.enabledSounds[type]) return;

    try {
      const audio = new Audio(SOUNDS[type]);
      audio.volume = settings.volume;
      await audio.play();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [settings]);

  const playNewOrderSound = useCallback(() => playSound('newOrder'), [playSound]);
  const playNewReservationSound = useCallback(() => playSound('newReservation'), [playSound]);
  const playOrderReadySound = useCallback(() => playSound('orderReady'), [playSound]);

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

  const testSound = useCallback((type: SoundType) => {
    const audio = new Audio(SOUNDS[type]);
    audio.volume = settings.volume;
    audio.play().catch(console.warn);
  }, [settings.volume]);

  return {
    settings,
    updateSettings,
    toggleSound,
    testSound,
    playNewOrderSound,
    playNewReservationSound,
    playOrderReadySound,
  };
}
