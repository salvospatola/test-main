import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
    Send, Image as ImageIcon, Link as LinkIcon, Trash2, Loader2, 
    MessageCircle, Heart, Share2, Clock, X, ExternalLink, MoreVertical, Pin,
    Download, Lock, Check, BarChart3
} from 'lucide-react';

import { PostSkeleton } from './Skeletons';
import { UserAvatar } from './UserAvatar';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { AtSign, X as IconX } from 'lucide-react';

const api = axios.create({ baseURL: '', withCredentials: true });

const PostCreator = ({ currentUser, onPostCreated, channels = [], selectedChannelId = 'all', onChannelChange }) => {
    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
    const [mentionable, setMentionable] = useState([]);
    const [pollEnabled, setPollEnabled] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollMultiple, setPollMultiple] = useState(false);
    const [pollOptions, setPollOptions] = useState(['', '']);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get('/api/users');
                setMentionable(res.data.map(u => ({
                    id: u._id || u.id,
                    title: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username,
                    username: u.username,
                    image: u.optimizedProfileImage || u.profileImage,
                    type: 'user'
                })));
            } catch {
                // Ignore mention list fetch failures; posting still works.
            }
        };
        fetchUsers();
    }, []);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const MAX_SIZE = 50 * 1024 * 1024;
        files.forEach(file => {
            if (file.size > MAX_SIZE) {
                toast.error(`Bild "${file.name}" ist zu groß (max. 50MB).`);
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setImages(prev => [...prev, { file, preview: reader.result }]);
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const sanitizedPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
        const hasPoll = pollEnabled && pollQuestion.trim() && sanitizedPollOptions.length >= 2;
        if (!content.trim() && images.length === 0 && !hasPoll) return;
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('content', content);
            if (selectedChannelId && selectedChannelId !== 'all') {
                formData.append('channelId', selectedChannelId);
            }
            if (hasPoll) {
                formData.append('poll', JSON.stringify({
                    question: pollQuestion.trim(),
                    multiple: pollMultiple,
                    options: sanitizedPollOptions.map((label) => ({ label }))
                }));
            }
            images.forEach(img => formData.append('images', img.file));
            await api.post('/api/wall', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setContent('');
            setImages([]);
            setPollEnabled(false);
            setPollQuestion('');
            setPollMultiple(false);
            setPollOptions(['', '']);
            if (onPostCreated) onPostCreated();
            toast.success("Beitrag veröffentlicht!");
        } catch (e) {
            toast.error(e.response?.data?.error || "Fehler beim Posten.");
        } finally { setSubmitting(false); }
    };

    return (
        <Card className="shadow-2xl overflow-hidden border-primary/10 bg-card group/creator rounded-3xl">
            <CardHeader className="flex flex-row gap-4 items-start pb-4 pt-8 px-8">
                <UserAvatar user={currentUser} size="md" className="ring-2 ring-primary/10 shadow-lg" />
                <div className="flex-1">
                    <Textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`Was möchtest du heute teilen, ${currentUser?.firstName || currentUser?.username}?`}
                        className="min-h-[100px] border-none focus-visible:ring-0 text-lg font-medium resize-none p-0 shadow-none bg-transparent placeholder:text-muted-foreground/40"
                    />
                    <div className="pt-3">
                        <Label className="text-xs font-semibold text-muted-foreground">Kanal</Label>
                        <Select value={selectedChannelId} onValueChange={(value) => onChannelChange?.(value)}>
                            <SelectTrigger className="mt-2 h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Schwarzes Brett (alle)</SelectItem>
                                {channels.map((channel) => (
                                    <SelectItem key={channel._id} value={channel._id}>
                                        {channel.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>

            {images.length > 0 && (
                <div className="px-8 pb-4 flex flex-wrap gap-3">
                    {images.map((img, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/10 shadow-xl group/img animate-in zoom-in duration-300">
                            <img src={img.preview} className="w-full h-full object-cover" />
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                                onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                            >
                                <IconX size={12} strokeWidth={3} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <div className="px-8 py-4 bg-muted/30 flex items-center justify-between border-t border-primary/5">
                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <label className="cursor-pointer">
                                <div className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                                    <ImageIcon size={20} strokeWidth={2.5} />
                                </div>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </TooltipTrigger>
                        <TooltipContent>Bilder hinzufügen</TooltipContent>
                    </Tooltip>

                    <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
                                title="Jemanden erwähnen"
                            >
                                <AtSign size={20} strokeWidth={2.5} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[240px]" align="start">
                            <Command>
                                <CommandInput placeholder="Suchen..." />
                                <CommandList>
                                    <CommandEmpty>Niemand gefunden.</CommandEmpty>
                                    <CommandGroup heading="Mitglieder">
                                        {mentionable.map((u) => (
                                            <CommandItem
                                                key={u.id}
                                                value={u.username}
                                                onSelect={() => {
                                                    setContent(prev => prev + (prev.endsWith(' ') ? '' : ' ') + `@${u.username} `);
                                                    setMentionPopoverOpen(false);
                                                }}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={u.image} />
                                                    <AvatarFallback className="text-[8px]">{u.title ? u.title[0] : '?'}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-bold text-xs">{u.title}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                title="Link einfügen"
                            >
                                <LinkIcon size={20} strokeWidth={2.5} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="start">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-bold leading-none uppercase tracking-tight text-[10px] text-primary">Link einfügen</h4>
                                    <p className="text-muted-foreground text-[10px] font-medium uppercase">Teile eine Website oder ein Video.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Input 
                                        id="link-input"
                                        placeholder="https://..." 
                                        className="h-9 text-xs font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const url = e.currentTarget.value;
                                                if (url) setContent(prev => prev + (prev ? '\n' : '') + url);
                                                e.currentTarget.value = '';
                                                // Close popover logic would need state, but for now this works as a simple implementation
                                            }
                                        }}
                                    />
                                    <Button 
                                        size="sm" 
                                        className="h-9 font-bold text-[10px]"
                                        onClick={() => {
                                            const input = document.getElementById('link-input');
                                            const url = input?.value;
                                            if (url) setContent(prev => prev + (prev ? '\n' : '') + url);
                                            if (input) input.value = '';
                                        }}
                                    >
                                        HINZUFÜGEN
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10", pollEnabled && "text-primary bg-primary/10")}
                                onClick={() => setPollEnabled((prev) => !prev)}
                            >
                                <BarChart3 size={20} strokeWidth={2.5} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Umfrage anhängen</TooltipContent>
                    </Tooltip>
                </div>

                <Button 
                    disabled={submitting || (!content.trim() && images.length === 0 && !(pollEnabled && pollQuestion.trim() && pollOptions.map((option) => option.trim()).filter(Boolean).length >= 2))}
                    onClick={handleSubmit}
                    className="gap-2"
                >
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    <span className="hidden sm:inline">POSTEN</span>
                </Button>
            </div>

            {pollEnabled && (
                <div className="border-t border-primary/5 px-8 py-5 space-y-3">
                    <Input
                        value={pollQuestion}
                        onChange={(event) => setPollQuestion(event.target.value)}
                        placeholder="Umfragefrage"
                        className="h-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                    />
                    <div className="space-y-2">
                        {pollOptions.map((option, index) => (
                            <Input
                                key={`poll-option-${index}`}
                                value={option}
                                onChange={(event) => {
                                    const next = [...pollOptions];
                                    next[index] = event.target.value;
                                    setPollOptions(next);
                                }}
                                placeholder={`Option ${index + 1}`}
                                className="h-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setPollOptions((prev) => [...prev, ''])}
                        >
                            Option hinzufügen
                        </Button>
                        <div className="flex items-center gap-2">
                            <Switch checked={pollMultiple} onCheckedChange={setPollMultiple} id="poll-multiple" />
                            <Label htmlFor="poll-multiple" className="text-xs text-muted-foreground">Mehrfachantwort erlauben</Label>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

const CommunityWall = ({ currentUser, showConfirm, showAlert, showToast, forcedChannelId = null, hideChannelFilters = false }) => {
    const [posts, setPosts] = useState([]);
    const [channels, setChannels] = useState([]);
    const [activeChannelId, setActiveChannelId] = useState(forcedChannelId || 'all');
    const [postChannelId, setPostChannelId] = useState(forcedChannelId || 'all');
    const [channelMeta, setChannelMeta] = useState(null);
    const [pollSelections, setPollSelections] = useState({});
    const [pollSubmittingByPost, setPollSubmittingByPost] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);
    const [postOffset, setPostOffset] = useState(0);
    const [hasMorePosts, setHasMorePosts] = useState(false);
    const [expandedComments, setExpandedComments] = useState({});
    const [commentTexts, setCommentTexts] = useState({});
    const [commentsByPost, setCommentsByPost] = useState({});
    const [commentsMetaByPost, setCommentsMetaByPost] = useState({});
    const [loadingCommentsByPost, setLoadingCommentsByPost] = useState({});
    const [selectedImage, setSelectedImage] = useState(null);
    const POSTS_PAGE_SIZE = 10;
    const COMMENTS_PAGE_SIZE = 8;
    const currentUserId = currentUser?._id || currentUser?.id;

    const hasPermission = (type = 'edit') => {
        if (!currentUser) return false;
        if (currentUser.role === 'ADMIN') return true;
        const homePerm = currentUser.permissions?.find(p => p.key === 'HOME');
        if (type === 'view') return homePerm?.canView;
        return homePerm?.canEdit;
    };

    const fetchChannels = async () => {
        try {
            const res = await api.get('/api/channels');
            setChannels(Array.isArray(res.data) ? res.data : []);
        } catch {
            setChannels([]);
        }
    };

    const fetchChannelMeta = async () => {
        if (!forcedChannelId) {
            setChannelMeta(null);
            return;
        }
        try {
            const res = await api.get(`/api/channels/${forcedChannelId}`);
            setChannelMeta(res.data || null);
        } catch {
            setChannelMeta(null);
        }
    };

    const fetchPosts = async (reset = false) => {
        const nextOffset = reset ? 0 : postOffset;
        if (reset) setLoading(true);
        else setLoadingMorePosts(true);
        try {
            const query = activeChannelId !== 'all' ? `&channelId=${activeChannelId}` : '';
            const res = await api.get(`/api/wall?offset=${nextOffset}&limit=${POSTS_PAGE_SIZE}${query}`);
            const payload = res.data;
            const items = Array.isArray(payload) ? payload : (payload.items || []);

            setPosts(prev => reset ? items : [...prev, ...items]);
            setHasMorePosts(Array.isArray(payload) ? false : Boolean(payload.hasMore));
            setPostOffset(Array.isArray(payload) ? items.length : (payload.nextOffset ?? (nextOffset + items.length)));

            if (reset) {
                setExpandedComments({});
                setCommentsByPost({});
                setCommentsMetaByPost({});
                setLoadingCommentsByPost({});
            }
        } catch {
            console.error("Fehler beim Laden der Beiträge");
        } finally {
            if (reset) setLoading(false);
            else setLoadingMorePosts(false);
        }
    };

    useEffect(() => {
        fetchChannels();
        fetchChannelMeta();
        fetchPosts(true);
    }, [activeChannelId, forcedChannelId]);

    useEffect(() => {
        if (!forcedChannelId) return;
        setActiveChannelId(forcedChannelId);
        setPostChannelId(forcedChannelId);
    }, [forcedChannelId]);

    const postableChannels = useMemo(
        () => channels.filter((channel) => (
            channel.isSubscriber ||
            channel.isModerator ||
            channel.createdBy?._id === currentUserId
        ) && (!channel.isPassive || channel.isModerator)),
        [channels, currentUserId]
    );

    useEffect(() => {
        if (postChannelId === 'all') return;
        const exists = postableChannels.some((channel) => channel._id === postChannelId);
        if (!exists) setPostChannelId('all');
    }, [postableChannels, postChannelId]);

    const updatePostCommentCount = (postId, delta) => {
        setPosts(prev => prev.map((post) => {
            const currentId = post._id || post.id;
            if (currentId !== postId) return post;
            const currentCount = Number(post.commentsCount ?? post.comments?.length ?? 0);
            return { ...post, commentsCount: Math.max(currentCount + delta, 0) };
        }));
    };

    const fetchComments = async (postId, reset = false) => {
        if (loadingCommentsByPost[postId]) return;
        const currentMeta = commentsMetaByPost[postId] || { offset: 0, hasMore: true, total: 0 };
        const offset = reset ? 0 : currentMeta.offset;

        setLoadingCommentsByPost(prev => ({ ...prev, [postId]: true }));
        try {
            const res = await api.get(`/api/wall/${postId}/comments?offset=${offset}&limit=${COMMENTS_PAGE_SIZE}`);
            const payload = res.data || {};
            const comments = Array.isArray(payload.comments) ? payload.comments : [];
            setCommentsByPost(prev => ({
                ...prev,
                [postId]: reset ? comments : [...(prev[postId] || []), ...comments]
            }));
            setCommentsMetaByPost(prev => ({
                ...prev,
                [postId]: {
                    offset: payload.nextOffset ?? (offset + comments.length),
                    hasMore: Boolean(payload.hasMore),
                    total: Number(payload.total ?? prev[postId]?.total ?? comments.length)
                }
            }));
        } catch {
            showToast("Kommentare konnten nicht geladen werden.", "error");
        } finally {
            setLoadingCommentsByPost(prev => ({ ...prev, [postId]: false }));
        }
    };

    const handleLike = async (postId) => {
        if (!hasPermission('edit')) {
            showToast("Nur Mitglieder können Beiträge liken.", "error");
            return;
        }

        // --- OPTIMISTIC UI ---
        const userId = currentUser?.id || currentUser?._id;
        const updatedPosts = posts.map(p => {
            const pId = p._id || p.id;
            if (pId === postId) {
                const alreadyLiked = p.likes?.includes(userId);
                const newLikes = alreadyLiked 
                    ? p.likes.filter(id => id !== userId) 
                    : [...(p.likes || []), userId];
                return { ...p, likes: newLikes };
            }
            return p;
        });
        setPosts(updatedPosts);

        try {
            await api.post(`/api/wall/${postId}/like`);
        } catch {
            // Revert on error
            fetchPosts(true);
            showToast("Fehler beim Liken.", "error");
        }
    };

    const handleDelete = (postId) => {
        showConfirm("Beitrag löschen", "Möchtest du diesen Beitrag wirklich entfernen?", async () => {
            try {
                await api.delete(`/api/wall/${postId}`);
                fetchPosts(true);
            } catch {
                showAlert("Fehler", "Löschen fehlgeschlagen.");
            }
        });
    };

    const handlePinToggle = async (postId, pinned) => {
        try {
            await api.post(`/api/wall/${postId}/pin`, { pinned: !pinned });
            fetchPosts(true);
            showToast(!pinned ? "Beitrag angepinnt." : "Anheftung entfernt.", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Aktion fehlgeschlagen.", "error");
        }
    };

    const handleDeleteComment = (postId, commentId) => {
        showConfirm("Kommentar löschen", "Möchtest du diesen Kommentar wirklich entfernen?", async () => {
            try {
                await api.delete(`/api/wall/${postId}/comments/${commentId}`);
                setCommentsByPost(prev => ({
                    ...prev,
                    [postId]: (prev[postId] || []).filter(c => c._id !== commentId)
                }));
                setCommentsMetaByPost(prev => {
                    const current = prev[postId] || { offset: 0, hasMore: false, total: 0 };
                    return {
                        ...prev,
                        [postId]: {
                            ...current,
                            total: Math.max((current.total || 0) - 1, 0),
                            offset: Math.max((current.offset || 0) - 1, 0)
                        }
                    };
                });
                updatePostCommentCount(postId, -1);
            } catch {
                showAlert("Fehler", "Löschen fehlgeschlagen.");
            }
        });
    };

    const handleComment = async (postId) => {
        if (!hasPermission('edit')) {
            showToast("Nur Mitglieder können kommentieren.", "error");
            return;
        }
        const text = commentTexts[postId];
        if (!text?.trim()) return;

        // Optimistic Comment
        const tempId = 'temp-' + Date.now();
        const newComment = {
            _id: tempId,
            content: text,
            author: currentUser,
            createdAt: new Date().toISOString()
        };

        setCommentsByPost(prev => ({
            ...prev,
            [postId]: [...(prev[postId] || []), newComment]
        }));
        setCommentsMetaByPost(prev => {
            const current = prev[postId] || { offset: 0, hasMore: false, total: 0 };
            return {
                ...prev,
                [postId]: {
                    ...current,
                    offset: (current.offset || 0) + 1,
                    total: (current.total || 0) + 1
                }
            };
        });
        updatePostCommentCount(postId, 1);
        setCommentTexts({ ...commentTexts, [postId]: '' });

        try {
            await api.post(`/api/wall/${postId}/comment`, { content: text });
            await fetchComments(postId, true);
        } catch {
            setCommentsByPost(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).filter(c => c._id !== tempId)
            }));
            updatePostCommentCount(postId, -1);
            setCommentTexts({ ...commentTexts, [postId]: text });
            showToast("Kommentar fehlgeschlagen.", "error");
        }
    };

    const handleShare = (postId) => {
        const url = `${window.location.origin}/wall/post/${postId}`;
        if (navigator.share) {
            navigator.share({
                title: 'EFG NSU Portal - Schwarzes Brett',
                text: 'Schau dir diesen Beitrag im Schwarzen Brett an.',
                url
            }).catch(() => {});
            return;
        }
        navigator.clipboard.writeText(url);
        showToast("Link kopiert", "success");
    };

    const handlePollVote = async (postId, poll) => {
        const selected = pollSelections[postId] || [];
        if (selected.length === 0) return;
        setPollSubmittingByPost((prev) => ({ ...prev, [postId]: true }));
        try {
            const res = await api.post(`/api/wall/${postId}/poll/vote`, { optionIds: selected });
            setPosts((prev) => prev.map((post) => {
                const currentId = post._id || post.id;
                if (currentId !== postId) return post;
                return { ...post, poll: res.data.poll };
            }));
            showToast("Stimme gespeichert.", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Abstimmung fehlgeschlagen.", "error");
        } finally {
            setPollSubmittingByPost((prev) => ({ ...prev, [postId]: false }));
        }
    };

    const handleDownload = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = url.split('/').pop() || 'image.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            showToast("Download fehlgeschlagen.", "error");
        }
    };

    const renderContent = (text) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, i) => {
            if (part.match(urlRegex)) {
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{part}</a>;
            }
            return part;
        });
    };

    if (loading) return (
        <div className="max-w-2xl mx-auto space-y-6 py-6">
            <PostSkeleton />
            <PostSkeleton />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <Card className="border-primary/10 bg-card/80">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">{forcedChannelId ? (channelMeta?.title || 'Kanal') : 'Schwarzes Brett'}</h1>
                            <p className="text-xs text-muted-foreground">
                                {forcedChannelId ? 'Kanal-Wall: Neueste Beiträge oben, angepinnte Beiträge zuerst.' : 'Dein Feed aus abonnierten Kanälen und persönlichen Beiträgen.'}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                {!hideChannelFilters && (
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={activeChannelId === 'all' ? 'default' : 'outline'}
                            onClick={() => setActiveChannelId('all')}
                            className="h-8"
                        >
                            Alle Beiträge
                        </Button>
                        {channels.filter((channel) => channel.isSubscriber || channel.isModerator).map((channel) => (
                            <Button
                                key={channel._id}
                                size="sm"
                                variant={activeChannelId === channel._id ? 'default' : 'outline'}
                                onClick={() => setActiveChannelId(channel._id)}
                                className="h-8 gap-2"
                            >
                                {channel.isPrivate && <Lock size={12} />}
                                <span className="max-w-[160px] truncate">{channel.title}</span>
                            </Button>
                        ))}
                    </div>
                </CardContent>
                )}
            </Card>

            {/* Create Post */}
            {hasPermission('edit') && (
                <PostCreator 
                    currentUser={currentUser} 
                    channels={postableChannels}
                    selectedChannelId={forcedChannelId || postChannelId}
                    onChannelChange={setPostChannelId}
                    onPostCreated={() => fetchPosts(true)} 
                />
            )}

            {/* Posts List */}
            <div className="space-y-8">
                {Array.isArray(posts) && posts.map((post) => {
                    const postId = post._id || post.id;
                    const isLiked = post.likes?.includes(currentUser?.id || currentUser?._id);
                    const showComments = expandedComments[postId];
                    const comments = commentsByPost[postId] || [];
                    const commentMeta = commentsMetaByPost[postId];
                    const isLoadingComments = loadingCommentsByPost[postId];
                    const commentCount = Number(post.commentsCount ?? post.comments?.length ?? commentMeta?.total ?? 0);
                    const postUserId = currentUser?._id || currentUser?.id;
                    const postAuthorId = post.author?._id || post.author?.id || post.author;
                    const isPostOwner = String(postUserId || '') === String(postAuthorId || '');
                    const channelModerators = Array.isArray(post.channel?.moderators) ? post.channel.moderators.map((id) => String(id)) : [];
                    const isChannelModerator = Boolean(
                        post.channel && (
                            currentUser?.role === 'ADMIN' ||
                            String(post.channel?.createdBy || '') === String(postUserId || '') ||
                            channelModerators.includes(String(postUserId || ''))
                        )
                    );

                    return (
                        <Card 
                            key={postId} 
                            id={postId}
                            className="shadow-lg border-primary/5 hover:border-primary/20 transition-all duration-300 group overflow-hidden"
                        >
                            <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
                                <div className="flex gap-4">
                                    <UserAvatar user={post.author} size="md" className="ring-2 ring-primary/5" />
                                    <div className="flex flex-col justify-center">
                                        <span className="text-sm font-bold uppercase tracking-tight text-primary">
                                            {post.author?.firstName ? `${post.author.firstName} ${post.author.lastName || ''}` : `@${post.author?.username}`}
                                        </span>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-normal opacity-60">
                                            <Clock size={10} className="stroke-[3px]" /> {new Date(post.createdAt).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {post.channel?.title && (
                                            <div className="mt-1 flex items-center flex-wrap gap-1.5">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {post.channel.isPrivate && <Lock size={10} className="mr-1" />}
                                                    {post.channel.title}
                                                </Badge>
                                                {post.pinned && (
                                                    <Badge className="text-[10px] gap-1">
                                                        <Pin size={10} /> Angepinnt
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isChannelModerator && post.channel && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-9 w-9 transition-all opacity-0 group-hover:opacity-100",
                                                post.pinned ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-primary"
                                            )}
                                            onClick={() => handlePinToggle(postId, Boolean(post.pinned))}
                                            aria-label="Pin post"
                                        >
                                            <Pin size={18} />
                                        </Button>
                                    )}
                                    {(currentUser?.role === 'ADMIN' || isChannelModerator || isPostOwner) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                            onClick={() => handleDelete(postId)}
                                            aria-label="Delete post"
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 pt-0 space-y-6">
                                <p className={cn(
                                    "text-base leading-relaxed whitespace-pre-wrap font-medium",
                                    post.isModerated ? "text-muted-foreground italic opacity-70" : "text-foreground/90"
                                )}>
                                    {renderContent(post.content)}
                                </p>

                                {post.attachments?.length > 0 && (
                                    <div className={cn(
                                        "grid gap-2 rounded-[1.5rem] overflow-hidden border-2 border-primary/5 shadow-inner",
                                        post.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
                                    )}>
                                        {post.attachments.map((url, i) => {
                                            const displayUrl = post.optimizedAttachments?.[i] || url;
                                            return (
                                                <img 
                                                    key={i} 
                                                    src={displayUrl} 
                                                    onClick={() => setSelectedImage(url)}
                                                    className="w-full aspect-video object-cover hover:scale-[1.03] transition-transform duration-700 cursor-pointer" 
                                                    alt="Beitrag Anhang"
                                                />
                                            );
                                        })}
                                    </div>
                                )}

                                {post.linkData?.url && (
                                    <div className="rounded-2xl border-2 border-primary/5 bg-muted/30 overflow-hidden group/link transition-all hover:bg-muted/50 shadow-inner">
                                        {post.linkData.isYouTube ? (
                                            <div className="aspect-video">
                                                <iframe 
                                                    className="w-full h-full"
                                                    src={`https://www.youtube.com/embed/${post.linkData.videoId}`}
                                                    frameBorder="0"
                                                    allowFullScreen
                                                ></iframe>
                                            </div>
                                        ) : (
                                            <a href={post.linkData.url} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row">
                                                {post.linkData.image && <img src={post.linkData.image} className="sm:w-48 aspect-video sm:aspect-square object-cover" />}
                                                <div className="p-6 flex flex-col justify-center flex-1">
                                                    <h5 className="text-sm font-bold uppercase tracking-tight line-clamp-1 group-hover/link:text-primary transition-colors">{post.linkData.title}</h5>
                                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed font-medium">{post.linkData.description}</p>
                                                    <span className="text-[9px] text-primary font-bold mt-4 flex items-center gap-1.5 uppercase tracking-[0.2em] opacity-70">
                                                        <ExternalLink size={10} className="stroke-[3px]" /> {new URL(post.linkData.url).hostname}
                                                    </span>
                                                </div>
                                            </a>
                                        )}
                                    </div>
                                )}

                                {post.poll?.question && (
                                    <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
                                        <p className="text-sm font-semibold">{post.poll.question}</p>
                                        <div className="space-y-2">
                                            {post.poll.options?.map((option, optionIndex) => {
                                                const votes = (post.poll.votes || []).filter((vote) => String(vote.optionId) === String(option._id));
                                                const totalVotes = (post.poll.votes || []).length;
                                                const percentage = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;
                                                const myVotes = (post.poll.votes || []).filter((vote) => String(vote.user) === String(currentUser?._id || currentUser?.id)).map((vote) => String(vote.optionId));
                                                const selected = (pollSelections[postId] || myVotes).includes(String(option._id));
                                                const pollColors = [
                                                    { bar: "bg-[rgb(210,186,224)]", selected: "border-[rgb(210,186,224)] bg-[rgb(210,186,224)]/22" },
                                                    { bar: "bg-[rgb(161,206,217)]", selected: "border-[rgb(161,206,217)] bg-[rgb(161,206,217)]/20" },
                                                    { bar: "bg-[rgb(237,132,91)]", selected: "border-[rgb(237,132,91)] bg-[rgb(237,132,91)]/20" }
                                                ];
                                                const color = pollColors[optionIndex % pollColors.length];
                                                return (
                                                    <button
                                                        key={option._id}
                                                        type="button"
                                                        onClick={() => {
                                                            setPollSelections((prev) => {
                                                                const current = prev[postId] || myVotes;
                                                                const optionKey = String(option._id);
                                                                if (post.poll.multiple) {
                                                                    const has = current.includes(optionKey);
                                                                    return { ...prev, [postId]: has ? current.filter((id) => id !== optionKey) : [...current, optionKey] };
                                                                }
                                                                return { ...prev, [postId]: [optionKey] };
                                                            });
                                                        }}
                                                        className={cn(
                                                            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                                                            selected ? color.selected : "bg-background hover:bg-muted"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between gap-3 text-sm">
                                                            <span className="truncate">{option.label}</span>
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                {selected && <Check size={12} />}
                                                                {votes.length} ({percentage}%)
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div className={cn("h-full", color.bar)} style={{ width: `${percentage}%` }} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-muted-foreground">
                                                {(post.poll.votes || []).length} Stimme(n) insgesamt
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handlePollVote(postId, post.poll)}
                                                disabled={pollSubmittingByPost[postId]}
                                            >
                                                {pollSubmittingByPost[postId] ? <Loader2 className="animate-spin" size={14} /> : 'Abstimmen'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>

                            <Separator className="opacity-50" />

                            <CardFooter className="p-3 px-6 flex gap-3 bg-muted/5">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-9 gap-2",
                                        isLiked ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20" : ""
                                    )}
                                    onClick={() => handleLike(postId)}
                                    aria-label="Like post"
                                >
                                    <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                                    <span>{post.likes?.length || 0}</span>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-9 gap-2",
                                        showComments ? "text-primary bg-primary/10" : ""
                                    )}
                                    onClick={() => {
                                        const next = !showComments;
                                        setExpandedComments({ ...expandedComments, [postId]: next });
                                        if (next && !commentsByPost[postId]) fetchComments(postId, true);
                                    }}
                                    aria-label="Toggle comments"
                                >
                                    <MessageCircle size={18} />
                                    <span>{commentCount}</span>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-9 w-9 ml-auto"
                                    onClick={() => handleShare(postId)}
                                    aria-label="Share post"
                                >
                                    <Share2 size={18} />
                                </Button>
                            </CardFooter>

                            {showComments && (
                                <div className="bg-muted/30 border-t animate-in slide-in-from-top-2 duration-500 p-6 pt-8">
                                    <div className="space-y-6">
                                        {isLoadingComments && comments.length === 0 && (
                                            <div className="flex items-center justify-center py-3 text-muted-foreground">
                                                <Loader2 className="animate-spin" size={16} />
                                            </div>
                                        )}
                                        {comments.map((comment, idx) => (
                                            <div key={idx} className="flex gap-4 group/comment">
                                                <UserAvatar user={comment.author} size="xs" className="mt-1 ring-2 ring-primary/5" />
                                                <div className={cn(
                                                    "flex-1 rounded-3xl rounded-tl-none p-4 border transition-all hover:shadow-md",
                                                    comment.isModerated 
                                                        ? "bg-muted/50 border-muted-foreground/10 opacity-70 italic" 
                                                        : "bg-background border-primary/5 shadow-sm hover:border-primary/10"
                                                )}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-normal text-primary ">{comment.author?.firstName || comment.author?.username}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight opacity-50">{new Date(comment.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {(currentUser?.role === 'ADMIN' || (currentUser?._id || currentUser?.id) === comment.author?._id) && !comment.isModerated && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteComment(postId, comment._id)}
                                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm leading-relaxed font-medium text-foreground/80">{renderContent(comment.content)}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {Boolean(commentMeta?.hasMore) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => fetchComments(postId)}
                                                disabled={isLoadingComments}
                                            >
                                                {isLoadingComments ? <Loader2 className="animate-spin" size={14} /> : 'Mehr Kommentare laden'}
                                            </Button>
                                        )}

                                        <div className="flex gap-4 pt-4 border-t border-primary/5">
                                            <UserAvatar user={currentUser} size="xs" className="mt-1.5 ring-2 ring-primary/5" />
                                            <div className="flex-1 relative">
                                                <Input 
                                                    value={commentTexts[postId] || ''}
                                                    onChange={(e) => setCommentTexts({ ...commentTexts, [postId]: e.target.value })}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleComment(postId)}
                                                    placeholder="Schreibe einen Kommentar..."
                                                    className="w-full h-11 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                                />
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                                    onClick={() => handleComment(postId)}
                                                >
                                                    <Send size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
                {hasMorePosts && (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => fetchPosts(false)}
                        disabled={loadingMorePosts}
                    >
                        {loadingMorePosts ? <Loader2 className="animate-spin" size={16} /> : 'Mehr Beiträge laden'}
                    </Button>
                )}
            </div>

            {/* Image Lightbox */}
            {/* Image Lightbox */}
            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none">
                    <DialogHeader className="absolute top-4 right-12 z-50">
                        <DialogTitle className="sr-only">Bildansicht</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        {selectedImage && (
                            <>
                                <img 
                                    src={selectedImage} 
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" 
                                    alt="Full size"
                                />
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row gap-3">
                                    <Button 
                                        onClick={() => handleDownload(selectedImage)}
                                        className="bg-background/20 backdrop-blur-md hover:bg-background/40"
                                    >
                                        <Download size={20} />
                                        Download
                                    </Button>
                                    <Button 
                                        variant="ghost"
                                        onClick={() => setSelectedImage(null)}
                                        className="bg-background/20 backdrop-blur-md hover:bg-background/40 h-10 w-10 p-0"
                                    >
                                        <X size={24} />
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CommunityWall;
