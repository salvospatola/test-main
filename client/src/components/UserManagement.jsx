import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { 
    Trash2, Search, Check, Ban, Unlock, UserPlus, Edit2, Shield, MoreHorizontal, Loader2, X, Phone
} from 'lucide-react';
import { cn, formatRoleLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { UserAvatar } from './UserAvatar';
import PhoneInput, { COUNTRY_CODES } from './PhoneInput';
import { DatePicker } from './ui/date-time-picker';
import { ComboboxMultiple } from './ui/combobox-multiple';

const api = axios.create({ baseURL: '', withCredentials: true });

const UserManagement = ({ currentUser, showConfirm, showToast }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [roles, setRoles] = useState([]);
    const [existingTags, setExistingTags] = useState([]);
    const [teams, setTeams] = useState([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ 
        firstName: '', lastName: '', username: '', roles: [], tags: [],
        email: '', birthday: '', teamPositions: []
    });
    const [countryCode, setCountryCode] = useState('49');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(true);
    const [knownNumbers, setKnownNumbers] = useState([]);
    const [isPhoneBookOpen, setIsPhoneBookOpen] = useState(false);
    const [phoneBookQuery, setPhoneBookQuery] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const [resUsers, resRoles, resTags, resTeams, resKnownNumbers] = await Promise.all([
                api.get('/api/users').catch(() => ({ data: [] })),
                api.get('/api/roles').catch(() => ({ data: [] })),
                api.get('/api/admin/tags').catch(() => ({ data: [] })),
                api.get('/api/teams').catch(() => ({ data: [] })),
                api.get('/api/whatsapp/known-numbers').catch(() => ({ data: { numbers: [] } }))
            ]);
            setUsers(Array.isArray(resUsers.data) ? resUsers.data : []);
            setExistingTags(Array.isArray(resTags.data) ? resTags.data.map(t => t.name) : []);
            setTeams(Array.isArray(resTeams.data) ? resTeams.data : []);
            setKnownNumbers(Array.isArray(resKnownNumbers.data?.numbers) ? resKnownNumbers.data.numbers : []);
            
            // Filter roles to avoid duplicates like ADMIN/admin and USER/user
            const uniqueRoles = [];
            const seen = new Set();
            if (Array.isArray(resRoles.data)) {
                resRoles.data.forEach(r => {
                    const normalized = r.name.toUpperCase();
                    if (!seen.has(normalized)) {
                        seen.add(normalized);
                        uniqueRoles.push(r);
                    }
                });
            }
            setRoles(uniqueRoles);
        } catch (e) {
            console.error("Failed to load users", e);
            if (showToast) showToast("Fehler beim Laden", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSave = async () => {
        if (phoneNumber && !isPhoneValid) {
            if (showToast) showToast("Ungültige Telefonnummer", "error");
            return;
        }

        // Map role names to IDs
        const selectedRoleIds = formData.roles.map(rName => {
            const match = roles.find(r => r.name.toUpperCase() === rName.toUpperCase());
            return match ? match._id : null;
        }).filter(Boolean);

        const payload = { 
            ...formData, 
            roleIds: selectedRoleIds,
            phone: phoneNumber ? countryCode + phoneNumber : '' 
        };

        try {
            if (editingUser) {
                await api.put(`/api/users/${editingUser._id}`, payload);
                if (showToast) showToast("Benutzer aktualisiert", "success");
            } else {
                await api.post('/api/users', payload);
                if (showToast) showToast("Benutzer erstellt", "success");
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || "Fehler beim Speichern", "error");
        }
    };

    const handleDelete = (id) => {
        if (showConfirm) showConfirm("Benutzer löschen", "Wirklich löschen?", async () => {
            try {
                await api.delete(`/api/users/${id}`);
                if (showToast) showToast("Gelöscht", "success");
                fetchUsers();
            } catch (e) {
                if (showToast) showToast("Fehler", "error");
            }
        });
    };

    const handleLock = async (user) => {
        const isLocked = user.lockUntil && new Date(user.lockUntil) > new Date();
        try {
            await api.put(`/api/users/${user._id}/lock`, { locked: !isLocked });
            if (showToast) showToast(isLocked ? "Entsperrt" : "Gesperrt", "success");
            fetchUsers();
        } catch (e) {
            if (showToast) showToast("Fehler", "error");
        }
    };

    const handleInputChange = (field, value) => {
        const updated = { ...formData, [field]: value };
        
        // Auto-generate username only for NEW users
        if (!editingUser && (field === 'firstName' || field === 'lastName')) {
            const firstPart = (updated.lastName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const secondPart = (updated.firstName || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toLowerCase();
            if (firstPart || secondPart) {
                updated.username = firstPart + secondPart;
            }
        }
        
        setFormData(updated);
    };

    const openModal = (user = null) => {
        setEditingUser(user);
        if (user) {
            setFormData({ 
                firstName: user.firstName || '', 
                lastName: user.lastName || '', 
                username: user.username || '', 
                roles: Array.isArray(user.RoleIds) ? user.RoleIds.map(r => r.name) : (user.role ? [user.role] : []),
                tags: Array.isArray(user.tags) ? user.tags : [],
                email: user.email || '',
                birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
                teamPositions: Array.isArray(user.teamPositions) ? user.teamPositions : []
            });

            if (user.phone) {
                const sortedCodes = [...COUNTRY_CODES].sort((a,b) => b.code.length - a.code.length);
                const match = sortedCodes.find(c => user.phone.startsWith(c.code));
                if (match) {
                    setCountryCode(match.code);
                    setPhoneNumber(user.phone.substring(match.code.length));
                } else {
                    setCountryCode('49');
                    setPhoneNumber(user.phone);
                }
            } else {
                setCountryCode('49');
                setPhoneNumber('');
            }
        } else {
            setFormData({ 
                firstName: '', lastName: '', username: '', roles: ['MEMBER'], tags: [],
                email: '', birthday: '', teamPositions: []
            });
            setCountryCode('49');
            setPhoneNumber('');
        }
        setIsModalOpen(true);
    };

    const toggleTeamPosition = (teamId, position) => {
        const exists = formData.teamPositions.find(tp => tp.TeamId === teamId && tp.position === position);
        let updated;
        if (exists) {
            updated = formData.teamPositions.filter(tp => !(tp.TeamId === teamId && tp.position === position));
        } else {
            updated = [...formData.teamPositions, { TeamId: teamId, position }];
        }
        setFormData({ ...formData, teamPositions: updated });
    };

    const filtered = users.filter(u => 
        (u.firstName?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (u.lastName?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (u.username?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (u.tags || []).some(t => t.toLowerCase().includes(filter.toLowerCase()))
    );

    const phoneBookEntries = Array.isArray(knownNumbers)
        ? knownNumbers.map((entry) => {
            if (typeof entry === 'string') {
                const normalized = String(entry).replace(/\D/g, '');
                return { number: normalized, displayName: normalized, groups: 0 };
            }
            const normalized = String(entry?.number || '').replace(/\D/g, '');
            return {
                number: normalized,
                displayName: String(entry?.displayName || normalized || ''),
                groups: Number(entry?.groups || 0)
            };
        }).filter((entry) => entry.number)
        : [];

    const filteredPhoneBookEntries = phoneBookEntries.filter((entry) => {
        const q = phoneBookQuery.trim().toLowerCase();
        if (!q) return true;
        return entry.number.toLowerCase().includes(q) || entry.displayName.toLowerCase().includes(q);
    });

    const applyPhoneBookEntry = (entry) => {
        const normalized = String(entry?.number || '').replace(/\D/g, '');
        if (!normalized) return;
        const parsed = parsePhoneNumberFromString(`+${normalized}`);
        if (parsed?.countryCallingCode && parsed?.nationalNumber) {
            setCountryCode(parsed.countryCallingCode);
            setPhoneNumber(String(parsed.nationalNumber));
        } else {
            const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
            const matched = sortedCodes.find((c) => normalized.startsWith(c.code));
            if (matched) {
                setCountryCode(matched.code);
                setPhoneNumber(normalized.slice(matched.code.length));
            } else {
                setCountryCode('49');
                setPhoneNumber(normalized);
            }
        }
        setIsPhoneBookOpen(false);
        setPhoneBookQuery('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold tracking-tight">Benutzer</CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-normal">Account Verwaltung</CardDescription>
                    </div>
                    <Button onClick={() => openModal()} className="gap-2">
                        <UserPlus size={18} /> Neuer Benutzer
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input 
                                placeholder="Suchen (Name, User, Kategorien)..." 
                                className="pl-9 h-10 font-medium" 
                                value={filter} 
                                onChange={e => setFilter(e.target.value)} 
                            />
                        </div>
                        <Badge variant="outline" className="h-10 px-4 text-xs font-bold hidden sm:flex">
                            {filtered.length} Accounts
                        </Badge>
                    </div>

                    <div className="rounded-xl border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6 h-12 text-xs font-bold uppercase tracking-wider text-muted-foreground">User</TableHead>
                                    <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status & Teams</TableHead>
                                    <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rolle</TableHead>
                                    <TableHead className="h-12 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-medium"><Loader2 className="animate-spin inline mr-2" /> Lade Benutzer...</TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-medium">Keine Ergebnisse.</TableCell></TableRow>
                                ) : filtered.map(u => {
                                    const isLocked = u.lockUntil && new Date(u.lockUntil) > new Date();
                                    return (
                                        <TableRow key={u._id} className={cn("hover:bg-muted/5 transition-colors", isLocked && "bg-destructive/5")}>
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar user={u} size="md" />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-sm tracking-tight">{u.firstName} {u.lastName}</span>
                                                        <span className="text-xs text-muted-foreground truncate">@{u.username}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {isLocked ? (
                                                            <Badge variant="destructive" className="h-5 px-2 text-[10px] font-bold">GESPERRT</Badge>
                                                        ) : (
                                                            <Badge variant="success" className="h-5 px-2 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20">AKTIV</Badge>
                                                        )}
                                                        {(u.teamPositions || []).map((tp, tpIdx) => {
                                                            const team = teams.find(t => t._id === (tp.TeamId?._id || tp.TeamId));
                                                            return (
                                                                <Badge key={`${u._id}-tp-${tpIdx}`} variant="outline" className="h-5 px-2 text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
                                                                    {team?.name || 'Team'}: {tp.position}
                                                                </Badge>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(u.tags || []).map(t => (
                                                            <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[8px] font-bold lowercase opacity-70">{t}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(Array.isArray(u.RoleIds) ? u.RoleIds : []).map((r, rIdx) => (
                                                        <Badge key={`${r._id || r.id}-${rIdx}`} variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase">
                                                            {formatRoleLabel(r.name)}
                                                        </Badge>
                                                    ))}
                                                    {(!u.RoleIds || u.RoleIds.length === 0) && <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase">{formatRoleLabel(u.role)}</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={16} /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Optionen</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openModal(u)}><Edit2 className="mr-2 h-4 w-4" /> Bearbeiten</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleLock(u)}>
                                                            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                                                            {isLocked ? 'Entsperren' : 'Sperren'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(u._id)}><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 shadow-2xl rounded-xl border">
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
                        <DialogTitle>{editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Account Details und Team-Zugehörigkeit anpassen.</DialogDescription>
                    </DialogHeader>
                    
                                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                <div className="md:col-span-2">
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-1">Persönliche Daten</p>
                                                </div>
                                                
                                                <Field>
                                                    <FieldLabel htmlFor="firstName">Vorname</FieldLabel>
                                                    <Input id="firstName" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} />
                                                </Field>
                                                <Field>
                                                    <FieldLabel htmlFor="lastName">Nachname</FieldLabel>
                                                    <Input id="lastName" value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} />
                                                </Field>
                    
                                                <Field>
                                                    <FieldLabel htmlFor="username">Username</FieldLabel>
                                                    <Input id="username" value={formData.username} onChange={e => handleInputChange('username', e.target.value)} />
                                                </Field>
                                                <Field>
                                                    <FieldLabel htmlFor="email">E-Mail</FieldLabel>
                                                    <Input id="email" type="email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                                                </Field>
                    
                                                <Field className="grid gap-2">
                                                    <FieldLabel htmlFor="birthday">Geburtstag</FieldLabel>
                                                    <DatePicker value={formData.birthday} onChange={v => setFormData({...formData, birthday: v})} />
                                                </Field>
                                                <PhoneInput 
                                                    label="Handynummer"
                                                    countryCode={countryCode} setCountryCode={setCountryCode}
                                                    phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber}
                                                    onValidationChange={setIsPhoneValid}
                                                    suggestions={knownNumbers}
                                                />
                                                <div className="md:col-span-2 -mt-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="gap-2"
                                                        onClick={() => setIsPhoneBookOpen(true)}
                                                    >
                                                        <Phone size={15} />
                                                        Nummer aus WhatsApp-Telefonbuch wählen
                                                    </Button>
                                                </div>
                    
                                                <div className="md:col-span-2 pt-4">
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-1">Berechtigungen & Kategorien</p>
                                                </div>
                    
                                                <Field className="grid gap-2">
                                                    <FieldLabel htmlFor="roles">Rollen</FieldLabel>
                                                    <ComboboxMultiple 
                                                        options={roles.map(r => ({ label: formatRoleLabel(r.name), value: r.name }))}
                                                        selected={formData.roles}
                                                        onChange={val => setFormData({...formData, roles: val})}
                                                        placeholder="Rollen wählen..."
                                                    />
                                                </Field>
                                                <Field className="grid gap-2">
                                                    <FieldLabel htmlFor="tags">Kategorien</FieldLabel>
                                                    <ComboboxMultiple 
                                                        options={existingTags.map(t => ({ label: t, value: t }))}
                                                        selected={formData.tags}
                                                        onChange={val => setFormData({...formData, tags: val})}
                                                        placeholder="Kategorien wählen..."
                                                    />
                                                </Field>
                    
                                                <div className="md:col-span-2 pt-4">
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-1">Team Positionen</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mt-4">
                                                        {teams.map(team => (
                                                            <div key={team._id} className="space-y-2">
                                                                <p className="text-xs font-bold text-muted-foreground">{team.name}</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {team.positions?.map(pos => {
                                                                        const isActive = formData.teamPositions.some(tp => (tp.TeamId?._id || tp.TeamId) === team._id && tp.position === pos);
                                                                        return (
                                                                            <Badge 
                                                                                key={`${team._id}-${pos}`} 
                                                                                variant={isActive ? "default" : "outline"} 
                                                                                className={cn("cursor-pointer h-6 px-2 text-[10px] font-semibold transition-all", !isActive && "opacity-50 hover:opacity-100")}
                                                                                onClick={() => toggleTeamPosition(team._id, pos)}
                                                                            >
                                                                                {pos}
                                                                            </Badge>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {teams.length === 0 && (
                                                            <p className="text-xs text-muted-foreground italic md:col-span-2">Keine Teams konfiguriert.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                    <DialogFooter className="p-6 pt-4 border-t bg-muted/30 gap-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="font-semibold">Abbrechen</Button>
                        <Button onClick={handleSave} className="font-bold">BENUTZER SPEICHERN</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPhoneBookOpen} onOpenChange={setIsPhoneBookOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>WhatsApp-Telefonbuch</DialogTitle>
                        <DialogDescription>
                            Alle bekannten Nummern aus WhatsApp-Gruppenmitgliedschaften. Suche nach Nummer oder Anzeigename.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 overflow-hidden flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Suchen nach Name oder Nummer..."
                                className="pl-9"
                                value={phoneBookQuery}
                                onChange={(e) => setPhoneBookQuery(e.target.value)}
                            />
                        </div>
                        <div className="rounded-lg border overflow-y-auto max-h-[50vh]">
                            {filteredPhoneBookEntries.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground">Keine passenden Einträge gefunden.</div>
                            ) : (
                                <div className="divide-y">
                                    {filteredPhoneBookEntries.map((entry) => (
                                        <div key={entry.number} className="flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{entry.displayName}</p>
                                                <p className="text-xs text-muted-foreground font-mono">+{entry.number}</p>
                                            </div>
                                            <Button type="button" size="sm" onClick={() => applyPhoneBookEntry(entry)}>
                                                Hinzufügen
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsPhoneBookOpen(false)}>Schließen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagement;
