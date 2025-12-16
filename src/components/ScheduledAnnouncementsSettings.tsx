import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { AudioRecorder } from '@/components/AudioRecorder';
import { useScheduledAnnouncements, ScheduledAnnouncement } from '@/hooks/useScheduledAnnouncements';
import { Megaphone, Plus, Mic, Upload, Play, Trash2, Edit, Calendar, Clock, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Dom' },
  { value: 2, label: 'Seg' },
  { value: 3, label: 'Ter' },
  { value: 4, label: 'Qua' },
  { value: 5, label: 'Qui' },
  { value: 6, label: 'Sex' },
  { value: 7, label: 'Sáb' },
];

const TARGET_SCREENS = [
  { value: 'kds', label: 'KDS (Cozinha)' },
  { value: 'counter', label: 'Balcão' },
  { value: 'order-management', label: 'Gestão de Pedidos' },
];

export function ScheduledAnnouncementsSettings() {
  const { 
    announcements, 
    isLoading, 
    createAnnouncement, 
    updateAnnouncement, 
    deleteAnnouncement,
    uploadRecording,
    playAnnouncement 
  } = useScheduledAnnouncements();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<ScheduledAnnouncement | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    file_path: '',
    schedule_type: 'daily' as 'once' | 'daily' | 'weekly',
    scheduled_time: '18:00',
    scheduled_days: [2, 3, 4, 5, 6], // Mon-Fri
    scheduled_date: '',
    target_screens: ['kds'],
    volume: 1.0,
    is_active: true
  });

  const resetForm = () => {
    setForm({
      name: '',
      file_path: '',
      schedule_type: 'daily',
      scheduled_time: '18:00',
      scheduled_days: [2, 3, 4, 5, 6],
      scheduled_date: '',
      target_screens: ['kds'],
      volume: 1.0,
      is_active: true
    });
    setEditingAnnouncement(null);
  };

  const handleOpenDialog = (announcement?: ScheduledAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setForm({
        name: announcement.name,
        file_path: announcement.file_path,
        schedule_type: announcement.schedule_type,
        scheduled_time: announcement.scheduled_time.slice(0, 5),
        scheduled_days: announcement.scheduled_days || [2, 3, 4, 5, 6],
        scheduled_date: announcement.scheduled_date || '',
        target_screens: announcement.target_screens || ['kds'],
        volume: announcement.volume || 1.0,
        is_active: announcement.is_active
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
    setIsRecording(false);
  };

  const handleSaveRecording = async (blob: Blob) => {
    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio');
      return;
    }

    try {
      const url = await uploadRecording(blob, form.name);
      setForm(prev => ({ ...prev, file_path: url }));
      setIsRecording(false);
      toast.success('Gravação salva! Configure o agendamento.');
    } catch (error: any) {
      toast.error('Erro ao salvar gravação: ' + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio primeiro');
      return;
    }

    try {
      const url = await uploadRecording(file, form.name);
      setForm(prev => ({ ...prev, file_path: url }));
      toast.success('Áudio enviado!');
    } catch (error: any) {
      toast.error('Erro ao enviar áudio: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.file_path) {
      toast.error('Preencha o nome e adicione um áudio');
      return;
    }

    try {
      if (editingAnnouncement) {
        await updateAnnouncement.mutateAsync({
          id: editingAnnouncement.id,
          ...form
        });
      } else {
        await createAnnouncement.mutateAsync(form);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este anúncio agendado?')) {
      await deleteAnnouncement.mutateAsync(id);
    }
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      scheduled_days: prev.scheduled_days.includes(day)
        ? prev.scheduled_days.filter(d => d !== day)
        : [...prev.scheduled_days, day].sort()
    }));
  };

  const toggleScreen = (screen: string) => {
    setForm(prev => ({
      ...prev,
      target_screens: prev.target_screens.includes(screen)
        ? prev.target_screens.filter(s => s !== screen)
        : [...prev.target_screens, screen]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Anúncios Agendados
        </CardTitle>
        <CardDescription>
          Grave mensagens e agende reprodução automática em horários específicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Novo Anúncio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio Agendado'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-2">
                <Label>Nome do Anúncio</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Aviso horário de pico"
                />
              </div>

              {/* Audio Source */}
              {!form.file_path ? (
                <div className="space-y-3">
                  <Label>Áudio</Label>
                  {isRecording ? (
                    <AudioRecorder
                      onSave={handleSaveRecording}
                      onCancel={() => setIsRecording(false)}
                      maxDuration={120}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => setIsRecording(true)}
                      >
                        <Mic className="h-4 w-4" />
                        Gravar
                      </Button>
                      <Label className="flex-1">
                        <Button variant="outline" className="w-full gap-2" asChild>
                          <span>
                            <Upload className="h-4 w-4" />
                            Enviar Arquivo
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </Label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Áudio</Label>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const audio = new Audio(form.file_path);
                        audio.volume = form.volume;
                        audio.play();
                      }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <span className="flex-1 text-sm truncate">{form.name || 'Áudio carregado'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setForm({ ...form, file_path: '' })}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Schedule Type */}
              <div className="space-y-2">
                <Label>Tipo de Agendamento</Label>
                <Select 
                  value={form.schedule_type} 
                  onValueChange={(v) => setForm({ ...form, schedule_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Uma vez</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Dias da semana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário
                </Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                />
              </div>

              {/* Date (for once) */}
              {form.schedule_type === 'once' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data
                  </Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  />
                </div>
              )}

              {/* Days of Week (for weekly) */}
              {form.schedule_type === 'weekly' && (
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <Button
                        key={day.value}
                        variant={form.scheduled_days.includes(day.value) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Screens */}
              <div className="space-y-2">
                <Label>Onde Reproduzir</Label>
                <div className="space-y-2">
                  {TARGET_SCREENS.map(screen => (
                    <label 
                      key={screen.value} 
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.target_screens.includes(screen.value)}
                        onCheckedChange={() => toggleScreen(screen.value)}
                      />
                      <span className="text-sm">{screen.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <Label>Volume: {Math.round(form.volume * 100)}%</Label>
                </div>
                <Slider
                  value={[form.volume * 100]}
                  onValueChange={([value]) => setForm({ ...form, volume: value / 100 })}
                  max={100}
                  step={5}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(is_active) => setForm({ ...form, is_active })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSubmit}
                  disabled={createAnnouncement.isPending || updateAnnouncement.isPending}
                >
                  {editingAnnouncement ? 'Salvar' : 'Criar Anúncio'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* List of Announcements */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum anúncio agendado</p>
            <p className="text-sm">Crie um novo anúncio para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(announcement => (
              <div 
                key={announcement.id} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                      {announcement.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <span className="font-medium truncate">{announcement.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{announcement.scheduled_time.slice(0, 5)}</span>
                    <span>•</span>
                    <span>
                      {announcement.schedule_type === 'once' && announcement.scheduled_date}
                      {announcement.schedule_type === 'daily' && 'Diariamente'}
                      {announcement.schedule_type === 'weekly' && 
                        announcement.scheduled_days.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(', ')
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    {announcement.target_screens.map(s => 
                      TARGET_SCREENS.find(x => x.value === s)?.label
                    ).join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => playAnnouncement(announcement)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(announcement)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(announcement.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
