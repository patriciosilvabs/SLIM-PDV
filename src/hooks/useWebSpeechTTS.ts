import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSpeechVoice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export function useWebSpeechTTS() {
  const [voices, setVoices] = useState<WebSpeechVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        // Filter for Portuguese and English voices
        const filtered = availableVoices
          .filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en'))
          .map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            localService: v.localService
          }));
        setVoices(filtered);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const getVoiceByURI = useCallback((voiceURI: string): SpeechSynthesisVoice | null => {
    const availableVoices = window.speechSynthesis.getVoices();
    return availableVoices.find(v => v.voiceURI === voiceURI) || null;
  }, []);

  const speak = useCallback((text: string, voiceURI?: string) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceURI) {
      const voice = getVoiceByURI(voiceURI);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, getVoiceByURI]);

  const cancelSpeech = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Generate audio blob using MediaRecorder and AudioContext
  const generateAudioBlob = useCallback(async (text: string, voiceURI?: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Web Speech API não suportada'));
        return;
      }

      try {
        // Create audio context for capturing
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          audioContext.close();
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          audioContext.close();
          reject(e);
        };

        // Use oscillator to capture speech via system audio (workaround)
        // Note: Web Speech API doesn't provide direct audio stream access
        // This creates a silent placeholder - actual audio plays through speakers
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voiceURI) {
          const voice = getVoiceByURI(voiceURI);
          if (voice) utterance.voice = voice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        let speechDuration = 0;
        const startTime = Date.now();

        utterance.onstart = () => {
          mediaRecorder.start();
        };

        utterance.onend = () => {
          speechDuration = Date.now() - startTime;
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 100);
        };

        utterance.onerror = (e) => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          reject(new Error('Erro na síntese de voz'));
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

      } catch (error) {
        reject(error);
      }
    });
  }, [isSupported, getVoiceByURI]);

  // Get voices grouped by language
  const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
  const enVoices = voices.filter(v => v.lang.startsWith('en'));

  return {
    voices,
    ptVoices,
    enVoices,
    isSupported,
    isSpeaking,
    speak,
    cancelSpeech,
    generateAudioBlob,
    getVoiceByURI
  };
}

// Default voices to show when no system voices available
export const DEFAULT_VOICES: WebSpeechVoice[] = [
  { name: 'Google português do Brasil', lang: 'pt-BR', voiceURI: 'Google português do Brasil', localService: false },
  { name: 'Microsoft Maria', lang: 'pt-BR', voiceURI: 'Microsoft Maria - Portuguese (Brazil)', localService: true },
  { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false },
  { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'Microsoft Zira - English (United States)', localService: true },
];
