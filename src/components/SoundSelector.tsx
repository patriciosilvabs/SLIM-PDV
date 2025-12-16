import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCustomSounds, SoundType, PREDEFINED_SOUNDS } from '@/hooks/useCustomSounds';
import { Play, Upload, Trash2, Music } from 'lucide-react';
import { toast } from 'sonner';

interface SoundSelectorProps {
  soundType: SoundType;
  selectedSound: string;
  onSelect: (soundId: string, soundUrl: string) => void;
  disabled?: boolean;
}

export function SoundSelector({ soundType, selectedSound, onSelect, disabled }: SoundSelectorProps) {
  const { customSounds, uploadSound, deleteSound, getSoundsForType, predefinedSounds } = useCustomSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customForType = getSoundsForType(soundType);
  const predefinedList = Object.entries(predefinedSounds);

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
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-sm">Adicionar Som Personalizado</Label>
          <Input
            placeholder="Nome do som"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
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
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadSound.isPending || !uploadName.trim()}
            >
              <Upload className="h-4 w-4" />
              {uploadSound.isPending ? 'Enviando...' : 'Enviar Áudio'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos: MP3, WAV, OGG • Máx: 1MB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
