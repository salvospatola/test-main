import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Users, Plus, Trash2, Loader2, Edit2, Save, X, Check, ChevronsUpDown, Grid3X3
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TEAM_ICON_OPTIONS, getTeamIcon } from "@/lib/team-icons";

const api = axios.create({ baseURL: '', withCredentials: true });

const TeamManagement = () => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeam, setEditTeam] = useState(null);
    const [formData, setFormData] = useState({ name: '', positions: [], positionMeta: [], description: '' });
    const [newPosition, setNewPosition] = useState('');
    const [newPositionIcon, setNewPositionIcon] = useState('Tag');
    const [iconPickerOpen, setIconPickerOpen] = useState(false);
    const [iconGalleryOpen, setIconGalleryOpen] = useState(false);
    const [iconGalleryFilter, setIconGalleryFilter] = useState('');
    const safeIconOptions = useMemo(() => {
        const source = Array.isArray(TEAM_ICON_OPTIONS) ? TEAM_ICON_OPTIONS : [];
        const normalized = source
            .filter((opt) => opt && typeof opt.value === 'string' && opt.value.trim())
            .map((opt) => ({ value: String(opt.value).trim(), label: String(opt.label || opt.value).trim() || String(opt.value).trim() }));
        if (normalized.length > 0) return normalized;
        return [{ value: 'Tag', label: 'Tag' }];
    }, []);

    const resolvePositionMeta = (teamLike) => {
        const rawPositions = Array.isArray(teamLike?.positions) ? teamLike.positions : [];
        const rawMeta = Array.isArray(teamLike?.positionMeta) ? teamLike.positionMeta : [];
        const metaByName = new Map(
            rawMeta
                .filter((m) => m?.name)
                .map((m) => [String(m.name).trim(), { name: String(m.name).trim(), icon: m.icon || 'Tag' }])
        );
        return rawPositions
            .map((pos) => String(pos || '').trim())
            .filter(Boolean)
            .map((name) => metaByName.get(name) || { name, icon: 'Tag' });
    };

    const fetchTeams = async () => {
        try {
            const res = await api.get('/api/teams');
            setTeams(res.data);
        } catch (e) {
            toast.error("Teams konnten nicht geladen werden.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const handleOpenModal = (team = null) => {
        if (team) {
            setEditTeam(team);
            const nextMeta = resolvePositionMeta(team);
            setFormData({
                name: team.name,
                positions: nextMeta.map((m) => m.name),
                positionMeta: nextMeta,
                description: team.description || ''
            });
        } else {
            setEditTeam(null);
            setFormData({ name: '', positions: [], positionMeta: [], description: '' });
        }
        setNewPosition('');
        setNewPositionIcon('Tag');
        setIconPickerOpen(false);
        setIsModalOpen(true);
    };

    const handleAddPosition = (e) => {
        if (e) e.preventDefault();
        const normalizedName = newPosition.trim();
        if (!normalizedName) return;
        if (formData.positionMeta.some((meta) => meta.name.toLowerCase() === normalizedName.toLowerCase())) return;
        const nextMeta = [...formData.positionMeta, { name: normalizedName, icon: newPositionIcon || 'Tag' }];
        setFormData({
            ...formData,
            positions: nextMeta.map((meta) => meta.name),
            positionMeta: nextMeta
        });
        setNewPosition('');
        setNewPositionIcon('Tag');
    };

    const handleRemovePosition = (pos) => {
        const nextMeta = formData.positionMeta.filter((meta) => meta.name !== pos);
        setFormData({
            ...formData,
            positions: nextMeta.map((meta) => meta.name),
            positionMeta: nextMeta
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return toast.error("Name ist erforderlich.");
        const normalizedMeta = (formData.positionMeta || [])
            .map((meta) => ({
                name: String(meta?.name || '').trim(),
                icon: String(meta?.icon || 'Tag')
            }))
            .filter((meta) => meta.name);
        const payload = {
            ...formData,
            positions: normalizedMeta.map((meta) => meta.name),
            positionMeta: normalizedMeta
        };
        try {
            if (editingTeam) {
                await api.put(`/api/teams/${editingTeam._id}`, payload);
                toast.success("Team aktualisiert");
            } else {
                await api.post('/api/teams', payload);
                toast.success("Team erstellt");
            }
            setIsModalOpen(false);
            fetchTeams();
        } catch (e) {
            toast.error("Fehler beim Speichern");
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Team "${name}" wirklich löschen?`)) return;
        try {
            await api.delete(`/api/teams/${id}`);
            fetchTeams();
            toast.success("Team gelöscht");
        } catch (e) {
            toast.error("Fehler beim Löschen");
        }
    };

    const selectedIconOption = safeIconOptions.find((opt) => opt.value === newPositionIcon) || safeIconOptions[0];
    const SelectedIcon = getTeamIcon(selectedIconOption.value);
    const galleryOptions = useMemo(() => {
        const q = String(iconGalleryFilter || '').trim().toLowerCase();
        if (!q) return safeIconOptions;
        return safeIconOptions.filter((option) => (
            option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)
        ));
    }, [iconGalleryFilter, safeIconOptions]);

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="text-emerald-600" /> Team-Strukturen
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Organisation von Fachgruppen und Positionen</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2">
                    <Plus size={18} /> Team erstellen
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {teams.map(team => (
                    <Card key={team._id} className="group hover:border-primary/30 transition-all shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-bold">{team.name}</CardTitle>
                                    <CardDescription className="text-xs line-clamp-1">{team.description || 'Keine Beschreibung'}</CardDescription>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(team)}>
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(team._id, team.name)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Positionen ({team.positions?.length || 0})</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {resolvePositionMeta(team).map((positionMeta) => {
                                        const PositionIcon = getTeamIcon(positionMeta.icon);
                                        return (
                                        <Badge key={`${team._id}-${positionMeta.name}`} variant="secondary" className="font-semibold text-[10px] h-6 gap-1.5">
                                            <PositionIcon size={12} />
                                            {positionMeta.name}
                                        </Badge>
                                        );
                                    })}
                                    {(!team.positions || team.positions.length === 0) && (
                                        <span className="text-xs text-muted-foreground italic">Keine Positionen definiert</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {teams.length === 0 && (
                    <div className="col-span-full py-24 text-center border border-dashed rounded-2xl bg-muted/10">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <h3 className="font-bold text-lg">Noch keine Teams vorhanden</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">Erstelle Teams wie 'Musik', 'Technik' oder 'Küche' und definiere dort Rollen.</p>
                        <Button variant="outline" className="mt-6" onClick={() => handleOpenModal()}>
                            Erstes Team anlegen
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg p-0 overflow-hidden shadow-2xl rounded-xl border">
                    <DialogHeader className="p-6 pb-4 bg-muted/30 border-b">
                        <DialogTitle className="text-xl font-bold tracking-tight">
                            {editingTeam ? 'Team bearbeiten' : 'Neues Team erstellen'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Definiere ein Team und die verfügbaren Positionen.</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-6">
                        <Field>
                            <FieldLabel>Team Name</FieldLabel>
                            <Input placeholder="z.B. Musik Team" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </Field>
                        <Field>
                            <FieldLabel>Beschreibung (Optional)</FieldLabel>
                            <Input placeholder="Kurze Info zum Team..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </Field>
                        <div className="space-y-4 pt-4 border-t">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Positionen verwalten</p>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
                                <Input 
                                    placeholder="Position hinzufügen (z.B. Bass)..." 
                                    value={newPosition} 
                                    onChange={e => setNewPosition(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddPosition(e)}
                                />
                                <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="outline" role="combobox" className="justify-between min-w-[190px]">
                                            <span className="inline-flex items-center gap-2">
                                                <SelectedIcon size={14} />
                                                {selectedIconOption.label}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[260px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Icon suchen..." />
                                            <CommandList>
                                                <CommandEmpty>Kein Icon gefunden.</CommandEmpty>
                                                <CommandGroup>
                                                    {safeIconOptions.map((opt) => {
                                                        const IconCmp = getTeamIcon(opt.value);
                                                        return (
                                                            <CommandItem
                                                                key={opt.value}
                                                                value={`${opt.value} ${opt.label}`}
                                                                onSelect={() => {
                                                                    setNewPositionIcon(opt.value);
                                                                    setIconPickerOpen(false);
                                                                }}
                                                            >
                                                                <IconCmp size={14} className="mr-2" />
                                                                <span className="flex-1">{opt.label}</span>
                                                                <Check className={cn("h-4 w-4", newPositionIcon === opt.value ? "opacity-100" : "opacity-0")} />
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <Button type="button" variant="outline" onClick={() => setIconGalleryOpen(true)} className="gap-2">
                                    <Grid3X3 size={15} /> Alle Icons
                                </Button>
                                <Button type="button" onClick={handleAddPosition} variant="secondary">
                                    <Plus size={18} />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {formData.positionMeta.map((positionMeta) => {
                                    const PositionIcon = getTeamIcon(positionMeta.icon);
                                    return (
                                    <Badge key={positionMeta.name} variant="default" className="gap-1 pr-1 h-7 text-xs font-semibold">
                                        <PositionIcon size={13} />
                                        {positionMeta.name}
                                        <button type="button" onClick={() => handleRemovePosition(positionMeta.name)} className="ml-1 hover:text-destructive transition-colors">
                                            <X size={14} />
                                        </button>
                                    </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
                        <Button className="font-bold" onClick={handleSave}>
                            <Save size={18} className="mr-2" /> TEAM SPEICHERN
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={iconGalleryOpen} onOpenChange={setIconGalleryOpen}>
                <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Lucide Icons</DialogTitle>
                        <DialogDescription>
                            Wähle ein Icon aus der vollständigen Lucide-Liste.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 flex-1 overflow-hidden">
                        <Input
                            placeholder="Icon suchen..."
                            value={iconGalleryFilter}
                            onChange={(e) => setIconGalleryFilter(e.target.value)}
                        />
                        <div className="h-full min-h-0 overflow-y-auto rounded-lg border p-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {galleryOptions.map((opt) => {
                                    const IconCmp = getTeamIcon(opt.value);
                                    const active = newPositionIcon === opt.value;
                                    return (
                                        <button
                                            key={`gallery-${opt.value}`}
                                            type="button"
                                            className={cn(
                                                "rounded-md border px-2 py-2 text-left hover:bg-accent transition-colors",
                                                active && "border-primary bg-primary/5"
                                            )}
                                            onClick={() => {
                                                setNewPositionIcon(opt.value);
                                                setIconGalleryOpen(false);
                                            }}
                                        >
                                            <div className="inline-flex items-center gap-2">
                                                <IconCmp size={15} />
                                                <span className="text-xs font-semibold truncate">{opt.label}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground truncate mt-1">{opt.value}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIconGalleryOpen(false)}>Schließen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TeamManagement;
