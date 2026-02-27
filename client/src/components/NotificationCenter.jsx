import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Check, Calendar, MessageSquare, ShieldAlert, X, ExternalLink, Loader2, Zap, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

const api = axios.create({ baseURL: '', withCredentials: true });

const TYPE_ICONS = {
    plan: <Calendar className="text-primary" size={16} />,
    wall: <MessageSquare className="text-emerald-500" size={16} />,
    system: <ShieldAlert className="text-destructive" size={16} />,
    security: <ShieldAlert className="text-amber-500" size={16} />,
    substitute: <Bell className="text-destructive" size={16} />,
    system_update: <Zap className="text-amber-500" size={16} />,
    chat: <MessageSquare className="text-blue-500" size={16} />
};

const NotificationCenter = ({ onClose, onNavigate }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(res.data);
        } catch (e) { console.error("Benachrichtigungen laden fehlgeschlagen:", e); }
        finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchNotifications();
        
        const handleRefresh = (e) => {
            if (e.detail) setNotifications(e.detail);
        };
        window.addEventListener('notifications-refreshed', handleRefresh);
        return () => window.removeEventListener('notifications-refreshed', handleRefresh);
    }, []);

    const markRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
        } catch (e) { console.error("Gelesen markieren fehlgeschlagen:", e); }
    };

    const markAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(notifications.map(n => ({ ...n, read: true })));
        } catch (e) { console.error("Alle gelesen markieren fehlgeschlagen:", e); }
    };

    const clearAll = async () => {
        try {
            await api.delete('/api/notifications/clear-all');
            setNotifications([]);
        } catch (e) { console.error("Alle löschen fehlgeschlagen:", e); }
    };

    const handleAcceptSubstitute = async (notification) => {
        // Wir brauchen die SubstituteRequest ID. Falls nicht in Link, müssen wir sie suchen.
        // Einfacher: Wir navigieren zum Dienstplaner, dort sieht man die Anfragen.
        onNavigate('/dienstplaner');
        onClose();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <Card className="flex flex-col h-full max-h-[85vh] w-full sm:max-w-md shadow-2xl border-primary/10 overflow-hidden page-transition rounded-[2rem]">
            <CardHeader className="p-6 flex flex-row items-center justify-between space-y-0 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary shadow-inner">
                        <Bell size={20} className="stroke-[2.5px]" />
                    </div>
                    <div className="flex flex-col">
                        <CardTitle className="text-lg font-bold uppercase tracking-tight text-primary">Mitteilungen</CardTitle>
                        {unreadCount > 0 && (
                            <span className="text-[9px] font-bold uppercase tracking-normal text-primary/70">{unreadCount} ungelesene News</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[10px] font-bold uppercase tracking-tight text-primary hover:bg-primary/10 rounded-xl transition-all gap-2" 
                            onClick={markAllRead}
                        >
                            <Check size={14} className="stroke-[3px]" />
                            <span>Alle lesen</span>
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all" onClick={onClose}>
                        <X size={20} className="stroke-[3px]" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-background custom-scrollbar">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <span className="font-bold uppercase tracking-normal text-[10px]">Synchronisiere...</span>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="py-24 text-center space-y-6 opacity-20">
                        <Bell className="mx-auto text-muted-foreground" size={64} strokeWidth={1} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Aktuell keine Mitteilungen.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div 
                            key={n._id} 
                            onClick={() => !n.read && markRead(n._id)}
                            className={cn(
                                "group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
                                n.read ? "bg-muted/10 border-transparent opacity-60" : "bg-card border-primary/5 shadow-sm hover:border-primary/20 hover:shadow-md"
                            )}
                        >
                            {!n.read && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)] animate-pulse" />}
                            
                            <div className="shrink-0 p-2.5 bg-muted/50 rounded-xl border border-primary/5">
                                {TYPE_ICONS[n.type?.split('_')[0]] || <Bell size={18} className="text-primary" />}
                            </div>
                            
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h4 className={cn("text-[11px] font-bold uppercase tracking-tight truncate", n.read ? "text-muted-foreground" : "text-primary")}>
                                        {n.title}
                                    </h4>
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase whitespace-nowrap ml-2 opacity-50">
                                        {new Date(n.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-bold leading-relaxed line-clamp-2">
                                    {n.message}
                                </p>

                                {n.type === 'substitute_request' && (
                                    <div className="mt-3 flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            className="h-7 text-[9px] font-bold uppercase"
                                            onClick={(e) => { e.stopPropagation(); handleAcceptSubstitute(n); }}
                                        >
                                            Übernehmen
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {n.link && !n.type?.includes('substitute') && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute bottom-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all bg-primary/10 hover:bg-primary hover:text-white rounded-lg"
                                    onClick={(e) => { e.stopPropagation(); onNavigate(n.link); onClose(); }}
                                >
                                    <ExternalLink size={14} className="stroke-[2.5px]" />
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </CardContent>

            <Separator className="opacity-50" />
            <CardFooter className="p-4 bg-muted/20 flex flex-col items-center gap-2">
                {notifications.length > 0 && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase tracking-[0.2em] text-destructive hover:bg-destructive/10 gap-2"
                        onClick={clearAll}
                    >
                        <Trash2 size={12} strokeWidth={3} />
                        Alle löschen
                    </Button>
                )}
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-40">
                    Archiv wird periodisch bereinigt
                </p>
            </CardFooter>
        </Card>
    );
};

export default NotificationCenter;
