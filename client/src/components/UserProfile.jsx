import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Calendar, MapPin, Mail, Phone, MessageSquare, Loader2, 
    Edit2, Shield, Tag, User as UserIcon, UserCircle, Camera, Save, X, Info, Clock, Image as ImageIcon, ThumbsUp, Trash2
} from 'lucide-react';
import { cn, formatRoleLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from './UserAvatar';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const api = axios.create({ baseURL: '', withCredentials: true });

const UserProfile = ({ currentUser, showToast }) => {
    const { username } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [coverColorSaving, setCoverColorSaving] = useState(false);
    const [coverColorDraft, setCoverColorDraft] = useState('#a1ced9');
    const [profileUploading, setProfileUploading] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [coverViewerOpen, setCoverViewerOpen] = useState(false);
    const profileFileInputRef = useRef(null);
    const coverFileInputRef = useRef(null);

    useEffect(() => {
        fetchProfile();
    }, [username]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/users/profile/${username}`);
            const userPayload = res.data?.user || res.data;
            setUser(userPayload);
            setCoverColorDraft(userPayload?.coverColor || '#a1ced9');
            setPosts(Array.isArray(res.data?.posts) ? res.data.posts : []);
            setBio(userPayload?.bio || '');
        } catch (e) {
            showToast("Benutzer konnte nicht gefunden werden.", "error");
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleCoverUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setCoverUploading(true);
        try {
            const formData = new FormData();
            formData.append('coverImage', file);
            await api.put('/api/auth/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            await fetchProfile();
            showToast("Titelbild aktualisiert", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Titelbild konnte nicht gespeichert werden", "error");
        } finally {
            setCoverUploading(false);
            event.target.value = '';
        }
    };

    const handleCoverColorSave = async () => {
        if (!coverColorDraft) return;
        setCoverColorSaving(true);
        try {
            await api.put('/api/auth/profile', { coverColor: coverColorDraft });
            setUser((prev) => ({ ...prev, coverColor: coverColorDraft }));
            showToast("Titelbild-Farbe aktualisiert", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Farbe konnte nicht gespeichert werden", "error");
        } finally {
            setCoverColorSaving(false);
        }
    };

    const handleProfileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setProfileUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            await api.put('/api/auth/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            await fetchProfile();
            showToast("Profilbild aktualisiert", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Profilbild konnte nicht gespeichert werden", "error");
        } finally {
            setProfileUploading(false);
            event.target.value = '';
        }
    };

    const handleClearProfileImage = async () => {
        if (profileUploading) return;
        setProfileUploading(true);
        try {
            await api.put('/api/auth/profile', { clearProfileImage: true });
            await fetchProfile();
            showToast("Profilbild entfernt", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Profilbild konnte nicht entfernt werden", "error");
        } finally {
            setProfileUploading(false);
        }
    };

    const openProfileFilePicker = () => {
        if (profileUploading) return;
        profileFileInputRef.current?.click();
    };

    const openCoverFilePicker = () => {
        if (coverUploading) return;
        coverFileInputRef.current?.click();
    };

    const handleSaveBio = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/bio', { bio });
            setUser(prev => ({ ...prev, bio }));
            setIsEditing(false);
            showToast("Bio aktualisiert", "success");
        } catch (e) {
            showToast("Fehler beim Speichern", "error");
        } finally {
            setSaving(false);
        }
    };

    const startChat = async () => {
        try {
            // Find or create conversation
            const res = await api.get('/api/chat/conversations');
            let conv = res.data.find(c => c.participants.some(p => p.username === username));
            
            if (conv) {
                navigate(`/messenger/${conv._id}`);
            } else {
                // If not found, navigate to messenger and let it create the conversation on first message
                // Actually, our API needs a recipientId. We can just navigate to messenger and handle it.
                // Simplified: we create a conversation link.
                navigate(`/messenger`);
            }
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    const currentUserId = currentUser?._id || currentUser?.id || null;
    const profileUserId = user?._id || user?.id || null;
    const isOwnProfile = Boolean(
        (currentUserId && profileUserId && String(currentUserId) === String(profileUserId)) ||
        (currentUser?.username && user?.username && String(currentUser.username) === String(user.username))
    );
    const profileImageSrc = user?.optimizedProfileImage || user?.profileImage || '';
    const hasCoverImage = Boolean(user?.optimizedCoverImage || user?.coverImage);
    const resolvedCoverColor = coverColorDraft || user?.coverColor || '#a1ced9';
    const coverColorChanged = resolvedCoverColor !== (user?.coverColor || '#a1ced9');
    const formattedWhatsApp = (() => {
        if (!user?.phone) return 'Keine Nummer hinterlegt';
        try {
            const normalized = String(user.phone).startsWith('+') ? String(user.phone) : `+${String(user.phone)}`;
            const parsed = parsePhoneNumberFromString(normalized);
            if (parsed?.isValid()) return parsed.formatInternational();
        } catch (e) {}
        return user.phone;
    })();

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-20">
            <input
                ref={profileFileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleProfileUpload}
            />
            <input
                ref={coverFileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleCoverUpload}
            />
            {/* Header / Cover area */}
            <div className="relative group">
                <div
                    className={cn(
                        "h-48 sm:h-64 w-full rounded-[2rem] border border-primary/10 overflow-hidden shadow-inner cursor-zoom-in",
                        !hasCoverImage && "bg-gradient-to-br from-primary/20 via-primary/5 to-muted"
                    )}
                    style={!hasCoverImage ? { backgroundColor: resolvedCoverColor } : undefined}
                    onClick={() => setCoverViewerOpen(true)}
                    title="Titelbild vergrößern"
                >
                    {hasCoverImage && (
                        <img
                            src={user.optimizedCoverImage || user.coverImage}
                            alt="Titelbild"
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                </div>
                {isOwnProfile && (
                    <div className="absolute right-5 top-5 flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-0 bg-background/95"
                            disabled={coverUploading}
                            onClick={openCoverFilePicker}
                        >
                            {coverUploading ? <Loader2 className="animate-spin mr-2" size={14} /> : <ImageIcon className="mr-2" size={14} />}
                            Titelbild
                        </Button>
                        <div className="h-9 px-2 rounded-xl border bg-background/95 flex items-center gap-2">
                            {coverColorSaving && <Loader2 className="animate-spin text-muted-foreground" size={14} />}
                            <input
                                type="color"
                                value={resolvedCoverColor}
                                onChange={(e) => setCoverColorDraft(e.target.value)}
                                disabled={coverColorSaving}
                                className="h-6 w-7 p-0 border-0 bg-transparent cursor-pointer"
                                aria-label="Titelbild Farbe"
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-md border-0 px-2 text-[10px] font-semibold"
                                onClick={handleCoverColorSave}
                                disabled={coverColorSaving || !coverColorChanged}
                            >
                                OK
                            </Button>
                        </div>
                    </div>
                )}
                
                <div className="absolute -bottom-12 left-8 flex items-end gap-6">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setImageViewerOpen(true)}
                            className="rounded-[2.5rem] cursor-zoom-in p-0 border-0 bg-transparent appearance-none"
                            title="Bild vergrößern"
                        >
                            <UserAvatar user={user} size="xl" showStatus={false} className="w-32 h-32 sm:w-40 sm:h-40 shadow-2xl rounded-[2.5rem]" />
                        </button>
                        {isOwnProfile && (
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="absolute bottom-2 right-2 rounded-xl shadow-lg border-0 h-10 w-10"
                                disabled={profileUploading}
                                onClick={openProfileFilePicker}
                            >
                                {profileUploading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="absolute -bottom-10 right-8 flex gap-3">
                    {!isOwnProfile && (
                        <Button className="rounded-2xl gap-2 font-bold px-6 shadow-lg shadow-primary/20" onClick={startChat}>
                            <MessageSquare size={18} /> NACHRICHT
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
                <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/20">
                        <DialogTitle>Profilbild</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 sm:p-6">
                        {profileImageSrc ? (
                            <img src={profileImageSrc} alt="Profilbild groß" className="w-full max-h-[70vh] object-contain rounded-xl bg-muted/20" />
                        ) : (
                            <div className="h-60 rounded-xl bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">Kein Bild vorhanden</div>
                        )}
                        {isOwnProfile && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-md px-4 text-sm font-semibold border-0"
                                    onClick={openProfileFilePicker}
                                    disabled={profileUploading}
                                >
                                    {profileUploading ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                                    Neues Bild hochladen
                                </Button>
                                {profileImageSrc && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 rounded-md px-4 text-sm font-semibold border-0"
                                        onClick={handleClearProfileImage}
                                        disabled={profileUploading}
                                    >
                                        {profileUploading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Trash2 className="mr-2" size={14} />}
                                        Bild entfernen
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={coverViewerOpen} onOpenChange={setCoverViewerOpen}>
                <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-muted/20">
                        <DialogTitle>Titelbild</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 sm:p-6 space-y-4">
                        <div
                            className="w-full max-h-[70vh] min-h-[220px] rounded-[1.75rem] border border-primary/10 overflow-hidden"
                            style={!hasCoverImage ? { backgroundColor: resolvedCoverColor } : undefined}
                        >
                            {hasCoverImage ? (
                                <img
                                    src={user.optimizedCoverImage || user.coverImage}
                                    alt="Titelbild groß"
                                    className="w-full max-h-[70vh] object-contain bg-muted/20 rounded-[1.75rem]"
                                />
                            ) : (
                                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                                    Kein Titelbild vorhanden
                                </div>
                            )}
                        </div>
                        {isOwnProfile && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-md px-4 text-sm font-semibold border-0"
                                    onClick={openCoverFilePicker}
                                    disabled={coverUploading}
                                >
                                    {coverUploading ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                                    Neues Titelbild hochladen
                                </Button>
                                <div className="h-10 px-3 rounded-md border bg-white flex items-center gap-2">
                                    {coverColorSaving && <Loader2 className="animate-spin text-muted-foreground" size={14} />}
                                    <span className="text-xs font-semibold text-muted-foreground">Farbe</span>
                                    <input
                                        type="color"
                                        value={resolvedCoverColor}
                                        onChange={(e) => setCoverColorDraft(e.target.value)}
                                        disabled={coverColorSaving}
                                        className="h-6 w-8 p-0 border-0 bg-transparent cursor-pointer"
                                        aria-label="Titelbild Farbe Detailansicht"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 rounded-md border-0 px-2 text-[10px] font-semibold"
                                        onClick={handleCoverColorSave}
                                        disabled={coverColorSaving || !coverColorChanged}
                                    >
                                        Speichern
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-20 pt-8">
                {/* Info Sidebar */}
                <div className="space-y-6">
                    <div className="px-1 pt-1">
                        <h1 className="text-3xl font-black tracking-tight leading-none">{user?.firstName} {user?.lastName}</h1>
                        <p className="mt-2 text-sm font-semibold text-muted-foreground">@{user?.username}</p>
                    </div>
                    <Card className="rounded-[2rem] shadow-xl border-primary/5 overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Info size={14} className="text-primary" /> Steckbrief
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-sm font-medium">
                                    <div className="w-10 h-10 bg-[rgb(210,186,224)]/25 rounded-xl flex items-center justify-center border border-[rgb(210,186,224)]/45">
                                        <Mail size={16} className="text-[rgb(105,57,120)]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">E-Mail</span>
                                        <span className="truncate">{user?.email || 'Nicht angegeben'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-medium">
                                    <div className="w-10 h-10 bg-[rgb(173,235,179)]/28 rounded-xl flex items-center justify-center">
                                        <Phone size={16} className="text-[rgb(28,117,61)]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp</span>
                                        <span>{formattedWhatsApp}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-medium">
                                    <div className="w-10 h-10 bg-[rgb(161,206,217)]/25 rounded-xl flex items-center justify-center border border-[rgb(161,206,217)]/45">
                                        <Calendar size={16} className="text-[rgb(52,93,108)]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Dabei seit</span>
                                        <span>{new Date(user?.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator className="opacity-50" />

                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Berechtigungen</p>
                                <div className="flex flex-wrap gap-2">
                                    {user?.RoleIds?.map(role => (
                                        <Badge key={role._id} variant="outline" className="font-bold uppercase text-[9px] border-primary/20 bg-primary/5 text-primary">
                                            {formatRoleLabel(role.name)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] shadow-xl border-primary/5 overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Shield size={14} className="text-primary" /> Teams & Positionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                {user?.teamPositions?.map((tp, idx) => (
                                    <div key={idx} className="p-3 bg-muted/20 rounded-2xl border border-dashed flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center border shadow-sm">
                                                <Tag size={14} className="text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Team</p>
                                                <p className="text-xs font-black uppercase">{tp.position}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!user?.teamPositions || user.teamPositions.length === 0) && (
                                    <p className="text-xs text-muted-foreground italic text-center py-4">Keinen Teams zugeordnet</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[2rem] shadow-xl border-primary/5 overflow-hidden">
                        <CardHeader className="p-8 border-b bg-muted/10 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tight">Über mich</CardTitle>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Bio & Infos</p>
                            </div>
                            {isOwnProfile && !isEditing ? (
                                <Button variant="outline" className="rounded-md h-9 px-4 font-semibold" onClick={() => setIsEditing(true)}>
                                    <Edit2 size={16} className="mr-2" /> Bearbeiten
                                </Button>
                            ) : (
                                <UserCircle size={24} className="text-primary/40" />
                            )}
                        </CardHeader>
                        <CardContent className="p-8">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <Textarea 
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Schreibe etwas über dich..."
                                        className="min-h-[150px] rounded-2xl p-4 font-medium text-base focus-visible:ring-primary/20"
                                        maxLength={500}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsEditing(false)}>Abbrechen</Button>
                                        <Button className="rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleSaveBio} disabled={saving}>
                                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="mr-2" />}
                                            SPEICHERN
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative group/bio">
                                    <p className={cn(
                                        "text-lg font-medium leading-relaxed",
                                        !user?.bio && "text-muted-foreground italic opacity-50"
                                    )}>
                                        {user?.bio || 'Dieser Benutzer hat noch keine Bio verfasst.'}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline / Content can go here */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-4 px-2">
                            Beiträge von {user?.firstName || user?.username} <Separator className="flex-1 opacity-20" />
                        </h3>
                        {posts.length === 0 ? (
                            <div className="p-12 text-center border border-dashed rounded-[2rem] opacity-40">
                                <Clock size={32} className="mx-auto mb-4" />
                                <p className="text-xs font-bold uppercase tracking-widest">Noch keine Beiträge</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post) => (
                                    <Card key={post._id} className="rounded-2xl border-primary/10 overflow-hidden">
                                        {post.image && (
                                            <img src={post.image} alt="Post Bild" className="w-full max-h-72 object-cover" />
                                        )}
                                        <CardContent className="p-5 space-y-3">
                                            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                                {post.content || 'Beitrag ohne Text'}
                                            </p>
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span className="font-semibold">{post.channelTitle}</span>
                                                <span>{new Date(post.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1"><ThumbsUp size={14} /> {post.likesCount}</span>
                                                <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {post.commentsCount}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
