import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Heart, MessageSquare, Share2, MoreHorizontal, Loader2, ArrowLeft, Send
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from './UserAvatar';

const api = axios.create({ baseURL: '', withCredentials: true });

const SinglePostView = ({ currentUser, showToast, allUsers }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPost();
    }, [id]);

    const fetchPost = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/wall/${id}`);
            setPost(res.data);
        } catch (e) {
            showToast("Beitrag nicht gefunden", "error");
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        try {
            const res = await api.post(`/api/wall/${post._id}/like`);
            setPost(prev => ({ ...prev, likes: res.data.likes }));
        } catch (e) { showToast("Fehler beim Liken", "error"); }
    };

    const handleCommentLike = async (commentId) => {
        try {
            const res = await api.post(`/api/wall/${post._id}/comments/${commentId}/like`);
            setPost(prev => ({
                ...prev,
                comments: prev.comments.map(c => 
                    c._id === commentId ? { ...c, likes: res.data.likes } : c
                )
            }));
        } catch (e) { showToast("Fehler beim Liken", "error"); }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/api/wall/${post._id}/comment`, { content: comment });
            setPost(res.data);
            setComment('');
            showToast("Kommentar gesendet", "success");
        } catch (e) {
            showToast("Fehler beim Senden", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to render text with mentions linkable
    const renderContent = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const username = part.substring(1);
                // Check if user exists in known list (optional)
                return <span key={i} className="font-bold text-primary cursor-pointer hover:underline" onClick={() => navigate(`/profile/${username}`)}>{part}</span>;
            }
            return part;
        });
    };

    if (loading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    const isLiked = post?.likes?.includes(currentUser._id);

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in zoom-in-95 duration-300">
            <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary transition-colors" onClick={() => navigate('/')}>
                <ArrowLeft size={20} /> Zurück zum Schwarzen Brett
            </Button>

            <Card className="overflow-hidden border-none shadow-2xl rounded-[2rem]">
                <CardHeader className="p-6 pb-4 flex flex-row items-start gap-4">
                    <UserAvatar user={post.author} size="md" />
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 
                                    className="font-bold text-lg leading-none cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => navigate(`/profile/${post.author.username}`)}
                                >
                                    {post.author.firstName} {post.author.lastName}
                                </h3>
                                <p className="text-xs text-muted-foreground font-medium mt-1">
                                    {new Date(post.createdAt).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full -mr-2"><MoreHorizontal size={20} /></Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="px-6 pb-6 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                        {renderContent(post.content)}
                    </div>

                    {post.optimizedAttachments && post.optimizedAttachments.length > 0 && (
                        <div className="w-full">
                            {post.optimizedAttachments.map((img, idx) => (
                                <img key={idx} src={img} alt="Attachment" className="w-full h-auto object-cover max-h-[600px]" />
                            ))}
                        </div>
                    )}

                    {/* Stats & Actions Bar */}
                    <div className="px-6 py-4 flex items-center justify-between border-t border-b bg-muted/10">
                        <div className="flex gap-1">
                            <Button 
                                variant={isLiked ? "secondary" : "ghost"} 
                                size="sm" 
                                className={cn("gap-2 rounded-xl font-bold h-10 px-4", isLiked && "text-destructive bg-destructive/10 hover:bg-destructive/20")}
                                onClick={handleLike}
                            >
                                <Heart size={20} className={cn(isLiked && "fill-current")} />
                                <span>{post.likes?.length || 0}</span>
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-2 rounded-xl font-bold h-10 px-4">
                                <MessageSquare size={20} />
                                <span>{post.comments?.length || 0}</span>
                            </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full"><Share2 size={20} /></Button>
                    </div>

                    {/* Comments Section */}
                    <div className="bg-muted/5 p-6 space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Kommentare</h4>
                        
                        <div className="space-y-6">
                            {post.comments?.map(comment => {
                                const isCommentLiked = comment.likes?.includes(currentUser._id);
                                return (
                                    <div key={comment._id} className="flex gap-4 group">
                                        <UserAvatar user={comment.author} size="sm" />
                                        <div className="flex-1 space-y-1">
                                            <div className="bg-background border rounded-2xl rounded-tl-none p-4 shadow-sm relative">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span 
                                                        className="font-bold text-sm cursor-pointer hover:text-primary"
                                                        onClick={() => navigate(`/profile/${comment.author.username}`)}
                                                    >
                                                        {comment.author.firstName} {comment.author.lastName}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase opacity-50">
                                                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm leading-relaxed text-foreground/90 font-medium">
                                                    {renderContent(comment.content)}
                                                </p>
                                                
                                                <button 
                                                    onClick={() => handleCommentLike(comment._id)}
                                                    className={cn(
                                                        "absolute -bottom-3 right-4 bg-background border px-2 py-0.5 rounded-full shadow-sm text-[10px] font-bold flex items-center gap-1 transition-all hover:scale-110",
                                                        isCommentLiked ? "text-destructive border-destructive/20 bg-destructive/5" : "text-muted-foreground"
                                                    )}
                                                >
                                                    <Heart size={10} className={cn(isCommentLiked && "fill-current")} />
                                                    {comment.likes?.length || 0}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="flex gap-4 pt-4 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pb-4">
                            <UserAvatar user={currentUser} size="sm" />
                            <div className="flex-1 relative">
                                <Textarea 
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Schreibe einen Kommentar... (@nutzername)"
                                    className="min-h-[3rem] max-h-32 pr-12 py-3 rounded-2xl resize-none shadow-sm border-muted-foreground/20 focus-visible:ring-primary/20 bg-background"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleComment(e);
                                        }
                                    }}
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute right-1 top-1 h-8 w-8 rounded-xl shadow-none hover:bg-primary/10 hover:text-primary transition-all"
                                    variant="ghost"
                                    onClick={handleComment}
                                    disabled={!comment.trim() || submitting}
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SinglePostView;
