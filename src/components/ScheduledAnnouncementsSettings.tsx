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
import { Textarea } from '@/components/ui/textarea';
import { AudioRecorder } from '@/components/AudioRecorder';
import { useScheduledAnnouncements, ScheduledAnnouncement } from '@/hooks/useScheduledAnnouncements';
import { Megaphone, Plus, Mic, Upload, Play, Trash2, Edit, Calendar, Clock, Volume2, Activity, AlertTriangle, Timer, Sparkles, RefreshCw } from 'lucide-react';
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

const CONDITION_TYPES = [
  { value: 'orders_in_production', label: 'Pedidos em Produção', description: 'Pedidos com status "Em Preparo"', category: 'quantity' },
  { value: 'orders_pending', label: 'Pedidos Pendentes', description: 'Pedidos aguardando início do preparo', category: 'quantity' },
  { value: 'orders_total_active', label: 'Total de Pedidos Ativos', description: 'Soma de pendentes + em preparo + prontos', category: 'quantity' },
  { value: 'avg_wait_time', label: 'Tempo Médio de Espera', description: 'Média em minutos de todos os pedidos ativos', category: 'time', unit: 'min' },
  { value: 'max_wait_time', label: 'Pedido Mais Antigo', description: 'Tempo do pedido esperando há mais tempo', category: 'time', unit: 'min' },
  { value: 'delayed_orders_count', label: 'Pedidos Atrasados', description: 'Quantidade de pedidos acima do tempo limite', category: 'count', hasDelayThreshold: true },
];

const CONDITION_COMPARISONS = [
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'equals', label: 'Igual a' },
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
  const [audioSource, setAudioSource] = useState<'record' | 'upload' | 'generate' | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    file_path: '',
    trigger_type: 'scheduled' as 'scheduled' | 'condition',
    schedule_type: 'daily' as 'once' | 'daily' | 'weekly',
    scheduled_time: '18:00',
    scheduled_days: [2, 3, 4, 5, 6], // Mon-Fri
    scheduled_date: '',
    condition_type: 'orders_in_production' as 'orders_in_production' | 'orders_pending' | 'orders_total_active' | 'avg_wait_time' | 'max_wait_time' | 'delayed_orders_count',
    condition_threshold: 15,
    condition_comparison: 'greater_than' as 'greater_than' | 'less_than' | 'equals',
    cooldown_minutes: 30,
    delay_threshold_minutes: 20,
    target_screens: ['kds'],
    volume: 1.0,
    is_active: true
  });

  const resetForm = () => {
    setForm({
      name: '',
      file_path: '',
      trigger_type: 'scheduled',
      schedule_type: 'daily',
      scheduled_time: '18:00',
      scheduled_days: [2, 3, 4, 5, 6],
      scheduled_date: '',
      condition_type: 'orders_in_production',
      condition_threshold: 15,
      condition_comparison: 'greater_than',
      cooldown_minutes: 30,
      delay_threshold_minutes: 20,
      target_screens: ['kds'],
      volume: 1.0,
      is_active: true
    });
    setEditingAnnouncement(null);
    setAudioSource(null);
    setVoiceText('');
  };

  const handleOpenDialog = (announcement?: ScheduledAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setForm({
        name: announcement.name,
        file_path: announcement.file_path,
        trigger_type: announcement.trigger_type || 'scheduled',
        schedule_type: announcement.schedule_type,
        scheduled_time: announcement.scheduled_time.slice(0, 5),
        scheduled_days: announcement.scheduled_days || [2, 3, 4, 5, 6],
        scheduled_date: announcement.scheduled_date || '',
        condition_type: announcement.condition_type || 'orders_in_production',
        condition_threshold: announcement.condition_threshold || 15,
        condition_comparison: announcement.condition_comparison || 'greater_than',
        cooldown_minutes: announcement.cooldown_minutes || 30,
        delay_threshold_minutes: announcement.delay_threshold_minutes || 20,
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
      setAudioSource(null);
      toast.success('Áudio enviado!');
    } catch (error: any) {
      toast.error('Erro ao enviar áudio: ' + error.message);
    }
  };

  const handleGenerateVoice = async () => {
    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio primeiro');
      return;
    }
    if (!voiceText.trim()) {
      toast.error('Digite o texto para gerar o áudio');
      return;
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
            voiceId: 'onwK4e9ZLuTAKqWW03F9' // Daniel - voz masculina PT-BR
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar áudio');
      }

      const audioBlob = await response.blob();
      const url = await uploadRecording(audioBlob, form.name);
      
      setForm(prev => ({ ...prev, file_path: url }));
      setVoiceText('');
      setAudioSource(null);
      toast.success('Áudio gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar voz:', error);
      toast.error('Erro ao gerar áudio: ' + error.message);
    } finally {
      setIsGeneratingVoice(false);
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

  const getAnnouncementDescription = (announcement: ScheduledAnnouncement) => {
    if (announcement.trigger_type === 'condition') {
      const conditionType = CONDITION_TYPES.find(c => c.value === announcement.condition_type);
      const conditionLabel = conditionType?.label || '';
      const comparisonLabel = CONDITION_COMPARISONS.find(c => c.value === announcement.condition_comparison)?.label || '';
      const unit = (conditionType as any)?.unit || '';
      const suffix = unit ? ` ${unit}` : '';
      return `${conditionLabel} ${comparisonLabel} ${announcement.condition_threshold}${suffix}`;
    }
    
    if (announcement.schedule_type === 'once') {
      return announcement.scheduled_date || 'Uma vez';
    }
    if (announcement.schedule_type === 'daily') {
      return 'Diariamente';
    }
    return announcement.scheduled_days.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(', ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Anúncios Agendados
        </CardTitle>
        <CardDescription>
          Grave mensagens e configure reprodução por horário ou demanda
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
                {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio'}
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
                  
                  {/* Seleção de modo */}
                  {!audioSource && !isRecording && (
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => {
                          setAudioSource('record');
                          setIsRecording(true);
                        }}
                      >
                        <Mic className="h-5 w-5" />
                        <span className="text-xs">Gravar</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => setAudioSource('upload')}
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Enviar</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => setAudioSource('generate')}
                      >
                        <Sparkles className="h-5 w-5" />
                        <span className="text-xs">Gerar Voz</span>
                      </Button>
                    </div>
                  )}

                  {/* Modo Gravação */}
                  {(audioSource === 'record' || isRecording) && (
                    <AudioRecorder
                      onSave={handleSaveRecording}
                      onCancel={() => {
                        setIsRecording(false);
                        setAudioSource(null);
                      }}
                      maxDuration={120}
                    />
                  )}

                  {/* Modo Upload */}
                  {audioSource === 'upload' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Label className="flex-1">
                          <Button variant="outline" className="w-full gap-2" asChild>
                            <span>
                              <Upload className="h-4 w-4" />
                              Selecionar Arquivo
                            </span>
                          </Button>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </Label>
                        <Button 
                          variant="ghost" 
                          onClick={() => setAudioSource(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Modo Geração de Voz */}
                  {audioSource === 'generate' && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Gerar Áudio com ElevenLabs
                      </div>
                      <Textarea
                        placeholder="Digite o texto que será convertido em áudio...&#10;Ex: Atenção cozinha, estamos com alto volume de pedidos!"
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        rows={3}
                        maxLength={500}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{voiceText.length}/500 caracteres</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-2"
                          onClick={handleGenerateVoice}
                          disabled={isGeneratingVoice || !voiceText.trim() || !form.name.trim()}
                        >
                          {isGeneratingVoice ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Gerar Áudio
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => {
                            setAudioSource(null);
                            setVoiceText('');
                          }}
                          disabled={isGeneratingVoice}
                        >
                          Cancelar
                        </Button>
                      </div>
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

              {/* Trigger Type */}
              <div className="space-y-3">
                <Label>Tipo de Disparo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.trigger_type === 'scheduled' ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setForm({ ...form, trigger_type: 'scheduled' })}
                  >
                    <Clock className="h-5 w-5" />
                    <span className="text-xs">Por Horário</span>
                  </Button>
                  <Button
                    type="button"
                    variant={form.trigger_type === 'condition' ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setForm({ ...form, trigger_type: 'condition' })}
                  >
                    <Activity className="h-5 w-5" />
                    <span className="text-xs">Por Demanda</span>
                  </Button>
                </div>
              </div>

              {/* Scheduled trigger options */}
              {form.trigger_type === 'scheduled' && (
                <>
                  {/* Schedule Type */}
                  <div className="space-y-2">
                    <Label>Frequência</Label>
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
                            type="button"
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
                </>
              )}

              {/* Condition trigger options */}
              {form.trigger_type === 'condition' && (
                <>
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        O anúncio será disparado automaticamente quando a condição for atingida, respeitando o tempo de cooldown configurado.
                      </p>
                    </div>
                  </div>

                  {/* Condition Type */}
                  <div className="space-y-2">
                    <Label>Condição</Label>
                    <Select 
                      value={form.condition_type} 
                      onValueChange={(v) => setForm({ ...form, condition_type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_TYPES.map(ct => (
                          <SelectItem key={ct.value} value={ct.value}>
                            <div>
                              <div>{ct.label}</div>
                              <div className="text-xs text-muted-foreground">{ct.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Condition Comparison & Threshold */}
                  <div className="space-y-2">
                    <Label>Disparar quando for</Label>
                    <div className="flex gap-2 items-center">
                      <Select 
                        value={form.condition_comparison} 
                        onValueChange={(v) => setForm({ ...form, condition_comparison: v as any })}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_COMPARISONS.map(cc => (
                            <SelectItem key={cc.value} value={cc.value}>{cc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={form.condition_threshold}
                        onChange={(e) => setForm({ ...form, condition_threshold: parseInt(e.target.value) || 1 })}
                        className="w-24"
                      />
                      <span className="flex items-center text-sm text-muted-foreground">
                        {CONDITION_TYPES.find(ct => ct.value === form.condition_type)?.unit || 'pedidos'}
                      </span>
                    </div>
                  </div>

                  {/* Delay Threshold (for delayed_orders_count) */}
                  {form.condition_type === 'delayed_orders_count' && (
                    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <Label>Considerar atrasado após: {form.delay_threshold_minutes} minutos</Label>
                      </div>
                      <Slider
                        value={[form.delay_threshold_minutes]}
                        onValueChange={([value]) => setForm({ ...form, delay_threshold_minutes: value })}
                        min={5}
                        max={60}
                        step={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        Pedidos esperando há mais de {form.delay_threshold_minutes} minutos serão contados como atrasados.
                      </p>
                    </div>
                  )}

                  {/* Cooldown */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <Label>Cooldown: {form.cooldown_minutes} minutos</Label>
                    </div>
                    <Slider
                      value={[form.cooldown_minutes]}
                      onValueChange={([value]) => setForm({ ...form, cooldown_minutes: value })}
                      min={5}
                      max={120}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Após disparar, o anúncio não tocará novamente por {form.cooldown_minutes} minutos, mesmo que a condição continue ativa.
                    </p>
                  </div>
                </>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                      {announcement.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline" className={announcement.trigger_type === 'condition' ? 'border-orange-500 text-orange-500' : ''}>
                      {announcement.trigger_type === 'condition' ? (
                        <><Activity className="h-3 w-3 mr-1" />Demanda</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" />Horário</>
                      )}
                    </Badge>
                    <span className="font-medium truncate">{announcement.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {announcement.trigger_type === 'scheduled' && (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>{announcement.scheduled_time.slice(0, 5)}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{getAnnouncementDescription(announcement)}</span>
                    {announcement.trigger_type === 'condition' && (
                      <>
                        <span>•</span>
                        <span>Cooldown: {announcement.cooldown_minutes}min</span>
                      </>
                    )}
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
