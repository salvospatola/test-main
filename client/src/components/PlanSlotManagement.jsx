import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Settings2, Loader2, Save, Plus, Trash2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const api = axios.create({ baseURL: '', withCredentials: true });

const cloneSlot = (slot, fallbackLabel) => ({
  roleKey: slot.roleKey,
  label: slot.label || fallbackLabel || slot.roleKey,
  allowOnlyAssignedRequester: slot.allowOnlyAssignedRequester !== false,
  editableFields: Array.isArray(slot.editableFields) ? [...slot.editableFields] : [],
  targetRules: Array.isArray(slot.targetRules)
    ? slot.targetRules.map((rule) => ({
        mode: rule.mode === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE',
        TeamId: rule.TeamId || '',
        positions: Array.isArray(rule.positions) ? [...rule.positions] : []
      }))
    : []
});

const PlanSlotManagement = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [teams, setTeams] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [slots, setSlots] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [slotsRes, teamsRes] = await Promise.all([
        api.get('/api/plan-slots'),
        api.get('/api/teams')
      ]);
      const defs = slotsRes.data?.roleDefinitions || [];
      const loadedSlots = slotsRes.data?.slots || [];
      const byKey = {};
      defs.forEach((def) => {
        const existing = loadedSlots.find((s) => s.roleKey === def.roleKey);
        byKey[def.roleKey] = cloneSlot(existing || { roleKey: def.roleKey, label: def.label }, def.label);
      });
      setDefinitions(defs);
      setSlots(byKey);
      setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
    } catch (e) {
      toast.error('Dienst-Slots konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const teamPositionsMap = useMemo(() => {
    const map = {};
    teams.forEach((team) => {
      map[team._id] = Array.isArray(team.positions) ? team.positions : [];
    });
    return map;
  }, [teams]);

  const updateSlot = (roleKey, updater) => {
    setSlots((prev) => {
      const current = prev[roleKey] || { roleKey, label: roleKey, editableFields: [], targetRules: [] };
      return { ...prev, [roleKey]: updater(current) };
    });
  };

  const addRule = (roleKey) => {
    updateSlot(roleKey, (slot) => ({
      ...slot,
      targetRules: [...(slot.targetRules || []), { mode: 'INCLUDE', TeamId: '', positions: [] }]
    }));
  };

  const removeRule = (roleKey, index) => {
    updateSlot(roleKey, (slot) => ({
      ...slot,
      targetRules: slot.targetRules.filter((_, idx) => idx !== index)
    }));
  };

  const updateRule = (roleKey, index, updater) => {
    updateSlot(roleKey, (slot) => ({
      ...slot,
      targetRules: slot.targetRules.map((rule, idx) => (idx === index ? updater(rule) : rule))
    }));
  };

  const togglePosition = (roleKey, ruleIndex, position) => {
    updateRule(roleKey, ruleIndex, (rule) => {
      const hasPos = (rule.positions || []).includes(position);
      return {
        ...rule,
        positions: hasPos ? rule.positions.filter((p) => p !== position) : [...(rule.positions || []), position]
      };
    });
  };

  const toggleEditableThema = (roleKey, enabled) => {
    updateSlot(roleKey, (slot) => {
      const hasThema = (slot.editableFields || []).includes('Thema');
      const editableFields = enabled
        ? hasThema ? slot.editableFields : [...(slot.editableFields || []), 'Thema']
        : (slot.editableFields || []).filter((field) => field !== 'Thema');
      return { ...slot, editableFields };
    });
  };

  const saveSlot = async (roleKey) => {
    const slot = slots[roleKey];
    if (!slot) return;
    setSavingKey(roleKey);
    try {
      await api.put(`/api/admin/plan-slots/${roleKey}`, {
        label: slot.label,
        allowOnlyAssignedRequester: slot.allowOnlyAssignedRequester !== false,
        editableFields: slot.editableFields || [],
        targetRules: (slot.targetRules || []).map((rule) => ({
          mode: rule.mode,
          TeamId: rule.TeamId || null,
          positions: rule.positions || []
        }))
      });
      toast.success(`Slot ${slot.label} gespeichert.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Speichern fehlgeschlagen.');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="text-primary" /> Dienst-Slot Regeln
          </h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Definiere pro Slot, wer Vertretungsanfragen erhält und wer Felder bearbeiten darf.
          </p>
        </div>

        <div className="space-y-4">
          {definitions.map((def) => {
            const slot = slots[def.roleKey];
            if (!slot) return null;
            return (
              <Card key={def.roleKey} className="shadow-sm border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-bold">{slot.label}</CardTitle>
                      <CardDescription>{def.roleKey}</CardDescription>
                    </div>
                    <Button onClick={() => saveSlot(def.roleKey)} className="gap-2" disabled={savingKey === def.roleKey}>
                      {savingKey === def.roleKey ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Speichern
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <FieldLabel className="text-xs">Nur eingeteilte Person darf anfragen</FieldLabel>
                        <FieldDescription className="text-[11px]">Wenn aus, dürfen auch Admins stellvertretend Anfragen starten.</FieldDescription>
                      </div>
                      <Switch
                        checked={slot.allowOnlyAssignedRequester !== false}
                        onCheckedChange={(checked) => updateSlot(def.roleKey, (prev) => ({ ...prev, allowOnlyAssignedRequester: checked }))}
                      />
                    </Field>

                    <Field className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <FieldLabel className="text-xs">Thema bearbeitbar</FieldLabel>
                        <FieldDescription className="text-[11px]">Eingeteilte Person dieses Slots darf das Thema setzen.</FieldDescription>
                      </div>
                      <Switch
                        checked={(slot.editableFields || []).includes('Thema')}
                        onCheckedChange={(checked) => toggleEditableThema(def.roleKey, checked)}
                      />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider">Empfänger-Regeln</p>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info size={14} className="text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            INCLUDE-Regeln definieren den Kandidaten-Pool. EXCLUDE-Regeln schließen daraus wieder aus (z.B. Gast-Prediger).
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addRule(def.roleKey)}>
                        <Plus size={14} /> Regel
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {(slot.targetRules || []).map((rule, idx) => {
                        const teamPositions = teamPositionsMap[rule.TeamId] || [];
                        return (
                          <div key={`${def.roleKey}-${idx}`} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <Select value={rule.mode || 'INCLUDE'} onValueChange={(value) => updateRule(def.roleKey, idx, (prev) => ({ ...prev, mode: value }))}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="INCLUDE">INCLUDE</SelectItem>
                                  <SelectItem value="EXCLUDE">EXCLUDE</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={rule.TeamId || '__none'}
                                onValueChange={(value) => updateRule(def.roleKey, idx, (prev) => ({ ...prev, TeamId: value === '__none' ? '' : value, positions: [] }))}
                              >
                                <SelectTrigger className="h-9"><SelectValue placeholder="Team wählen" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">Team wählen</SelectItem>
                                  {teams.map((team) => (
                                    <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Button type="button" variant="ghost" size="sm" className="text-destructive justify-start md:justify-center" onClick={() => removeRule(def.roleKey, idx)}>
                                <Trash2 size={14} className="mr-1" /> Entfernen
                              </Button>
                            </div>

                            {rule.TeamId && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-medium text-muted-foreground">
                                    Positionen (optional)
                                  </p>
                                  {(rule.positions || []).length > 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[10px]"
                                      onClick={() => updateRule(def.roleKey, idx, (prev) => ({ ...prev, positions: [] }))}
                                    >
                                      Ganzes Team erlauben
                                    </Button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                {teamPositions.length === 0 && <span className="text-xs text-muted-foreground">Dieses Team hat keine Positionen.</span>}
                                {teamPositions.map((position) => {
                                  const active = (rule.positions || []).includes(position);
                                  return (
                                    <Badge
                                      key={position}
                                      variant={active ? 'default' : 'secondary'}
                                      className="cursor-pointer h-6"
                                      onClick={() => togglePosition(def.roleKey, idx, position)}
                                    >
                                      {position}
                                    </Badge>
                                  );
                                })}
                                </div>
                                {(rule.positions || []).length === 0 && teamPositions.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Keine Position ausgewählt: gesamte Team-Mitglieder werden berücksichtigt.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {(slot.targetRules || []).length === 0 && (
                        <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                          Keine Regel gesetzt. Dann werden bei Vertretungen manuelle Empfänger benötigt.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PlanSlotManagement;
