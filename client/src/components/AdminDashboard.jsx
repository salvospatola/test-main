import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Users, Shield, MessageSquare, History, Activity, TrendingUp, Lock, Zap,
    ChevronRight, ArrowUpRight, Bell, AlertCircle, CheckCircle2, MoreVertical, Mail,
    Calendar, Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNavigate } from 'react-router-dom';

const api = axios.create({ baseURL: '', withCredentials: true });

const StatCard = ({ title, value, subValue, icon, trend, trendValue, iconWrapClass = "bg-muted text-muted-foreground", iconClass = "" }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{title}</CardTitle>
            <div className={cn("p-2 rounded-md", iconWrapClass)}>
                {React.cloneElement(icon, { size: 16, className: iconClass })}
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <div className="flex items-center gap-1.5 mt-1">
                {trend && (
                    <span className={cn(
                        "text-[10px] font-bold flex items-center",
                        trend === 'up' ? "text-emerald-500" : "text-destructive"
                    )}>
                        {trend === 'up' ? <ArrowUpRight size={10} className="mr-0.5" /> : null}
                        {trendValue}
                    </span>
                )}
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{subValue}</p>
            </div>
        </CardContent>
    </Card>
);

const AdminDashboard = ({ canView }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        users: 0,
        roles: 0,
        activeBans: 0,
        botConnected: false,
        recentActivity: []
    });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [u, r, b, w, l] = await Promise.all([
                api.get('/api/users').catch(() => ({ data: [] })),
                api.get('/api/roles').catch(() => ({ data: [] })),
                api.get('/api/monitoring/bans').catch(() => ({ data: [] })),
                api.get('/api/whatsapp/status').catch(() => ({ data: { connected: false } })),
                api.get('/api/activity?limit=5').catch(() => ({ data: [] }))
            ]);

            setStats({
                users: u.data?.length || 0,
                roles: r.data?.length || 0,
                activeBans: b.data?.length || 0,
                botConnected: w.data?.connected || false,
                recentActivity: Array.isArray(l.data) ? l.data : (l.data?.logs || [])
            });
        } catch (e) {
            console.error("Dashboard Daten konnten nicht geladen werden");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const adminCards = [
        { 
            title: 'Benutzerverwaltung', 
            desc: 'Accounts, Berechtigungen und Profile steuern.', 
            icon: <Users className="text-blue-500" />, 
            path: '/admin/users', 
            key: 'USER_MGMT' 
        },
        { 
            title: 'Rollen & Rechte', 
            desc: 'Globale Berechtigungs-Matrix konfigurieren.', 
            icon: <Shield className="text-violet-500" />, 
            path: '/admin/roles', 
            key: 'ROLES' 
        },
        { 
            title: 'Automatisierungen', 
            desc: 'Aufgabenplanung und Hintergrund-Jobs.', 
            icon: <Zap className="text-amber-500" />, 
            path: '/admin/jobs', 
            key: 'BOT_CONTROL' 
        },
        { 
            title: 'WhatsApp Bot', 
            desc: 'Status, QR-Code und Bot-Aktivitäten.', 
            icon: <MessageSquare className="text-emerald-500" />, 
            path: '/admin/bot', 
            key: 'BOT_CONTROL' 
        },
        { 
            title: 'System Intelligence', 
            desc: 'Echtzeit-Überwachung, Traffic & Analytics.', 
            icon: <Activity className="text-orange-500" />, 
            path: '/admin/monitor', 
            key: 'ACTIVITY_LOGS' 
        },
        { 
            title: 'Security & Privacy', 
            desc: 'Sicherheits-Parameter und IP-Management.', 
            icon: <Lock className="text-rose-500" />, 
            path: '/admin/security', 
            key: 'USER_MGMT' 
        },
        {
            title: 'Email Versand',
            desc: 'Newsletter und gezielte Mails an Teams oder Positionen.',
            icon: <Mail className="text-sky-600" />,
            path: '/admin/email',
            key: 'USER_MGMT'
        },
        { 
            title: 'Team-Strukturen', 
            desc: 'Teams und Positionen organisieren.', 
            icon: <Users className="text-emerald-600" />, 
            path: '/admin/teams', 
            key: 'USER_MGMT' 
        },
        { 
            title: 'Globale Kategorien', 
            desc: 'Systemweite Kategorien verwalten.', 
            icon: <Shield className="text-amber-600" />, 
            path: '/admin/tags', 
            key: 'USER_MGMT' 
        },
        { 
            title: 'Audit Logs', 
            desc: 'Detaillierte System- und Aktivitäts-Protokolle.', 
            icon: <History className="text-zinc-500" />, 
            path: '/admin/activity', 
            key: 'ACTIVITY_LOGS' 
        }
    ];

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Benutzer"
                    value={stats.users}
                    subValue="Registrierte Accounts"
                    icon={<Users />}
                    trend="up"
                    trendValue="+2"
                    iconWrapClass="bg-[rgb(161,206,217)]/28"
                    iconClass="text-[rgb(52,93,108)]"
                />
                <StatCard
                    title="WhatsApp"
                    value={stats.botConnected ? 'Online' : 'Offline'}
                    subValue="Messenger Bridge"
                    icon={<Zap />}
                    iconWrapClass="bg-[rgb(173,235,179)]/32"
                    iconClass="text-[rgb(28,117,61)]"
                />
                <StatCard
                    title="Sicherheit"
                    value={stats.activeBans}
                    subValue="Aktive IP-Sperren"
                    icon={<Lock />}
                    iconWrapClass="bg-[rgb(237,132,91)]/24"
                    iconClass="text-[rgb(156,74,42)]"
                />
                <StatCard
                    title="Intelligence"
                    value="Stabil"
                    subValue="System Health"
                    icon={<Activity />}
                    iconWrapClass="bg-[rgb(198,171,224)]/30"
                    iconClass="text-[rgb(105,57,120)]"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Card className="xl:col-span-2 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold tracking-tight">System Module</CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Konfiguration & Kontrolle</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {adminCards.filter(card => canView(card.key)).map((card, idx) => (
                                <button 
                                    key={`${card.path}-${idx}`}
                                    onClick={() => navigate(card.path)}
                                    className="group text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/30 transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-lg bg-muted group-hover:bg-background transition-colors">
                                            {React.cloneElement(card.icon, { size: 20 })}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm tracking-tight">{card.title}</h4>
                                            <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">{card.desc}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <History size={16} /> Letzte Aktionen
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y border-t">
                            {stats.recentActivity.map((log, i) => (
                                <div key={log._id || i} className="px-6 py-4 flex items-start gap-4">
                                    <div className={cn(
                                        "mt-1 h-2 w-2 rounded-full shrink-0",
                                        log.severity === 'HIGH' ? "bg-destructive" : "bg-primary"
                                    )} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold leading-relaxed line-clamp-2">{log.message}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-normal">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.user?.username || 'System'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {stats.recentActivity.length === 0 && (
                                <div className="p-12 text-center text-xs font-medium text-muted-foreground ">Keine aktuellen Einträge.</div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-muted/10">
                            <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold uppercase tracking-normal" onClick={() => navigate('/admin/activity')}>
                                Alle Protokolle ansehen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;
