import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Users, UserPlus, Loader2, Shield, Check, X, Crown, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTeamIcon } from '@/lib/team-icons';

const api = axios.create({ baseURL: '', withCredentials: true });

const getUserLabel = (user) => {
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return fullName || user?.username || 'Unbekannt';
};

const resolvePositionIconName = (team, position) => {
    const meta = (team?.positionMeta || []).find((item) => String(item?.name || '').trim() === String(position || '').trim());
    return String(meta?.icon || 'Tag');
};

const MyTeams = () => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('mine');
    const hasManualViewSelection = useRef(false);
    const [requestDialog, setRequestDialog] = useState({ open: false, team: null });
    const [requestPositions, setRequestPositions] = useState([]);
    const [requestMessage, setRequestMessage] = useState('');
    const [requestSaving, setRequestSaving] = useState(false);

    const [modDialog, setModDialog] = useState({ open: false, team: null });
    const [modRequests, setModRequests] = useState([]);
    const [modLoading, setModLoading] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [manualUserId, setManualUserId] = useState('');
    const [manualRole, setManualRole] = useState('MEMBER');
    const [manualPositions, setManualPositions] = useState([]);
    const [manualSaving, setManualSaving] = useState(false);

    const fetchTeams = async () => {
        try {
            const res = await api.get('/api/teams/my');
            const nextTeams = Array.isArray(res.data?.teams) ? res.data.teams : [];
            setTeams(nextTeams);

            // Default: "Meine Teams", fallback to register if user has no memberships.
            if (!hasManualViewSelection.current) {
                const hasOwnTeams = nextTeams.some((team) => Boolean(team?.membershipRole));
                setView(hasOwnTeams ? 'mine' : 'register');
            }
        } catch (e) {
            toast.error(e.response?.data?.error || 'Teams konnten nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const openRequestDialog = (team) => {
        const pending = team?.pendingRequest;
        setRequestDialog({ open: true, team });
        setRequestPositions(Array.isArray(pending?.requestedPositions) ? pending.requestedPositions : []);
        setRequestMessage('');
    };

    const togglePosition = (position, setter, current) => {
        if (current.includes(position)) {
            setter(current.filter((item) => item !== position));
            return;
        }
        setter([...current, position]);
    };

    const submitRequest = async () => {
        if (!requestDialog.team?._id) return;
        if (requestPositions.length === 0) {
            toast.error('Bitte mindestens eine Position auswählen.');
            return;
        }
        setRequestSaving(true);
        try {
            await api.post(`/api/teams/${requestDialog.team._id}/requests`, {
                positions: requestPositions,
                message: requestMessage
            });
            toast.success('Teilnahmeanfrage gesendet.');
            setRequestDialog({ open: false, team: null });
            fetchTeams();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Anfrage konnte nicht gesendet werden.');
        } finally {
            setRequestSaving(false);
        }
    };

    const openModDialog = async (team) => {
        setModDialog({ open: true, team });
        setModLoading(true);
        try {
            const [reqRes, userRes] = await Promise.all([
                api.get(`/api/teams/${team._id}/requests`),
                api.get('/api/users')
            ]);
            setModRequests(Array.isArray(reqRes.data?.requests) ? reqRes.data.requests : []);
            setAllUsers(Array.isArray(userRes.data) ? userRes.data : []);
            setManualUserId('');
            setManualRole('MEMBER');
            setManualPositions([]);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Moderationsdaten konnten nicht geladen werden.');
        } finally {
            setModLoading(false);
        }
    };

    const handleRequestAction = async (requestId, action) => {
        if (!modDialog.team?._id || !requestId) return;
        try {
            await api.post(`/api/teams/${modDialog.team._id}/requests/${requestId}`, { action });
            toast.success(action === 'approve' ? 'Anfrage angenommen.' : 'Anfrage abgelehnt.');
            await Promise.all([fetchTeams(), openModDialog(modDialog.team)]);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Anfrage konnte nicht bearbeitet werden.');
        }
    };

    const saveManualMember = async () => {
        if (!modDialog.team?._id) return;
        if (!manualUserId) {
            toast.error('Bitte einen Benutzer auswählen.');
            return;
        }
        if (manualPositions.length === 0) {
            toast.error('Bitte mindestens eine Position wählen.');
            return;
        }
        setManualSaving(true);
        try {
            await api.post(`/api/teams/${modDialog.team._id}/members/upsert`, {
                userId: manualUserId,
                role: manualRole,
                positions: manualPositions
            });
            toast.success('Mitglied gespeichert.');
            await Promise.all([fetchTeams(), openModDialog(modDialog.team)]);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Mitglied konnte nicht gespeichert werden.');
        } finally {
            setManualSaving(false);
        }
    };

    const removeMember = async (teamId, userId) => {
        try {
            await api.delete(`/api/teams/${teamId}/members/${userId}`);
            toast.success('Mitglied entfernt.');
            await Promise.all([fetchTeams(), openModDialog(modDialog.team)]);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Mitglied konnte nicht entfernt werden.');
        }
    };

    const changeMemberRole = async (teamId, member) => {
        try {
            const nextRole = member.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR';
            await api.post(`/api/teams/${teamId}/members/upsert`, {
                userId: member._id,
                role: nextRole,
                positions: member.positions || []
            });
            toast.success('Rolle aktualisiert.');
            await Promise.all([fetchTeams(), openModDialog(modDialog.team)]);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Rolle konnte nicht geändert werden.');
        }
    };

    const modTeam = useMemo(
        () => teams.find((team) => String(team._id) === String(modDialog.team?._id || '')) || modDialog.team,
        [teams, modDialog.team]
    );

    const availableManualUsers = useMemo(() => {
        const existingIds = new Set((modTeam?.members || []).map((member) => String(member._id)));
        return allUsers.filter((user) => !existingIds.has(String(user._id)));
    }, [allUsers, modTeam]);

    const myTeams = useMemo(
        () => teams.filter((team) => Boolean(team?.membershipRole)),
        [teams]
    );

    const registerTeams = useMemo(
        () => teams.filter((team) => !team?.membershipRole),
        [teams]
    );

    const visibleTeams = view === 'mine' ? myTeams : registerTeams;

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="text-primary" /> Meine Teams
                </h2>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mitgliedschaften, Rollen und Team-Positionen</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    variant={view === 'mine' ? 'default' : 'outline'}
                    onClick={() => {
                        hasManualViewSelection.current = true;
                        setView('mine');
                    }}
                >
                    Meine Teams ({myTeams.length})
                </Button>
                <Button
                    size="sm"
                    variant={view === 'register' ? 'default' : 'outline'}
                    onClick={() => {
                        hasManualViewSelection.current = true;
                        setView('register');
                    }}
                >
                    Team Register ({registerTeams.length})
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {visibleTeams.map((team) => (
                    <Card key={team._id} className="shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <CardTitle className="text-lg">{team.name}</CardTitle>
                                    <CardDescription>{team.description || 'Keine Beschreibung'}</CardDescription>
                                </div>
                                {team.membershipRole ? (
                                    <Badge variant={team.membershipRole === 'MODERATOR' ? 'default' : 'secondary'}>
                                        {team.membershipRole === 'MODERATOR' ? 'Moderator' : 'Mitglied'}
                                    </Badge>
                                ) : team.pendingRequest ? (
                                    <Badge variant="outline">Anfrage offen</Badge>
                                ) : (
                                    <Badge variant="outline">Nicht im Team</Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {!team.membershipRole && (
                                    <Button size="sm" variant="outline" className="gap-2" onClick={() => openRequestDialog(team)}>
                                        <UserPlus size={14} /> Teilnahme anfordern
                                    </Button>
                                )}
                                {team.canModerate && (
                                    <Button size="sm" className="gap-2" onClick={() => openModDialog(team)}>
                                        <Shield size={14} /> Moderieren
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Teammitglieder ({team.members?.length || 0})</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {(team.members || []).map((member) => (
                                    <div key={`${team._id}-${member._id}`} className="rounded-lg border p-2.5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profileImage || ''} />
                                                <AvatarFallback>{(member.firstName?.[0] || member.username?.[0] || '?').toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{getUserLabel(member)}</p>
                                                <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={member.role === 'MODERATOR' ? 'default' : 'outline'} className="mb-1">
                                                {member.role === 'MODERATOR' ? <Crown size={12} className="mr-1" /> : null}
                                                {member.role === 'MODERATOR' ? 'Moderator' : 'Mitglied'}
                                            </Badge>
                                            <div className="flex flex-wrap justify-end gap-1">
                                                {(member.positions || []).length > 0 ? (member.positions || []).map((position) => {
                                                    const IconCmp = getTeamIcon(resolvePositionIconName(team, position));
                                                    return (
                                                        <Badge key={`${member._id}-${position}`} variant="outline" className="h-5 px-1.5 text-[10px] gap-1">
                                                            <IconCmp size={11} />
                                                            {position}
                                                        </Badge>
                                                    );
                                                }) : (
                                                    <span className="text-[11px] text-muted-foreground">Keine Position</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(team.members || []).length === 0 && (
                                    <div className="text-sm text-muted-foreground italic rounded-lg border border-dashed p-3 text-center">
                                        Noch keine Mitglieder.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {visibleTeams.length === 0 && (
                    <Card className="col-span-full border-dashed">
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            {view === 'mine'
                                ? 'Du bist aktuell in keinem Team. Wechsle zu "Team Register", um beizutreten.'
                                : 'Keine Teams im Register gefunden.'}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={requestDialog.open} onOpenChange={(open) => setRequestDialog((prev) => ({ ...prev, open }))}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Teilnahme anfordern</DialogTitle>
                        <DialogDescription>
                            {requestDialog.team?.name}: Bitte mindestens eine Position auswählen, in der du dich siehst.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {(requestDialog.team?.positions || []).map((position) => {
                                const IconCmp = getTeamIcon(resolvePositionIconName(requestDialog.team, position));
                                return (
                                    <Button
                                        key={`req-pos-${position}`}
                                        type="button"
                                        size="sm"
                                        variant={requestPositions.includes(position) ? 'default' : 'outline'}
                                        onClick={() => togglePosition(position, setRequestPositions, requestPositions)}
                                        className="gap-1.5"
                                    >
                                        <IconCmp size={13} />
                                        {position}
                                    </Button>
                                );
                            })}
                        </div>
                        <Textarea
                            value={requestMessage}
                            onChange={(e) => setRequestMessage(e.target.value)}
                            placeholder="Optionale Nachricht an die Moderatoren..."
                            className="min-h-24"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRequestDialog({ open: false, team: null })}>Abbrechen</Button>
                        <Button onClick={submitRequest} disabled={requestSaving}>
                            {requestSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Anfrage senden
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={modDialog.open} onOpenChange={(open) => setModDialog((prev) => ({ ...prev, open }))}>
                <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Team moderieren</DialogTitle>
                        <DialogDescription>{modTeam?.name || ''} - Anfragen prüfen und Mitglieder verwalten.</DialogDescription>
                    </DialogHeader>
                    {modLoading ? (
                        <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offene Anfragen ({modRequests.length})</p>
                                {(modRequests || []).map((request) => (
                                    <div key={request._id} className="rounded-lg border p-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold">{getUserLabel(request.user)}</p>
                                            <p className="text-[11px] text-muted-foreground">{new Date(request.createdAt).toLocaleString('de-DE')}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Positionen: {(request.requestedPositions || []).join(', ')}</p>
                                        {request.message ? <p className="text-xs">"{request.message}"</p> : null}
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleRequestAction(request._id, 'approve')}>
                                                <Check size={14} className="mr-1" /> Annehmen
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleRequestAction(request._id, 'reject')}>
                                                <X size={14} className="mr-1" /> Ablehnen
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {modRequests.length === 0 && (
                                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground italic">
                                        Keine offenen Anfragen.
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mitglied manuell hinzufügen</p>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_170px] gap-2">
                                    <Select value={manualUserId} onValueChange={setManualUserId}>
                                        <SelectTrigger><SelectValue placeholder="Benutzer wählen" /></SelectTrigger>
                                        <SelectContent>
                                            {availableManualUsers.map((user) => (
                                                <SelectItem key={`manual-user-${user._id}`} value={String(user._id)}>
                                                    {getUserLabel(user)} (@{user.username})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={manualRole} onValueChange={setManualRole}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MEMBER">Mitglied</SelectItem>
                                            <SelectItem value="MODERATOR">Moderator</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(modTeam?.positions || []).map((position) => {
                                        const IconCmp = getTeamIcon(resolvePositionIconName(modTeam, position));
                                        return (
                                            <Button
                                                key={`manual-pos-${position}`}
                                                type="button"
                                                size="sm"
                                                variant={manualPositions.includes(position) ? 'default' : 'outline'}
                                                onClick={() => togglePosition(position, setManualPositions, manualPositions)}
                                                className="gap-1.5"
                                            >
                                                <IconCmp size={13} />
                                                {position}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button onClick={saveManualMember} disabled={manualSaving} size="sm">
                                    {manualSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Speichern
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aktuelle Teammitglieder</p>
                                {(modTeam?.members || []).map((member) => (
                                    <div key={`mod-member-${member._id}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold">{getUserLabel(member)} (@{member.username})</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(member.positions || []).length > 0 ? (member.positions || []).map((position) => {
                                                    const IconCmp = getTeamIcon(resolvePositionIconName(modTeam, position));
                                                    return (
                                                        <Badge key={`mod-${member._id}-${position}`} variant="outline" className="h-5 px-1.5 text-[10px] gap-1">
                                                            <IconCmp size={11} />
                                                            {position}
                                                        </Badge>
                                                    );
                                                }) : (
                                                    <span className="text-xs text-muted-foreground">Keine Position</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" onClick={() => changeMemberRole(modTeam._id, member)}>
                                                {member.role === 'MODERATOR' ? 'Als Mitglied setzen' : 'Als Moderator setzen'}
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => removeMember(modTeam._id, member._id)}>
                                                <UserMinus size={14} className="mr-1" /> Entfernen
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MyTeams;
