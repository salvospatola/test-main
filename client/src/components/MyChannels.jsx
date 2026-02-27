import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Lock, Users, Radio, Plus, Settings, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const api = axios.create({ baseURL: '', withCredentials: true });

const CHANNELS_PAGE_SIZE = 12;

const getId = (value) => String(value?._id || value || '');

const ChannelCard = ({ channel, onSubscribe, onOpen, onOpenSettings, busy }) => {
    const initials = (channel.title || '?')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const canOpen = channel.isSubscriber || channel.isModerator;
    const privateInviteOnly = channel.isPrivate && !canOpen;

    return (
        <Card className="h-full border-primary/10 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 rounded-lg">
                        <AvatarImage src={channel.image || ''} />
                        <AvatarFallback className="rounded-lg text-xs" style={channel.coverColor ? { backgroundColor: channel.coverColor } : undefined}>
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base leading-tight truncate">{channel.title}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">{channel.description || 'Keine Beschreibung'}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {channel.isPrivate ? (
                        <Badge variant="secondary" className="gap-1"><Lock size={10} /> Privat</Badge>
                    ) : (
                        <Badge variant="outline">Öffentlich</Badge>
                    )}
                    {channel.isPassive && (
                        <Badge variant="outline" className="border-[rgb(237,132,91)]/40 bg-[rgb(237,132,91)]/12 text-[rgb(191,91,54)]">
                            Passiv
                        </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 border-[rgb(105,57,120)]/35 bg-[rgb(105,57,120)]/12 text-[rgb(105,57,120)]">
                        <Users size={10} /> {channel.subscriberCount || 0}
                    </Badge>
                    {channel.isModerator ? (
                        <Badge variant="outline">Moderator</Badge>
                    ) : (
                        channel.isSubscriber && <Badge className="gap-1"><Radio size={10} /> Mitglied</Badge>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                        variant="default"
                        onClick={() => onOpen(channel._id)}
                        disabled={!canOpen}
                    >
                        Ansehen
                    </Button>
                    <Button
                        variant={channel.isSubscriber ? 'outline' : 'default'}
                        onClick={() => onSubscribe(channel._id)}
                        disabled={busy || privateInviteOnly}
                        className={cn(
                            channel.isSubscriber && "text-[rgb(237,132,91)] hover:text-[rgb(221,115,75)]"
                        )}
                    >
                        {busy ? <Loader2 className="animate-spin" size={14} /> : (privateInviteOnly ? 'Nur Einladung' : (channel.isSubscriber ? 'Verlassen' : 'Beitreten'))}
                    </Button>
                    {channel.isModerator && (
                        <Button
                            variant="outline"
                            onClick={() => onOpenSettings(channel)}
                            className="sm:col-span-2"
                        >
                            <Settings size={14} className="mr-1" /> Einstellungen
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const ChannelEditorModal = ({
    open,
    onOpenChange,
    title,
    submitLabel,
    saving,
    form,
    setForm,
    users = [],
    selectedMembers = [],
    setSelectedMembers,
    selectedModerators = [],
    setSelectedModerators,
    enableMemberManagement = false,
    onSubmit
}) => {
    const [memberSearch, setMemberSearch] = useState('');

    const visibleUsers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return users;
        return users.filter((user) => {
            const full = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
            const username = String(user.username || '').toLowerCase();
            return full.includes(q) || username.includes(q);
        });
    }, [users, memberSearch]);

    const toggleMember = (id) => {
        const exists = selectedMembers.includes(id);
        if (exists) {
            setSelectedMembers(selectedMembers.filter((item) => item !== id));
            setSelectedModerators(selectedModerators.filter((item) => item !== id));
            return;
        }
        setSelectedMembers([...selectedMembers, id]);
    };

    const toggleModerator = (id) => {
        const exists = selectedModerators.includes(id);
        if (exists) {
            setSelectedModerators(selectedModerators.filter((item) => item !== id));
            return;
        }
        if (!selectedMembers.includes(id)) setSelectedMembers([...selectedMembers, id]);
        setSelectedModerators([...selectedModerators, id]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden shadow-2xl rounded-xl border">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
                    <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
                        Titelbild oder Titelfarbe, Rechte und Zugriffe verwalten.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Titel</Label>
                            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Kanalname" />
                        </div>
                        <div className="space-y-2">
                            <Label>Titelfarbe</Label>
                            <div className="h-10 px-3 rounded-md border bg-white flex items-center gap-2">
                                <input
                                    type="color"
                                    value={form.coverColor || '#a1ced9'}
                                    onChange={(e) => setForm({ ...form, coverColor: e.target.value })}
                                    className="h-6 w-8 p-0 border-0 bg-transparent cursor-pointer"
                                />
                                <span className="text-[10px] font-mono text-muted-foreground ml-auto uppercase">{form.coverColor || '#a1ced9'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Beschreibung</Label>
                        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kurzbeschreibung" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><ImageIcon size={14} /> Titelbild</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Zugriff</Label>
                            <div className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="channel-private">Privat</Label>
                                    <Switch
                                        id="channel-private"
                                        checked={Boolean(form.isPrivate)}
                                        onCheckedChange={(value) => setForm({ ...form, isPrivate: value })}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Privat: keine Abos möglich, nur Moderator-Einladung.</p>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="channel-passive">Passiv</Label>
                                    <Switch
                                        id="channel-passive"
                                        checked={Boolean(form.isPassive)}
                                        onCheckedChange={(value) => setForm({ ...form, isPassive: value })}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Passiv: nur Moderatoren dürfen posten.</p>
                            </div>
                        </div>
                    </div>

                    {enableMemberManagement && (
                        <div className="space-y-3 pt-2 border-t">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Mitglieder & Moderatoren</p>
                            <Input
                                placeholder="Mitglied suchen..."
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                            />
                            <div className="rounded-md border p-2 max-h-72 overflow-y-auto space-y-1">
                                {visibleUsers.map((user) => {
                                    const id = getId(user);
                                    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
                                    const memberActive = selectedMembers.includes(id);
                                    const moderatorActive = selectedModerators.includes(id);
                                    return (
                                        <div key={id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/30">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{name}</p>
                                                <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={memberActive ? 'default' : 'outline'}
                                                    className="h-8 text-xs font-semibold"
                                                    onClick={() => toggleMember(id)}
                                                >
                                                    Mitglied
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={moderatorActive ? 'default' : 'outline'}
                                                    className="h-8 text-xs font-semibold"
                                                    onClick={() => toggleModerator(id)}
                                                >
                                                    Moderator
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {visibleUsers.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">Keine passenden Mitglieder gefunden.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-muted/30 gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                    <Button className="font-bold" onClick={onSubmit} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const MyChannels = ({ showToast }) => {
    const navigate = useNavigate();
    const [view, setView] = useState('directory');
    const [loadingMine, setLoadingMine] = useState(true);
    const [myChannels, setMyChannels] = useState([]);
    const [loadingDirectory, setLoadingDirectory] = useState(true);
    const [loadingMoreDirectory, setLoadingMoreDirectory] = useState(false);
    const [directoryChannels, setDirectoryChannels] = useState([]);
    const [directoryOffset, setDirectoryOffset] = useState(0);
    const [directoryHasMore, setDirectoryHasMore] = useState(false);
    const [directorySearchInput, setDirectorySearchInput] = useState('');
    const [directorySearch, setDirectorySearch] = useState('');
    const [busyChannelId, setBusyChannelId] = useState(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [savingEditor, setSavingEditor] = useState(false);
    const [editingChannelId, setEditingChannelId] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [selectedModerators, setSelectedModerators] = useState([]);
    const [form, setForm] = useState({
        title: '',
        description: '',
        isPrivate: false,
        isPassive: false,
        coverColor: '#a1ced9',
        imageFile: null
    });

    const fetchMine = async () => {
        setLoadingMine(true);
        try {
            const res = await api.get('/api/channels/mine');
            setMyChannels(Array.isArray(res.data) ? res.data : []);
        } catch {
            setMyChannels([]);
            showToast('Meine Kanäle konnten nicht geladen werden.', 'error');
        } finally {
            setLoadingMine(false);
        }
    };

    const fetchDirectory = async (reset = false) => {
        if (reset) setLoadingDirectory(true);
        else setLoadingMoreDirectory(true);
        try {
            const nextOffset = reset ? 0 : directoryOffset;
            const query = directorySearch ? `&search=${encodeURIComponent(directorySearch)}` : '';
            const res = await api.get(`/api/channels/directory?offset=${nextOffset}&limit=${CHANNELS_PAGE_SIZE}${query}`);
            const payload = res.data || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setDirectoryChannels((prev) => reset ? items : [...prev, ...items]);
            setDirectoryOffset(payload.nextOffset ?? (nextOffset + items.length));
            setDirectoryHasMore(Boolean(payload.hasMore));
        } catch {
            if (reset) setDirectoryChannels([]);
            showToast('Kanalverzeichnis konnte nicht geladen werden.', 'error');
        } finally {
            if (reset) setLoadingDirectory(false);
            else setLoadingMoreDirectory(false);
        }
    };

    const refreshAll = async () => {
        await Promise.all([fetchMine(), fetchDirectory(true)]);
    };

    useEffect(() => {
        refreshAll();
    }, []);

    useEffect(() => {
        fetchDirectory(true);
    }, [directorySearch]);

    const handleSubscribe = async (channelId) => {
        setBusyChannelId(channelId);
        try {
            const res = await api.post(`/api/channels/${channelId}/subscribe`);
            if (res.data?.requested) showToast('Teilnahmeanfrage gesendet.', 'success');
            else showToast(res.data?.subscribed ? 'Kanal beigetreten.' : 'Kanal verlassen.', 'success');
            await refreshAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Aktion fehlgeschlagen.', 'error');
        } finally {
            setBusyChannelId(null);
        }
    };

    const subscribedCount = useMemo(
        () => myChannels.filter((channel) => channel.isSubscriber || channel.isModerator).length,
        [myChannels]
    );

    const handleOpenChannel = (channelId) => {
        navigate(`/channels/${channelId}`);
    };

    const resetEditor = () => {
        setForm({
            title: '',
            description: '',
            isPrivate: false,
            isPassive: false,
            coverColor: '#a1ced9',
            imageFile: null
        });
        setSelectedMembers([]);
        setSelectedModerators([]);
        setEditingChannelId('');
        setAllUsers([]);
    };

    const openCreate = () => {
        resetEditor();
        setCreateOpen(true);
    };

    const openSettings = async (channel) => {
        try {
            setSavingEditor(true);
            const [channelRes, usersRes] = await Promise.all([
                api.get(`/api/channels/${channel._id}`),
                api.get('/api/users')
            ]);
            const detail = channelRes.data || {};
            const users = Array.isArray(usersRes.data) ? usersRes.data : [];
            const moderatorIds = (detail.moderators || []).map((item) => getId(item)).filter(Boolean);
            const memberIds = Array.from(new Set([
                ...(detail.subscribers || []).map((item) => getId(item)).filter(Boolean),
                ...moderatorIds
            ]));
            setEditingChannelId(channel._id);
            setAllUsers(users);
            setSelectedMembers(memberIds);
            setSelectedModerators(moderatorIds);
            setForm({
                title: detail.title || '',
                description: detail.description || '',
                isPrivate: Boolean(detail.isPrivate),
                isPassive: Boolean(detail.isPassive),
                coverColor: detail.coverColor || '#a1ced9',
                imageFile: null
            });
            setSettingsOpen(true);
        } catch (e) {
            showToast(e.response?.data?.error || 'Kanal-Einstellungen konnten nicht geladen werden.', 'error');
        } finally {
            setSavingEditor(false);
        }
    };

    const handleCreateSubmit = async () => {
        if (!form.title.trim()) return showToast('Titel ist erforderlich.', 'error');
        setSavingEditor(true);
        try {
            const fd = new FormData();
            fd.append('title', form.title.trim());
            fd.append('description', form.description || '');
            fd.append('isPrivate', String(Boolean(form.isPrivate)));
            fd.append('isPassive', String(Boolean(form.isPassive)));
            fd.append('coverColor', form.coverColor || '');
            if (form.imageFile) fd.append('image', form.imageFile);
            await api.post('/api/channels', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            showToast('Kanal erstellt.', 'success');
            setCreateOpen(false);
            resetEditor();
            await refreshAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Kanal konnte nicht erstellt werden.', 'error');
        } finally {
            setSavingEditor(false);
        }
    };

    const handleSettingsSubmit = async () => {
        if (!editingChannelId) return;
        if (!form.title.trim()) return showToast('Titel ist erforderlich.', 'error');
        setSavingEditor(true);
        try {
            const fd = new FormData();
            fd.append('title', form.title.trim());
            fd.append('description', form.description || '');
            fd.append('isPrivate', String(Boolean(form.isPrivate)));
            fd.append('isPassive', String(Boolean(form.isPassive)));
            fd.append('coverColor', form.coverColor || '');
            fd.append('memberIds', JSON.stringify(selectedMembers));
            fd.append('moderatorIds', JSON.stringify(selectedModerators));
            if (form.imageFile) fd.append('image', form.imageFile);
            await api.put(`/api/channels/${editingChannelId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            showToast('Kanal-Einstellungen gespeichert.', 'success');
            setSettingsOpen(false);
            resetEditor();
            await refreshAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Einstellungen konnten nicht gespeichert werden.', 'error');
        } finally {
            setSavingEditor(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <Card className="border-primary/10">
                <CardHeader>
                    <CardTitle className="text-2xl tracking-tight">Meine Kanäle</CardTitle>
                    <CardDescription>
                        Jeder kann Kanäle erstellen. Ersteller werden automatisch Moderator.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant={view === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setView('mine')}>
                            Abonniert ({subscribedCount})
                        </Button>
                        <Button variant={view === 'directory' ? 'default' : 'outline'} size="sm" onClick={() => setView('directory')}>
                            Verzeichnis
                        </Button>
                        <Button size="sm" className="ml-auto" onClick={openCreate}>
                            <Plus size={14} className="mr-2" /> Kanal erstellen
                        </Button>
                    </div>
                    {view === 'directory' && (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Kanal suchen..."
                                value={directorySearchInput}
                                onChange={(event) => setDirectorySearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') setDirectorySearch(directorySearchInput.trim());
                                }}
                            />
                            <Button variant="outline" onClick={() => setDirectorySearch(directorySearchInput.trim())}>
                                Suchen
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {view === 'mine' && (
                <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', loadingMine && 'opacity-70')}>
                    {loadingMine && (
                        <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="animate-spin mr-2" size={16} /> Lädt Kanäle...
                        </div>
                    )}
                    {!loadingMine && myChannels.length === 0 && (
                        <Card className="col-span-full border-dashed">
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                Du hast noch keine Kanäle abonniert.
                            </CardContent>
                        </Card>
                    )}
                    {!loadingMine && myChannels.map((channel) => (
                        <ChannelCard
                            key={channel._id}
                            channel={channel}
                            onSubscribe={handleSubscribe}
                            onOpen={handleOpenChannel}
                            onOpenSettings={openSettings}
                            busy={busyChannelId === channel._id}
                        />
                    ))}
                </div>
            )}

            {view === 'directory' && (
                <div className="space-y-4">
                    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', loadingDirectory && 'opacity-70')}>
                        {loadingDirectory && (
                            <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="animate-spin mr-2" size={16} /> Lädt Verzeichnis...
                            </div>
                        )}
                        {!loadingDirectory && directoryChannels.length === 0 && (
                            <Card className="col-span-full border-dashed">
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    Keine Kanäle gefunden.
                                </CardContent>
                            </Card>
                        )}
                        {!loadingDirectory && directoryChannels.map((channel) => (
                            <ChannelCard
                                key={`directory-${channel._id}`}
                                channel={channel}
                                onSubscribe={handleSubscribe}
                                onOpen={handleOpenChannel}
                                onOpenSettings={openSettings}
                                busy={busyChannelId === channel._id}
                            />
                        ))}
                    </div>
                    {directoryHasMore && (
                        <Button
                            variant="outline"
                            className="w-full"
                            disabled={loadingMoreDirectory}
                            onClick={() => fetchDirectory(false)}
                        >
                            {loadingMoreDirectory ? <Loader2 className="animate-spin" size={14} /> : 'Mehr Kanäle laden'}
                        </Button>
                    )}
                </div>
            )}

            <ChannelEditorModal
                open={createOpen}
                onOpenChange={setCreateOpen}
                title="Neuen Kanal erstellen"
                submitLabel="Kanal anlegen"
                saving={savingEditor}
                form={form}
                setForm={setForm}
                onSubmit={handleCreateSubmit}
            />

            <ChannelEditorModal
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                title="Kanal-Einstellungen"
                submitLabel="Speichern"
                saving={savingEditor}
                form={form}
                setForm={setForm}
                users={allUsers}
                selectedMembers={selectedMembers}
                setSelectedMembers={setSelectedMembers}
                selectedModerators={selectedModerators}
                setSelectedModerators={setSelectedModerators}
                enableMemberManagement
                onSubmit={handleSettingsSubmit}
            />
        </div>
    );
};

export default MyChannels;
