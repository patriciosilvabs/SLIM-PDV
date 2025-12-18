import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomSounds, SoundType, PREDEFINED_SOUNDS } from '@/hooks/useCustomSounds';
import { useVoiceTextHistory, ELEVENLABS_VOICES } from '@/hooks/useVoiceTextHistory';
import { Play, Upload, Trash2, Music, Mic, Sparkles, RefreshCw, Check, Volume2, History } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [voiceText, setVoiceText] = useState('Pedido cancelado, atenção cozinha');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(ELEVENLABS_VOICES[0].id);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customForType = getSoundsForType(soundType);
  const predefinedList = Object.entries(predefinedSounds);
  const selectedVoice = ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId) || ELEVENLABS_VOICES[0];
  const history = getHistory();
  const ptVoices = ELEVENLABS_VOICES.filter(v => v.lang === 'pt');
  const enVoices = ELEVENLABS_VOICES.filter(v => v.lang === 'en');

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

    // Converter Blob para File
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

  const handleGenerateVoice = async () => {
    if (!voiceText.trim() || !uploadName.trim()) {
      toast.error('Preencha o nome do som e o texto para gerar');
      return;
    }

    // Limpar preview anterior
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
    }

    setIsGeneratingVoice(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text: voiceText, 
            voiceId: selectedVoiceId
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar áudio');
      }

      const audioBlob = await response.blob();
      const tempUrl = URL.createObjectURL(audioBlob);
      setPreviewAudioUrl(tempUrl);
      setPreviewBlob(audioBlob);
      toast.success('Preview gerado! Ouça antes de salvar.');
    } catch (error) {
      console.error('Error generating voice:', error);
      toast.error('Erro ao gerar áudio: ' + (error as Error).message);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleConfirmVoice = async () => {
    if (!previewBlob || !uploadName.trim()) return;
    
    try {
      // Salvar no histórico
      addToHistory(voiceText, selectedVoiceId, selectedVoice.name);
      
      const file = new File([previewBlob], `voice_${Date.now()}.mp3`, { type: 'audio/mpeg' });

      await uploadSound.mutateAsync({
        file,
        name: uploadName.trim(),
        soundType
      });

      // Limpar estados
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

        {/* Voice Generation with AI */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerar Áudio com IA
          </Label>
          
          {/* Seleção de Voz */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Voz</Label>
            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
              <SelectTrigger>
                <SelectValue>
                  {selectedVoice.flag} {selectedVoice.name} ({selectedVoice.gender === 'male' ? '♂' : '♀'})
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>🇧🇷 Português</SelectLabel>
                  {ptVoices.map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.flag} {voice.name} ({voice.gender === 'male' ? 'Masculina' : 'Feminina'})
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>🇺🇸 English</SelectLabel>
                  {enVoices.map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.flag} {voice.name} ({voice.gender === 'male' ? 'Male' : 'Female'})
                    </SelectItem>
                  ))}
                </SelectGroup>
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
          
          {/* Histórico de Textos */}
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
              {history.slice(0, 5).map(item => {
                const voice = ELEVENLABS_VOICES.find(v => v.id === item.voiceId);
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setVoiceText(item.text);
                      if (voice) setSelectedVoiceId(voice.id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {voice?.flag || '🎤'} {item.voiceName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Preview do Áudio */}
          {previewAudioUrl && (
            <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <Volume2 className="h-4 w-4" />
                Preview Gerado
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
            disabled={isGeneratingVoice || !voiceText.trim() || !uploadName.trim()}
          >
            {isGeneratingVoice ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : previewAudioUrl ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerar
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Preview
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Usa ElevenLabs para sintetizar voz natural em português ou inglês.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
