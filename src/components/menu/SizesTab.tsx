import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Pizza } from 'lucide-react';
import { ComplementGroup, FlavorOption, useComplementGroupsMutations } from '@/hooks/useComplementGroups';
import { toast } from '@/hooks/use-toast';

interface SizesTabProps {
  complementGroups: ComplementGroup[] | undefined;
}

const ALL_CHANNELS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'counter', label: 'Balcão' },
  { value: 'table', label: 'Mesa' },
];

interface GroupEditState {
  unitCount: number;
  flavorModalEnabled: boolean;
  flavorModalChannels: string[];
  flavorOptions: FlavorOption[];
}

export function SizesTab({ complementGroups }: SizesTabProps) {
  const { updateGroup } = useComplementGroupsMutations();
  const [editStates, setEditStates] = useState<Record<string, GroupEditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const sizeGroups = complementGroups?.filter(g => g.applies_per_unit === true) || [];

  const getState = (group: ComplementGroup): GroupEditState => {
    if (editStates[group.id]) return editStates[group.id];
    return {
      unitCount: group.unit_count ?? 1,
      flavorModalEnabled: group.flavor_modal_enabled ?? true,
      flavorModalChannels: group.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
      flavorOptions: group.flavor_options ?? [
        { count: 1, label: '1 Sabor', description: 'Pizza inteira de um sabor' },
        { count: 2, label: '2 Sabores', description: 'Pizza metade/metade' },
      ],
    };
  };

  const setState = (groupId: string, updater: (prev: GroupEditState) => GroupEditState) => {
    setEditStates(prev => {
      const current = prev[groupId] || getState(sizeGroups.find(g => g.id === groupId)!);
      return { ...prev, [groupId]: updater(current) };
    });
  };

  const handleSave = async (group: ComplementGroup) => {
    const state = getState(group);
    setSavingId(group.id);
    try {
      await updateGroup.mutateAsync({
        id: group.id,
        unit_count: state.unitCount,
        flavor_modal_enabled: state.flavorModalEnabled,
        flavor_modal_channels: state.flavorModalChannels,
        flavor_options: state.flavorOptions,
      });
      // Clear local edit state after successful save
      setEditStates(prev => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const toggleChannel = (groupId: string, channel: string) => {
    setState(groupId, prev => ({
      ...prev,
      flavorModalChannels: prev.flavorModalChannels.includes(channel)
        ? prev.flavorModalChannels.filter(c => c !== channel)
        : [...prev.flavorModalChannels, channel],
    }));
  };

  const addFlavorOption = (groupId: string) => {
    setState(groupId, prev => {
      const nextCount = (prev.flavorOptions.length > 0
        ? Math.max(...prev.flavorOptions.map(o => o.count))
        : 0) + 1;
      return {
        ...prev,
        flavorOptions: [
          ...prev.flavorOptions,
          { count: nextCount, label: `${nextCount} Sabor${nextCount > 1 ? 'es' : ''}`, description: '' },
        ],
      };
    });
  };

  const removeFlavorOption = (groupId: string, index: number) => {
    setState(groupId, prev => ({
      ...prev,
      flavorOptions: prev.flavorOptions.filter((_, i) => i !== index),
    }));
  };

  const updateFlavorOption = (groupId: string, index: number, field: keyof FlavorOption, value: string | number) => {
    setState(groupId, prev => ({
      ...prev,
      flavorOptions: prev.flavorOptions.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      ),
    }));
  };

  const hasChanges = (group: ComplementGroup): boolean => {
    return !!editStates[group.id];
  };

  if (sizeGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Pizza className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum grupo com tamanhos configurado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Para configurar opções de sabores, ative a opção "Aplica por unidade" em um grupo de complemento na aba COMPLEMENTOS.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tamanhos</CardTitle>
          <CardDescription>
            Configure as opções de tamanho/sabores que aparecem para o cliente ao montar seu pedido.
          </CardDescription>
        </CardHeader>
      </Card>

      {sizeGroups.map(group => {
        const state = getState(group);
        const changed = hasChanges(group);

        return (
          <Card key={group.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleSave(group)}
                disabled={!changed || savingId === group.id}
              >
                <Save className="h-4 w-4 mr-1" />
                {savingId === group.id ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quantidade máxima de unidades */}
              <div className="space-y-2">
                <Label>Quantidade máxima de unidades</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={state.unitCount}
                  onChange={e =>
                    setState(group.id, prev => ({ ...prev, unitCount: Math.max(1, parseInt(e.target.value) || 1) }))
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas unidades o cliente poderá configurar individualmente
                </p>
              </div>

              {/* Toggle modal */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modal de seleção de sabores</Label>
                  <p className="text-sm text-muted-foreground">
                    Exibir modal para o cliente escolher a quantidade de sabores
                  </p>
                </div>
                <Switch
                  checked={state.flavorModalEnabled}
                  onCheckedChange={checked =>
                    setState(group.id, prev => ({ ...prev, flavorModalEnabled: checked }))
                  }
                />
              </div>

              {/* Channels */}
              {state.flavorModalEnabled && (
                <>
                  <div>
                    <Label className="mb-2 block">Canais onde o modal aparece</Label>
                    <div className="flex gap-2">
                      {ALL_CHANNELS.map(ch => {
                        const active = state.flavorModalChannels.includes(ch.value);
                        return (
                          <Badge
                            key={ch.value}
                            variant={active ? 'default' : 'outline'}
                            className="cursor-pointer select-none"
                            onClick={() => toggleChannel(group.id, ch.value)}
                          >
                            {ch.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Flavor options table */}
                  <div>
                    <Label className="mb-2 block">Opções de sabores</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Qtd. Sabores</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.flavorOptions.map((opt, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={opt.count}
                                onChange={e =>
                                  updateFlavorOption(group.id, idx, 'count', parseInt(e.target.value) || 1)
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={opt.label}
                                onChange={e =>
                                  updateFlavorOption(group.id, idx, 'label', e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={opt.description}
                                onChange={e =>
                                  updateFlavorOption(group.id, idx, 'description', e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFlavorOption(group.id, idx)}
                                disabled={state.flavorOptions.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => addFlavorOption(group.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar opção
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
