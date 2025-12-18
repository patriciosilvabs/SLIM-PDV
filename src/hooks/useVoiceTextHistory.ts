interface VoiceTextHistoryItem {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  createdAt: string;
}

const STORAGE_KEY = 'elevenlabs_text_history';
const MAX_ITEMS = 20;

export function useVoiceTextHistory() {
  const getHistory = (): VoiceTextHistoryItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const addToHistory = (text: string, voiceId: string, voiceName: string) => {
    const history = getHistory();
    const newItem: VoiceTextHistoryItem = {
      id: Date.now().toString(),
      text,
      voiceId,
      voiceName,
      createdAt: new Date().toISOString()
    };

    // Remove duplicates of same text
    const filtered = history.filter(h => h.text !== text);

    // Add at beginning and limit to MAX_ITEMS
    const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return { getHistory, addToHistory, clearHistory };
}

export const ELEVENLABS_VOICES = [
  // Português
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male' as const, lang: 'pt', flag: '🇧🇷' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female' as const, lang: 'pt', flag: '🇧🇷' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male' as const, lang: 'pt', flag: '🇧🇷' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female' as const, lang: 'pt', flag: '🇧🇷' },
  // English
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male' as const, lang: 'en', flag: '🇺🇸' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female' as const, lang: 'en', flag: '🇺🇸' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male' as const, lang: 'en', flag: '🇺🇸' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female' as const, lang: 'en', flag: '🇺🇸' },
];

export type { VoiceTextHistoryItem };
