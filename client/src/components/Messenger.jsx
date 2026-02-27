import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Send, Search, MoreVertical, Info, 
    ChevronLeft, Loader2, UserCircle, MessageSquare, Clock, UserPlus,
    Smile, Image as ImageIcon
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from './UserAvatar';

import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const GIPHY_API_KEY = 'dc6zaTOxFJmzC'; // Public Beta Key

const api = axios.create({ baseURL: '', withCredentials: true });

const Messenger = ({ currentUser, socket }) => {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [msgInput, setMsgInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMsgs, setLoadingMessages] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showGiphy, setShowGiphy] = useState(false);
    const [giphySearch, setGiphySearch] = useState('');
    const [giphyResults, setGiphyResults] = useState([]);
    const [loadingGiphy, setLoadingGiphy] = useState(false);
    const scrollRef = useRef();
    const currentUserId = String(currentUser?._id || '');

    const getConversationTarget = (conv) => {
        const participants = Array.isArray(conv?.participants) ? conv.participants : [];
        const other = participants.find((p) => String(p?._id || '') !== currentUserId);
        return other || participants.find((p) => String(p?._id || '') === currentUserId) || null;
    };

    const resolveRecipientId = () => {
        const target = getConversationTarget(activeConv);
        return target?._id || currentUser?._id || null;
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (showGiphy && giphySearch === '') {
            fetchTrendingGiphy();
        }
    }, [showGiphy]);

    const fetchTrendingGiphy = async () => {
        setLoadingGiphy(true);
        try {
            const res = await axios.get(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12`);
            setGiphyResults(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoadingGiphy(false); }
    };

    const handleGiphySearch = async (val) => {
        setGiphySearch(val);
        if (val.length < 2) return;
        setLoadingGiphy(true);
        try {
            const res = await axios.get(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${val}&limit=12`);
            setGiphyResults(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoadingGiphy(false); }
    };

    const sendGiphy = (gif) => {
        const url = gif.images.fixed_height.url;
        const recipientId = resolveRecipientId();
        socket.emit('send_message', {
            conversationId: conversationId === 'new' ? null : conversationId,
            recipientId,
            content: `GIF:${url}`
        });
        setShowGiphy(false);
    };

    const addEmoji = (emoji) => {
        setMsgInput(prev => prev + emoji);
        setShowEmoji(false);
    };

    const handleInputChange = (e) => {
        setMsgInput(e.target.value);
        if (!socket) return;

        if (typingTimeout) clearTimeout(typingTimeout);
        const recipientId = resolveRecipientId();

        socket.emit('typing', { 
            conversationId: conversationId === 'new' ? null : conversationId,
            recipientId
        });

        setTypingTimeout(setTimeout(() => {
            socket.emit('stop_typing', { 
                conversationId: conversationId === 'new' ? null : conversationId,
                recipientId
            });
        }, 2000));
    };

    useEffect(() => {
        if (showNewChat && allUsers.length === 0) {
            fetchUsers();
        }
    }, [showNewChat]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/api/users/messenger');
            setAllUsers(res.data);
        } catch (e) { console.error("Fehler beim Laden der Benutzer:", e); }
    };

    const startConversation = async (recipient) => {
        const recipientId = String(recipient?._id || '');
        // Check if a matching 1:1/self conversation already exists
        const existing = conversations.find((c) => {
            const ids = (c.participants || []).map((p) => String(p?._id || ''));
            if (recipientId === currentUserId) {
                return ids.length === 1 && ids[0] === currentUserId;
            }
            return ids.length === 2 && ids.includes(currentUserId) && ids.includes(recipientId);
        });

        if (existing) {
            navigate(`/messenger/${existing._id}`);
            setActiveConv(existing);
        } else {
            setActiveConv({
                participants: recipientId === currentUserId ? [currentUser] : [currentUser, recipient],
                lastMessage: null,
                isNew: true
            });
            setMessages([]);
            navigate(`/messenger/new`);
        }
        setShowNewChat(false);
    };

    const filteredUsers = allUsers.filter(u => 
        `${u.firstName} ${u.lastName} ${u.username}`.toLowerCase().includes(userSearch.toLowerCase())
    );

    useEffect(() => {
        if (conversationId && conversationId !== 'new') {
            fetchMessages(conversationId);
            if (socket) socket.emit('join_conversation', conversationId);
        }
    }, [conversationId]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg) => {
            if (conversationId === 'new' && msg.participants?.some(p => p === currentUser._id)) {
                 fetchConversations();
                 navigate(`/messenger/${msg.ConversationId}`);
            }

            setConversations(prev => {
                const updated = prev.map(c => {
                    if (c._id === msg.ConversationId) {
                        return { ...c, lastMessage: msg, updatedAt: new Date() };
                    }
                    return c;
                });
                
                if (!updated.find(c => c._id === msg.ConversationId)) {
                    fetchConversations();
                }

                return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });

            if (msg.ConversationId === conversationId || (conversationId === 'new' && !msg.ConversationId)) {
                setMessages(prev => [...prev, msg]);
                if (msg.ConversationId) markAsRead(msg.ConversationId);
            }
        };

        const handleStatusChange = ({ userId, isOnline, lastSeen }) => {
            setAllUsers(prev => prev.map(u => String(u._id) === String(userId) ? { ...u, isOnline, lastSeen } : u));
            setConversations(prev => prev.map(c => ({
                ...c,
                participants: c.participants.map(p => String(p._id) === String(userId) ? { ...p, isOnline, lastSeen } : p)
            })));
            if (activeConv?.participants.some(p => String(p._id) === String(userId))) {
                setActiveConv(prev => ({
                    ...prev,
                    participants: prev.participants.map(p => String(p._id) === String(userId) ? { ...p, isOnline, lastSeen } : p)
                }));
            }
        };

        const handleTyping = ({ userId, conversationId: cid }) => {
            if (conversationId === cid || (conversationId === 'new' && !cid)) {
                setIsTyping(true);
            }
        };

        const handleStopTyping = ({ userId, conversationId: cid }) => {
            if (conversationId === cid || (conversationId === 'new' && !cid)) {
                setIsTyping(false);
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('user_status_change', handleStatusChange);
        socket.on('user_typing', handleTyping);
        socket.on('user_stop_typing', handleStopTyping);
        return () => {
            socket.off('new_message');
            socket.off('user_status_change');
            socket.off('user_typing');
            socket.off('user_stop_typing');
        };
    }, [socket, conversationId, activeConv]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchConversations = async () => {
        try {
            const res = await api.get('/api/chat/conversations');
            setConversations(res.data);
            if (conversationId && conversationId !== 'new') {
                const active = res.data.find(c => c._id === conversationId);
                if (active) setActiveConv(active);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMessages = async (id) => {
        setLoadingMessages(true);
        try {
            const res = await api.get(`/api/chat/messages/${id}`);
            setMessages(res.data);
            markAsRead(id);
        } catch (e) { console.error(e); }
        finally { setLoadingMessages(false); }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/api/chat/read/${id}`);
            window.dispatchEvent(new CustomEvent('chat-read'));
        } catch (e) {}
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!msgInput.trim() || !socket) return;

        const recipientId = resolveRecipientId();
        
        socket.emit('send_message', {
            conversationId: conversationId === 'new' ? null : conversationId,
            recipientId,
            content: msgInput.trim()
        });

        socket.emit('stop_typing', { 
            conversationId: conversationId === 'new' ? null : conversationId,
            recipientId
        });

        setMsgInput('');
    };

    if (loading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="flex h-[85vh] bg-background border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-500">
            {/* Sidebar */}
            <div className={cn(
                "w-full md:w-[350px] flex flex-col border-r bg-muted/10 transition-all",
                conversationId && "hidden md:flex"
            )}>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tighter uppercase text-primary">Messenger</h2>
                        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowNewChat(true)} title="Neuer Chat">
                            <UserPlus size={20} />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Suchen..." className="pl-9 h-11 bg-muted/30 border-none rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {conversations.map(conv => {
                        const other = getConversationTarget(conv);
                        const convIsTyping = isTyping && (conversationId === conv._id);
                        return (
                            <div 
                                key={conv._id}
                                onClick={() => { navigate(`/messenger/${conv._id}`); setActiveConv(conv); }}
                                className={cn(
                                    "flex items-center gap-4 p-4 mx-2 rounded-2xl cursor-pointer transition-all hover:bg-muted/50",
                                    conversationId === conv._id && "bg-primary/10 hover:bg-primary/15 shadow-sm"
                                )}
                            >
                                <UserAvatar user={other} size="md" showStatus={true} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className="text-sm font-bold truncate">{other?.firstName} {other?.lastName}</h4>
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-60">
                                            {conv.lastMessage ? new Date(conv.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                    </div>
                                    <p className={cn("text-xs truncate font-medium", convIsTyping ? "text-emerald-500 animate-pulse" : "text-muted-foreground")}>
                                        {convIsTyping ? 'schreibt...' : (
                                            <>
                                                {String(conv.lastMessage?.SenderId?._id || conv.lastMessage?.SenderId || "") === currentUserId ? 'Du: ' : ''}
                                                {conv.lastMessage?.content?.startsWith('GIF:') ? '🖼 GIF' : (conv.lastMessage?.content || 'Noch keine Nachrichten')}
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    {conversations.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-30">
                            <MessageSquare size={48} strokeWidth={1} />
                            <p className="text-xs font-bold uppercase tracking-widest">Keine Chats vorhanden</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col transition-all",
                (!conversationId || conversationId === 'new') && "hidden md:flex bg-muted/5"
            )}>
                {(conversationId && (conversationId !== 'new' || activeConv)) ? (
                    <>
                        {/* Header */}
                        <div className="h-20 flex items-center justify-between px-6 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => navigate('/messenger')}>
                                    <ChevronLeft size={24} />
                                </Button>
                                {activeConv && (
                                    <UserAvatar 
                                        user={getConversationTarget(activeConv)} 
                                        size="sm" 
                                        showStatus={true}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/profile/${getConversationTarget(activeConv)?.username}`)}
                                    />
                                )}
                                <div className="cursor-pointer" onClick={() => navigate(`/profile/${getConversationTarget(activeConv)?.username}`)}>
                                    <h3 className="text-sm font-bold tracking-tight">
                                        {getConversationTarget(activeConv)?.firstName} {getConversationTarget(activeConv)?.lastName}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {isTyping ? (
                                            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest animate-pulse">schreibt...</p>
                                        ) : getConversationTarget(activeConv)?.isOnline ? (
                                            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest animate-pulse">Online</p>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Offline</p>
                                        )}
                                        {getConversationTarget(activeConv)?.status && (
                                            <>
                                                <span className="text-muted-foreground/30 text-[10px]">•</span>
                                                <p className="text-[10px] text-primary/70 font-semibold italic truncate max-w-[200px]">
                                                    "{getConversationTarget(activeConv)?.status}"
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="rounded-full text-primary/60"
                                    onClick={() => navigate(`/profile/${getConversationTarget(activeConv)?.username}`)}
                                >
                                    <UserCircle size={20} />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-full text-primary/60"><Info size={20} /></Button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5 custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const senderId = msg.SenderId?._id || msg.SenderId;
                                const isMe = senderId === currentUser._id;
                                const prevSenderId = idx > 0 ? (messages[idx-1].SenderId?._id || messages[idx-1].SenderId) : null;
                                const showAvatar = idx === 0 || prevSenderId !== senderId;
                                
                                const isGif = msg.content?.startsWith('GIF:');
                                const gifUrl = isGif ? msg.content.substring(4) : null;

                                return (
                                    <div key={msg._id || idx} className={cn(
                                        "flex gap-3 max-w-[85%] animate-in slide-in-from-bottom-2 duration-300",
                                        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}>
                                        {!isMe && (
                                            <div className="w-8 shrink-0">
                                                {showAvatar && (
                                                    <UserAvatar 
                                                        user={msg.SenderId} 
                                                        size="xs" 
                                                        className="cursor-pointer" 
                                                        onClick={() => navigate(`/profile/${msg.SenderId?.username}`)}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {isGif ? (
                                                <div className="rounded-2xl overflow-hidden border-4 border-background shadow-lg">
                                                    <img src={gifUrl} alt="GIF" className="max-w-full h-auto max-h-60" />
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "p-3.5 rounded-2xl text-sm font-medium shadow-sm",
                                                    isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-background border border-primary/10 rounded-tl-none"
                                                )}>
                                                    {msg.content}
                                                </div>
                                            )}
                                            <p className={cn(
                                                "text-[8px] font-black uppercase tracking-widest opacity-40",
                                                isMe ? "text-right" : "text-left"
                                            )}>
                                                {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {isTyping && (
                                <div className="flex gap-3 max-w-[85%] animate-in slide-in-from-bottom-2 duration-300 mr-auto">
                                    <div className="w-8 shrink-0">
                                        <UserAvatar user={getConversationTarget(activeConv)} size="xs" />
                                    </div>
                                    <div className="bg-background border border-primary/10 p-3 rounded-2xl rounded-tl-none flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                </div>
                            )}
                            {loadingMsgs && <div className="py-4 text-center"><Loader2 className="animate-spin text-primary inline" size={20} /></div>}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t bg-background/80 backdrop-blur-md space-y-4">
                            <form onSubmit={handleSendMessage} className="flex gap-3 bg-muted/30 p-1.5 rounded-2xl border">
                                <div className="flex gap-1 pr-1">
                                    <Popover open={showEmoji} onOpenChange={setShowEmoji}>
                                        <PopoverTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary/60 hover:text-primary">
                                                <Smile size={20} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent side="top" align="start" className="w-auto p-2">
                                            <div className="grid grid-cols-6 gap-1">
                                                {['😊','😂','❤️','👍','🙏','🙌','🔥','✨','🎉','👋','😎','💡','🎸','🎹','🎤','🏠','📍','📞'].map(e => (
                                                    <button key={e} onClick={() => addEmoji(e)} className="h-10 w-10 text-xl hover:bg-muted rounded-lg transition-colors">{e}</button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    <Popover open={showGiphy} onOpenChange={setShowGiphy}>
                                        <PopoverTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary/60 hover:text-primary">
                                                <ImageIcon size={20} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent side="top" align="start" className="w-[300px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                                            <div className="bg-muted/30 p-3 border-b">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input 
                                                        placeholder="GIFs suchen..." 
                                                        className="h-9 pl-7 bg-background border-none text-xs font-bold focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                                                        value={giphySearch}
                                                        onChange={(e) => handleGiphySearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto p-2 grid grid-cols-2 gap-2 custom-scrollbar">
                                                {loadingGiphy ? (
                                                    <div className="col-span-2 py-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={24} /></div>
                                                ) : giphyResults.map(gif => (
                                                    <img 
                                                        key={gif.id} 
                                                        src={gif.images.preview_gif.url} 
                                                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => sendGiphy(gif)}
                                                    />
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <Input 
                                    placeholder="Nachricht schreiben..." 
                                    value={msgInput}
                                    onChange={handleInputChange}
                                    className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent h-11 text-sm font-medium"
                                />
                                <Button type="submit" size="icon" className="h-11 w-11 rounded-xl shadow-lg" disabled={!msgInput.trim()}>
                                    <Send size={20} />
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                        <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center border border-primary/20 shadow-inner">
                            <MessageSquare size={40} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Wähle einen Chat aus</h2>
                            <p className="text-muted-foreground text-sm font-medium mt-2 max-w-xs">Starte eine Unterhaltung mit deinen Teammitgliedern in Echtzeit.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-muted/30">
                        <DialogTitle className="text-2xl font-bold tracking-tighter uppercase text-primary">Neuer Chat</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Wähle ein Teammitglied aus</DialogDescription>
                    </DialogHeader>
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Empfänger suchen..." 
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="pl-9 h-12 bg-muted/30 border-none rounded-xl font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                            />
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-1 pr-2">
                            {filteredUsers.map(u => (
                                <div 
                                    key={u._id}
                                    onClick={() => startConversation(u)}
                                    className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-primary/5 transition-all group"
                                >
                                    <UserAvatar user={u} size="sm" showStatus={true} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold group-hover:text-primary transition-colors">{u.firstName} {u.lastName}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase opacity-60">@{u.username}</p>
                                            {u.status && (
                                                <>
                                                    <span className="text-muted-foreground/30">•</span>
                                                    <p className="text-[10px] text-primary/70 font-semibold truncate max-w-[150px] italic">"{u.status}"</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="py-8 text-center opacity-30 space-y-2">
                                    <Search size={32} className="mx-auto" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Niemand gefunden</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Messenger;
