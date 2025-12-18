import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomSounds, SoundType } from '@/hooks/useCustomSounds';
import { useVoiceTextHistory } from '@/hooks/useVoiceTextHistory';
import { useWebSpeechTTS, DEFAULT_VOICES, getLanguageFlag, LANGUAGE_NAMES } from '@/hooks/useWebSpeechTTS';
import { Play, Upload, Trash2, Music, Mic, Sparkles, RefreshCw, Check, Volume2, History, Square } from 'lucide-react';
import { toast } from 'sonner';
import { AudioRecorder } from '@/components/AudioRecorder';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SoundSelectorProps {
  soundType: SoundType;
  selectedSound: string;
  onSelect: (soundId: string, soundUrl: string) => void;
  disabled?: boolean;
}

export function SoundSelector({ soundType, selectedSound, onSelect, disabled }: SoundSelectorProps) {
  const { customSounds, uploadSound, deleteSound, getSoundsForType, predefinedSounds } = useCustomSounds();
  const { getHistory, addToHistory, clearHistory } = useVoiceTextHistory();
  const { 
    voices, 
    ptVoices, 
    enVoices, 
    esVoices, 
    frVoices, 
    deVoices, 
    itVoices,
    jaVoices,
    zhVoices,
    koVoices,
    ruVoices,
    otherVoices,
    isSupported, 
    isSpeaking, 
    speak, 
    cancelSpeech 
  } = useWebSpeechTTS();
  
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [voiceText, setVoiceText] = useState('Pedido cancelado, atenção cozinha');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customForType = getSoundsForType(soundType);
  const predefinedList = Object.entries(predefinedSounds);
  const history = getHistory();

  // Use available voices or defaults, grouped by language
  const voiceGroups = [
    { key: 'pt', label: '🇧🇷 Português', voices: ptVoices.length > 0 ? ptVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('pt')) },
    { key: 'en', label: '🇺🇸 English', voices: enVoices.length > 0 ? enVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('en')) },
    { key: 'es', label: '🇪🇸 Español', voices: esVoices.length > 0 ? esVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('es')) },
    { key: 'fr', label: '🇫🇷 Français', voices: frVoices.length > 0 ? frVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('fr')) },
    { key: 'de', label: '🇩🇪 Deutsch', voices: deVoices.length > 0 ? deVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('de')) },
    { key: 'it', label: '🇮🇹 Italiano', voices: itVoices.length > 0 ? itVoices : DEFAULT_VOICES.filter(v => v.lang.startsWith('it')) },
    { key: 'ja', label: '🇯🇵 日本語', voices: jaVoices },
    { key: 'zh', label: '🇨🇳 中文', voices: zhVoices },
    { key: 'ko', label: '🇰🇷 한국어', voices: koVoices },
    { key: 'ru', label: '🇷🇺 Русский', voices: ruVoices },
    { key: 'other', label: '🌐 Outros', voices: otherVoices },
  ].filter(g => g.voices.length > 0);

  const allVoices = voiceGroups.flatMap(g => g.voices);
  
  // Set default voice when voices load
  useEffect(() => {
    if (!selectedVoiceURI && allVoices.length > 0) {
      setSelectedVoiceURI(allVoices[0].voiceURI);
    }
  }, [allVoices, selectedVoiceURI]);

  const selectedVoice = allVoices.find(v => v.voiceURI === selectedVoiceURI) || allVoices[0];

  const playSound = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(console.warn);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadName.trim()) {
      toast.error('Digite um nome para o som');
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 1MB)');
      return;
    }

    await uploadSound.mutateAsync({
      file,
      name: uploadName.trim(),
      soundType
    });

    setUploadName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveRecording = async (blob: Blob) => {
    if (!uploadName.trim()) {
      toast.error('Digite um nome para a gravação');
      return;
    }

    const file = new File([blob], `recording_${Date.now()}.webm`, { 
      type: 'audio/webm' 
    });

    await uploadSound.mutateAsync({
      file,
      name: uploadName.trim(),
      soundType
    });

    setUploadName('');
    setIsRecordingMode(false);
  };

  const handlePreviewVoice = () => {
    if (!voiceText.trim()) {
      toast.error('Digite o texto para ouvir');
      return;
    }

    if (isSpeaking) {
      cancelSpeech();
    } else {
      speak(voiceText, selectedVoiceURI);
    }
  };

  const handleGenerateVoice = async () => {
    if (!voiceText.trim() || !uploadName.trim()) {
      toast.error('Preencha o nome do som e o texto para gerar');
      return;
    }

    if (!isSupported) {
      toast.error('Síntese de voz não suportada neste navegador');
      return;
    }

    // Clean previous preview
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
    }

    setIsGeneratingVoice(true);
    
    try {
      // Use MediaRecorder to capture system audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          resolve(blob);
        };
        mediaRecorder.onerror = () => reject(new Error('Erro na gravação'));
      });

      // Start recording before speech
      mediaRecorder.start();

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(voiceText);
      if (selectedVoiceURI) {
        const availableVoices = window.speechSynthesis.getVoices();
        const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }

      // Wait for speech to end
      await new Promise<void>((resolve, reject) => {
        utterance.onend = () => {
          setTimeout(() => {
            mediaRecorder.stop();
            resolve();
          }, 300);
        };
        utterance.onerror = () => {
          mediaRecorder.stop();
          reject(new Error('Erro na síntese'));
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });

      const audioBlob = await recordingPromise;
      const tempUrl = URL.createObjectURL(audioBlob);
      setPreviewAudioUrl(tempUrl);
      setPreviewBlob(audioBlob);
      toast.success('Áudio gravado! Ouça o preview.');
    } catch (error) {
      console.error('Error generating voice:', error);
      toast.error('Erro ao gerar áudio. Permita acesso ao microfone.');
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleConfirmVoice = async () => {
    if (!previewBlob || !uploadName.trim()) return;
    
    try {
      addToHistory(voiceText, selectedVoiceURI, selectedVoice?.name || 'Voz');
      
      const file = new File([previewBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

      await uploadSound.mutateAsync({
        file,
        name: uploadName.trim(),
        soundType
      });

      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
      setVoiceText('Pedido cancelado, atenção cozinha');
      setUploadName('');
      toast.success('Áudio de voz salvo!');
    } catch (error) {
      toast.error('Erro ao salvar áudio: ' + (error as Error).message);
    }
  };

  const getCurrentSoundName = () => {
    const predefined = predefinedList.find(([key]) => key === selectedSound);
    if (predefined) return predefined[1].name;

    const custom = customSounds.find(s => s.id === selectedSound);
    if (custom) return custom.name;

    return 'Beep Clássico';
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-xs"
          disabled={disabled}
        >
          <Music className="h-3 w-3" />
          {getCurrentSoundName()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar Som</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={selectedSound}
          onValueChange={(value) => {
            const predefined = predefinedList.find(([key]) => key === value);
            if (predefined) {
              onSelect(value, predefined[1].data);
            } else {
              const custom = customSounds.find(s => s.id === value);
              if (custom) {
                onSelect(value, custom.file_path);
              }
            }
          }}
          className="space-y-2"
        >
          {/* Predefined Sounds */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sons Pré-definidos</Label>
            {predefinedList.map(([key, sound]) => (
              <div 
                key={key} 
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="cursor-pointer">
                    {sound.name}
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    playSound(sound.data);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Custom Sounds */}
          {customForType.length > 0 && (
            <div className="space-y-1 pt-2">
              <Label className="text-xs text-muted-foreground">Sons Personalizados</Label>
              {customForType.map((sound) => (
                <div 
                  key={sound.id} 
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={sound.id} id={sound.id} />
                    <Label htmlFor={sound.id} className="cursor-pointer">
                      {sound.name}
                    </Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        playSound(sound.file_path);
                      }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        deleteSound.mutate(sound.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RadioGroup>

        {/* Upload Custom Sound */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium">Adicionar Som Personalizado</Label>
          <Input
            placeholder="Nome do som"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
          
          {isRecordingMode ? (
            <AudioRecorder
              onSave={handleSaveRecording}
              onCancel={() => setIsRecordingMode(false)}
              maxDuration={30}
            />
          ) : (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadSound.isPending || !uploadName.trim()}
              >
                <Upload className="h-4 w-4" />
                {uploadSound.isPending ? 'Enviando...' : 'Arquivo'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setIsRecordingMode(true)}
                disabled={uploadSound.isPending || !uploadName.trim()}
              >
                <Mic className="h-4 w-4" />
                Gravar
              </Button>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Formatos: MP3, WAV, OGG • Máx: 1MB • Gravação: até 30s
          </p>
        </div>

        {/* Voice Generation with Web Speech API */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerar Áudio com Voz
          </Label>
          
          {!isSupported && (
            <p className="text-xs text-destructive">
              Síntese de voz não suportada neste navegador.
            </p>
          )}
          
          {/* Voice Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Voz ({allVoices.length} disponíveis)</Label>
            <Select value={selectedVoiceURI} onValueChange={setSelectedVoiceURI}>
              <SelectTrigger>
                <SelectValue>
                  {selectedVoice ? `${getLanguageFlag(selectedVoice.lang)} ${selectedVoice.name}` : 'Selecione uma voz'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {voiceGroups.map(group => (
                  <SelectGroup key={group.key}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.voices.map(voice => (
                      <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                        {getLanguageFlag(voice.lang)} {voice.name} {voice.localService ? '(local)' : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Textarea
            placeholder="Digite o texto para sintetizar (ex: 'Pedido cancelado, atenção cozinha!')"
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            rows={2}
            className="resize-none"
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{voiceText.length} caracteres</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={handlePreviewVoice}
                disabled={!voiceText.trim() || !isSupported}
              >
                {isSpeaking ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isSpeaking ? 'Parar' : 'Ouvir'}
              </Button>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-3 w-3" />
                  Histórico ({history.length})
                </Button>
              )}
            </div>
          </div>
          
          {/* Text History */}
          {showHistory && history.length > 0 && (
            <div className="space-y-2 p-2 border rounded-lg bg-background max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Textos Recentes</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive"
                  onClick={() => {
                    clearHistory();
                    setShowHistory(false);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </div>
              {history.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setVoiceText(item.text);
                    if (item.voiceId) setSelectedVoiceURI(item.voiceId);
                    setShowHistory(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.text}</p>
                    <p className="text-xs text-muted-foreground">
                      🎤 {item.voiceName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Audio Preview */}
          {previewAudioUrl && (
            <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <Volume2 className="h-4 w-4" />
                Preview Gravado
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const audio = new Audio(previewAudioUrl);
                    audio.play();
                  }}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Ouvir
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirmVoice}
                  className="gap-2 flex-1"
                >
                  <Check className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
          
          <Button
            variant={previewAudioUrl ? 'outline' : 'default'}
            className="w-full gap-2"
            onClick={handleGenerateVoice}
            disabled={isGeneratingVoice || !voiceText.trim() || !uploadName.trim() || !isSupported}
          >
            {isGeneratingVoice ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gravando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gravar com Voz Sintetizada
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Usa a síntese de voz do navegador. Requer permissão de microfone para gravar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
