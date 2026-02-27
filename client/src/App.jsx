import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams, Link } from 'react-router-dom';
import {
    Trash2, Play, Plus, Clock, FileSpreadsheet, MessageSquare,
    Save, X, Settings, Calendar, Zap, Loader2, Users, User, Bell, Hand, Ban,
    Edit2, Download, Check, LogOut, LogIn, Shield, LayoutDashboard, Menu, UserCircle, History,
    Music, Mic2, Guitar, Drum, Wind, Home as HomeIcon, Image as ImageIcon, Link as LinkIcon,
    Monitor, Volume2, ArrowUp, Sliders, ListMusic, HandHelping, Lock, ChevronRight, ChevronLeft, UserPlus,
    Activity, Terminal, TrendingUp, Database, ShieldAlert, Wifi, ShieldCheck, Quote,
    ChevronDown, Info, Mail, Search, PanelLeft, Filter, ExternalLink, Send, CheckCircle2, RefreshCw, Piano, Tag, Camera, Copy, TriangleAlert
} from 'lucide-react';
import { cn, formatRoleLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Toaster, toast } from "sonner"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxList,
    ComboboxItem,
} from './components/ui/combobox';

import UserManagement from './components/UserManagement';
import RoleManagement from './components/RoleManagement';
import TagManagement from './components/TagManagement';
import TeamManagement from './components/TeamManagement';
import PlanSlotManagement from './components/PlanSlotManagement';
import ActivityLogs from './components/ActivityLogs';
import SystemLogs from './components/SystemLogs';
import CommunityWall from './components/CommunityWall';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import SecuritySettings from './components/SecuritySettings';
import EmailBroadcast from './components/EmailBroadcast';
import PhoneInput, { COUNTRY_CODES } from './components/PhoneInput';
import Imprint from './components/Imprint';
import Privacy from './components/Privacy';
import SystemMonitor from './components/SystemMonitor';
import SystemStats from './components/SystemStats';
import NotificationCenter from './components/NotificationCenter';
import AccessDenied from './components/AccessDenied';
import AdminDashboard from './components/AdminDashboard';
import BotJobModal, { JOB_TYPES } from './components/BotJobModal';
import { CardSkeleton } from './components/Skeletons';
import { DatePicker, TimePicker, DateTimePicker } from './components/ui/date-time-picker';
import { ComboboxMultiple } from './components/ui/combobox-multiple';
import { version } from '../../package.json';
import efgLogo from './assets/efg-cross-logo.svg';
import { io } from 'socket.io-client';

import Messenger from './components/Messenger';
import UserProfile from './components/UserProfile';
import SinglePostView from './components/SinglePostView';
import MyChannels from './components/MyChannels';
import MyTeams from './components/MyTeams';
import { DatePickerSimple } from './components/DatePickerSimple';

const api = axios.create({ baseURL: '', withCredentials: true });

// --- HELPER COMPONENTS ---

const ElegantCross = ({ size = 24, className = "" }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 2c-1.1 0-2 1.5-2 3.5V9H6c-2 0-3 .7-3 1.5S4 12 6 12h4v8.5c0 2 .9 3.5 2 3.5s2-1.5 2-3.5V12h4c2 0 3-.7 3-1.5S20 9 18 9h-4V5.5c0-2-.9-3.5-2-3.5z" />
    </svg>
);

const BIBLE_VERSES = [
    { text: "Denn Gott hat die Welt so sehr geliebt, dass er seinen einzigen Sohn gab, damit jeder, der an ihn glaubt, nicht verloren geht, sondern ewiges Leben hat.", ref: "Johannes 3,16" },
    { text: "Der HERR ist mein Hirte, mir wird nichts mangeln.", ref: "Psalm 23,1" },
    { text: "Seid aber untereinander freundlich und herzlich und vergebt einer dem anderen, wie auch Gott euch vergeben hat in Christus.", ref: "Epheser 4,32" },
    { text: "Alles, was ihr tut, geschehe in Liebe.", ref: "1. Korinther 16,14" },
    { text: "Gott ist unsere Zuversicht und Stärke, eine Hilfe in den großen Nöten, die uns getroffen haben.", ref: "Psalm 46,2" },
    { text: "Dein Wort ist meines Fußes Leuchte und ein Licht auf meinem Wege.", ref: "Psalm 119,105" },
    { text: "Der HERR segne dich und behüte dich.", ref: "4. Mose 6,24" }
];

const BibleVerse = () => {
    const [verse, setVerse] = useState(null);
    useEffect(() => {
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        setVerse(BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length]);
    }, []);

    if (!verse) return null;
    return (
        <Card className="bg-[rgb(161,206,217)] text-[#1f2a37] relative overflow-hidden mb-8 border-none shadow-lg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[rgb(161,206,217)]/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-60"></div>
            <CardHeader className="relative z-10 pb-2">
                <Quote className="text-[rgb(237,132,91)]/70 mb-2" size={20} />
                <CardTitle className="text-xl sm:text-2xl font-bold leading-tight tracking-tight">
                    {verse.text}
                </CardTitle>
            </CardHeader>
            <CardFooter className="relative z-10 pt-0">
                <Badge variant="outline" className="border-0 bg-[rgb(249,245,239)] text-[rgb(94,78,61)] font-medium">
                    {verse.ref}
                </Badge>
            </CardFooter>
        </Card>
    );
};

import { UserAvatar } from './components/UserAvatar';

const ROLE_ICONS = {
    'Predigt': <Shield size={18} />,
    'Leitung': <User size={18} />,
    'Klavier': <Piano size={18} />,
    'Gitarre': <Guitar size={18} />,
    'Bass': <Music size={18} />,
    'Schlagzeug': <Drum size={18} />,
    'Blockflöte': <Wind size={18} />,
    'Gesang1': <Mic2 size={18} />,
    'Gesang2': <Mic2 size={18} />,
    'TechnikPC': <Monitor size={18} />,
    'TechnikSound': <Sliders size={18} />,
    'Anbetungsstunde': <HandHelping size={18} />,
    'Organisator': <ListMusic size={18} />
};

const getRoleLabel = (roleKey) => {
    if (roleKey === 'Gesang1') return 'Gesang 1';
    if (roleKey === 'Gesang2') return 'Gesang 2';
    if (roleKey === 'TechnikPC') return 'Technik PC';
    if (roleKey === 'TechnikSound') return 'Technik Sound';
    if (roleKey === 'Anbetungsstunde') return 'Anbetung';
    if (roleKey === 'Organisator') return 'Musik-Orga';
    return roleKey;
};

const isIntegratedMahlfeierValue = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    return raw === 'integrierte mahlfeier' || raw === 'integrierte mahlfeier!';
};

const getAssignmentState = (value) => {
    const raw = String(value || '').trim();
    if (raw === '/') return 'blocked';
    if (!raw || raw === '-' || raw === '?') return 'open';
    return 'assigned';
};

const assignmentStateClasses = {
    open: 'border-l-[rgb(237,132,91)]',
    assigned: 'border-l-[rgb(92,163,114)]',
    blocked: 'border-l-[rgb(114,157,214)]'
};

const specialNoteClasses = 'bg-[rgb(224,198,242)] border-[rgb(123,73,171)] text-[rgb(72,31,110)]';

const parsePlanTime = (value) => {
    const raw = String(value || '');
    const match = raw.match(/(\d{1,2})[:.](\d{2})/);
    if (!match) return { hour: 10, minute: 30 };
    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour, minute };
};

const formatIcsDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
};

const escapeIcsText = (value) =>
    String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');

const parsePlanDate = (value) => {
    if (!value || typeof value !== 'string') return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const startOfWeek = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
};

const addDays = (date, amount) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + amount);
    return d;
};

const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const addYears = (date, amount) => new Date(date.getFullYear() + amount, date.getMonth(), 1);

const PlanCalendarView = ({ entries = [], mode, anchorDate, onModeChange, onAnchorDateChange, onOpenEntry }) => {
    const preparedEntries = useMemo(() => {
        return (entries || [])
            .map((entry) => ({ entry, parsedDate: parsePlanDate(entry?.Datum) }))
            .filter((item) => item.parsedDate)
            .sort((a, b) => a.parsedDate - b.parsedDate);
    }, [entries]);

    const entriesByDate = useMemo(() => {
        const map = new Map();
        preparedEntries.forEach(({ entry, parsedDate }) => {
            const key = formatDateKey(parsedDate);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(entry);
        });
        return map;
    }, [preparedEntries]);

    const rangeLabel = useMemo(() => {
        if (mode === 'today') {
            return anchorDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        }
        if (mode === 'week') {
            const start = startOfWeek(anchorDate);
            const end = addDays(start, 6);
            return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        }
        if (mode === 'month') {
            return anchorDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        }
        return `${anchorDate.getFullYear()}`;
    }, [mode, anchorDate]);

    const navigateRange = (direction) => {
        if (mode === 'today') onAnchorDateChange(addDays(anchorDate, direction));
        else if (mode === 'week') onAnchorDateChange(addDays(anchorDate, direction * 7));
        else if (mode === 'month') onAnchorDateChange(addMonths(anchorDate, direction));
        else onAnchorDateChange(addYears(anchorDate, direction));
    };

    const dayCards = useMemo(() => {
        if (mode === 'today') return [new Date(anchorDate)];
        if (mode === 'week') {
            const start = startOfWeek(anchorDate);
            return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
        }
        return [];
    }, [mode, anchorDate]);

    const monthGrid = useMemo(() => {
        if (mode !== 'month') return [];
        const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
        const start = startOfWeek(firstDay);
        return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
    }, [mode, anchorDate]);

    const monthsOfYear = useMemo(() => {
        if (mode !== 'year') return [];
        return Array.from({ length: 12 }, (_, monthIndex) => {
            const monthDate = new Date(anchorDate.getFullYear(), monthIndex, 1);
            const monthEntries = preparedEntries.filter(({ parsedDate }) => (
                parsedDate.getFullYear() === monthDate.getFullYear() && parsedDate.getMonth() === monthIndex
            ));
            return { monthDate, monthEntries };
        });
    }, [mode, anchorDate, preparedEntries]);

    return (
        <Card className="border-primary/15 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={mode === 'today' ? "default" : "outline"} onClick={() => onModeChange('today')}>Heute</Button>
                        <Button size="sm" variant={mode === 'week' ? "default" : "outline"} onClick={() => onModeChange('week')}>Woche</Button>
                        <Button size="sm" variant={mode === 'month' ? "default" : "outline"} onClick={() => onModeChange('month')}>Monat</Button>
                        <Button size="sm" variant={mode === 'year' ? "default" : "outline"} onClick={() => onModeChange('year')}>Jahr</Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateRange(-1)}><ChevronLeft size={14} /></Button>
                        <Button size="sm" variant="outline" onClick={() => onAnchorDateChange(startOfToday())}>Heute</Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigateRange(1)}><ChevronRight size={14} /></Button>
                    </div>
                </div>
                <CardDescription className="font-semibold text-foreground">{rangeLabel}</CardDescription>
            </CardHeader>
            <CardContent>
                {(mode === 'today' || mode === 'week') && (
                    <div className="overflow-x-auto pb-2">
                        <div className="grid grid-flow-col auto-cols-[minmax(190px,1fr)] gap-3 sm:grid-cols-7 sm:auto-cols-fr">
                            {dayCards.map((day) => {
                                const key = formatDateKey(day);
                                const dayEntries = entriesByDate.get(key) || [];
                                const isToday = key === formatDateKey(startOfToday());
                                return (
                                    <div key={key} className={cn("rounded-lg border p-3 min-h-[180px]", isToday && "border-primary/60 bg-primary/5")}>
                                        <p className="text-[11px] uppercase text-muted-foreground font-bold tracking-wide">
                                            {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                                        </p>
                                        <p className="text-sm font-bold mb-2">{day.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</p>
                                        <div className="space-y-2">
                                            {dayEntries.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">Keine Termine</p>
                                            ) : dayEntries.map((entry) => (
                                                <button
                                                    key={String(entry._id || entry.id)}
                                                    type="button"
                                                    onClick={() => onOpenEntry(entry)}
                                                    className="w-full text-left rounded-md border bg-background px-2 py-1.5 hover:bg-muted/40 transition-colors"
                                                >
                                                    <p className="text-[11px] font-bold truncate">{entry.Typ || 'Gottesdienst'}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{entry.Uhrzeit || '10:30 Uhr'}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {mode === 'month' && (
                    <div className="overflow-x-auto pb-2">
                        <div className="grid grid-cols-7 gap-1 min-w-[700px]">
                            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label) => (
                                <div key={label} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2 py-1">{label}</div>
                            ))}
                            {monthGrid.map((day) => {
                                const key = formatDateKey(day);
                                const dayEntries = entriesByDate.get(key) || [];
                                const inMonth = day.getMonth() === anchorDate.getMonth();
                                const isToday = key === formatDateKey(startOfToday());
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={cn(
                                            "min-h-[88px] rounded-md border p-1.5 text-left align-top transition-colors",
                                            inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                                            isToday && "border-primary/60"
                                        )}
                                        onClick={() => dayEntries[0] && onOpenEntry(dayEntries[0])}
                                    >
                                        <p className="text-[10px] font-bold">{day.getDate()}</p>
                                        <div className="mt-1 space-y-1">
                                            {dayEntries.slice(0, 2).map((entry) => (
                                                <Badge key={String(entry._id || entry.id)} variant="secondary" className="w-full justify-start text-[9px] px-1 py-0 truncate">
                                                    {entry.Typ || 'Termin'}
                                                </Badge>
                                            ))}
                                            {dayEntries.length > 2 && (
                                                <p className="text-[9px] text-muted-foreground">+{dayEntries.length - 2} mehr</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {mode === 'year' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {monthsOfYear.map(({ monthDate, monthEntries }) => (
                            <Card key={monthDate.toISOString()} className="border-primary/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">{monthDate.toLocaleDateString('de-DE', { month: 'long' })}</CardTitle>
                                    <CardDescription>{monthEntries.length} Termin{monthEntries.length === 1 ? '' : 'e'}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {monthEntries.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">Keine Termine</p>
                                    ) : (
                                        <>
                                            {monthEntries.slice(0, 4).map(({ entry, parsedDate }) => (
                                                <button
                                                    key={String(entry._id || entry.id)}
                                                    type="button"
                                                    onClick={() => onOpenEntry(entry)}
                                                    className="w-full text-left rounded-md border px-2 py-1.5 hover:bg-muted/40"
                                                >
                                                    <p className="text-[11px] font-bold truncate">{parsedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - {entry.Typ || 'Termin'}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{entry.Uhrzeit || '10:30 Uhr'}</p>
                                                </button>
                                            ))}
                                            {monthEntries.length > 4 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full h-8 text-xs"
                                                    onClick={() => {
                                                        onModeChange('month');
                                                        onAnchorDateChange(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
                                                    }}
                                                >
                                                    Monat öffnen (+{monthEntries.length - 4})
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const BotSettings = ({ status, fetchBotData, canEdit, showDetails }) => {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pairingAction, setPairingAction] = useState('');

    const fetchBotInfo = async () => {
        setRefreshing(true);
        try {
            const [l, s] = await Promise.all([
                api.get('/api/whatsapp/logs'),
                api.get('/api/whatsapp/stats')
            ]);
            setLogs(l.data);
            setStats(s.data);
        } catch (e) { console.error("Failed to fetch bot info", e); }
        finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBotInfo();
        const interval = setInterval(fetchBotInfo, 10000);
        return () => clearInterval(interval);
    }, []);

    const handlePairingAction = async (action) => {
        if (!canEdit('BOT_CONTROL')) return;
        setPairingAction(action);
        try {
            if (action === 'start') await api.post('/api/whatsapp/start-pairing');
            if (action === 'stop') await api.post('/api/whatsapp/stop-pairing');
            await fetchBotData();
            await fetchBotInfo();
            toast.success(action === 'start' ? 'Pairing gestartet' : 'Pairing gestoppt');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Aktion fehlgeschlagen');
        } finally {
            setPairingAction('');
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-4 text-primary">
                        <MessageSquare className="text-primary stroke-[2.5px]" size={32} />
                        WhatsApp Bot
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Status, Verbindung und System-Aktivitäten.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 shadow-xl border-primary/10 overflow-hidden h-fit">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                            <Zap size={16} className="text-primary stroke-[2.5px]" /> Bot Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className={cn(
                            "p-8 rounded-[2rem] border-2 flex flex-col items-center text-center gap-6 transition-all duration-500 shadow-inner",
                            status.connected ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5" : "bg-destructive/5 border-destructive/20 shadow-destructive/5"
                        )}>
                            <div className={cn(
                                "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-transform hover:scale-110 duration-300",
                                status.connected ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/20" : "bg-destructive/20 text-destructive border border-destructive/20"
                            )}>
                                <MessageSquare size={32} className="stroke-[2.5px]" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold uppercase tracking-normal text-sm">System-Verbindung</p>
                                <Badge variant={status.connected ? "success" : "destructive"} className="uppercase font-bold tracking-widest text-[10px]">
                                    {status.connected ? 'Online' : 'Offline'}
                                </Badge>
                                {status?.pairingMode && (
                                    <div className="pt-1">
                                        <Badge variant="outline" className="uppercase font-bold tracking-widest text-[9px]">
                                            Pairing: {String(status.pairingMode).toUpperCase()}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            {status.connected && canEdit('BOT_CONTROL') && (
                                <Button variant="destructive" className="w-full" onClick={async () => { await api.post('/api/whatsapp/logout'); fetchBotData(); }}>
                                    Session beenden
                                </Button>
                            )}
                            {!status.connected && canEdit('BOT_CONTROL') && (
                                <div className="w-full grid grid-cols-1 gap-2">
                                    <Button
                                        variant="default"
                                        className="w-full"
                                        loading={pairingAction === 'start'}
                                        onClick={() => handlePairingAction('start')}
                                        disabled={pairingAction !== '' || status.initializing}
                                    >
                                        {pairingAction !== 'start' && <Play size={14} className="mr-2" />}
                                        {pairingAction === 'start' ? 'Startet...' : 'Pairing starten'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        loading={pairingAction === 'stop'}
                                        onClick={() => handlePairingAction('stop')}
                                        disabled={pairingAction !== ''}
                                    >
                                        {pairingAction !== 'stop' && <X size={14} className="mr-2" />}
                                        {pairingAction === 'stop' ? 'Stoppt...' : 'Pairing stoppen'}
                                    </Button>
                                    {typeof status?.reconnectAttempts === 'number' && (
                                        <p className="text-[10px] font-medium text-muted-foreground">
                                            Reconnect: {status.reconnectAttempts}/{status.maxReconnectAttempts || 0}
                                        </p>
                                    )}
                                    {status?.health?.outageActive && (
                                        <p className="text-[10px] font-medium text-destructive">
                                            Offline seit: {status.health.outageSince ? new Date(status.health.outageSince).toLocaleString('de-DE') : '-'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {!status.connected && status.qr && (
                            <div className="mt-8 flex flex-col items-center p-6 bg-white rounded-2xl border-2 border-primary/10 shadow-lg animate-in zoom-in-95">
                                <img src={status.qr} className="w-48 h-48" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-4">Bitte mit WhatsApp scannen</p>
                            </div>
                        )}

                        {!status.connected && !status.qr && status.initializing && (
                            <div className="mt-8 py-12 text-center animate-pulse">
                                <Loader2 className="animate-spin mx-auto text-primary mb-4" size={32} />
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Initialisiere...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="shadow-md border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground">Stabilität</CardTitle>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><TrendingUp size={16} /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.totalLogs || 0} Events</div>
                                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Aufgezeichnete Aktivitäten</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-md border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground">Fehlerrate</CardTitle>
                                <div className="p-2 rounded-lg bg-destructive/10 text-destructive"><ShieldAlert size={16} /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">{stats?.errors || 0} Fehler</div>
                                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">{stats?.disconnects || 0} Abbrüche gesamt</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-md border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground">Health</CardTitle>
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    status?.health?.outageActive ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"
                                )}>
                                    <Activity size={16} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={cn("text-2xl font-bold", status?.health?.outageActive ? "text-destructive" : "text-emerald-600")}>
                                    {status?.health?.outageActive ? "OFFLINE" : "OK"}
                                </div>
                                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">
                                    Alert-Mail: {status?.health?.outageAlertSent ? 'Versendet' : 'Noch nicht'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-xl border-primary/5 overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between px-8 py-6">
                            <div>
                                <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                                    <History size={16} className="text-primary stroke-[2.5px]" /> Bot Aktivitäten
                                </CardTitle>
                                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Letzte 100 System-Ereignisse</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase disabled:opacity-50" onClick={fetchBotInfo} disabled={refreshing}>
                                {refreshing ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />} 
                                {refreshing ? 'Lädt...' : 'Aktualisieren'}
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                <Table>
                                    <TableHeader className="bg-muted/10 sticky top-0 z-10 backdrop-blur-md">
                                        <TableRow>
                                            <TableHead className="w-[150px] pl-8 text-[10px] font-bold uppercase">Zeitpunkt</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase">Ereignis</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase">Nachricht</TableHead>
                                            <TableHead className="text-right pr-8 text-[10px] font-bold uppercase">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold uppercase text-[10px] opacity-50">Keine Aktivitäten aufgezeichnet.</TableCell></TableRow>
                                        ) : logs.map((log, lIdx) => (
                                            <TableRow key={log._id || `bot-log-${lIdx}`} className="hover:bg-muted/5 transition-colors border-b">
                                                <TableCell className="pl-8 py-4 text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString('de-DE')}
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'warning' : 'secondary'} className="text-[9px] font-bold uppercase px-2 h-5">
                                                        {log.event?.toUpperCase() || 'INFO'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 font-medium text-xs max-w-xs truncate">{log.message}</TableCell>
                                                <TableCell className="text-right pr-8 py-4">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all active:scale-90" onClick={() => showDetails(`Event Details: ${log.event}`, log.details)}>
                                                        <Search size={16} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const formatCron = (cron) => {
    if (!cron) return 'Einmalig';
    if (cron === '0 * * * *') return 'Stündlich';
    if (cron === '*/5 * * * *') return 'Alle 5 Minuten';
    if (cron.startsWith('*/')) {
        const interval = cron.split(' ')[0].replace('*/', '');
        return `Alle ${interval} Minuten`;
    }
    const [min, hr, d1, d2, wd] = cron.split(' ');
    const weekdayNames = { '0': 'Sonntag', '1': 'Montag', '2': 'Dienstag', '3': 'Mittwoch', '4': 'Donnerstag', '5': 'Freitag', '6': 'Samstag' };
    if (wd === '*' && d1 === '*' && d2 === '*') return `Täglich um ${hr}:${min}`;
    if (wd !== '*' && d1 === '*' && d2 === '*') {
        if (wd.includes(',')) {
            const labels = wd
                .split(',')
                .map((day) => weekdayNames[day] || day)
                .join(', ');
            return `${labels} um ${hr}:${min}`;
        }
        return `Jeden ${weekdayNames[wd] || wd} um ${hr}:${min}`;
    }
    return cron;
};

const JobsControl = ({ jobs, recentJobLogs, fetchBotData, canEdit, setShowModal, setJobForm, showConfirm, showPrompt, showToast, groups, logPage, setLogPage }) => {
    const [runningJobId, setRunningJobId] = useState(null);

    const handleRunJob = async (id) => {
        showConfirm("Aufgabe jetzt ausführen?", "Möchtest du diese Aufgabe wirklich sofort manuell starten?", async () => {
            setRunningJobId(id);
            try {
                await api.post(`/api/jobs/${id}/run`);
                showToast("Job wurde gestartet!", "success");
                fetchBotData(logPage);
            } catch (e) {
                showToast("Fehler beim Starten des Jobs", "error");
            } finally {
                setRunningJobId(null);
            }
        }, "info");
    };

    const handleDebugRun = (job) => {
        const id = job._id || job.id;
        showPrompt(
            "Debug-Lauf starten",
            "Gib die Zielnummer oder Gruppen-ID ein, an die der Job zur Prüfung sofort gesendet werden soll.",
            "z.B. 49123456789 oder 1203...@g.us",
            job.params?.targetJid || job.params?.number || '',
            async (target) => {
                const normalizedTarget = String(target || '').trim();
                if (!normalizedTarget) {
                    showToast("Debug-Ziel darf nicht leer sein.", "error");
                    return;
                }
                setRunningJobId(`debug-${id}`);
                try {
                    await api.post(`/api/jobs/${id}/run-debug`, { targetJid: normalizedTarget });
                    showToast("Debug-Lauf gestartet.", "success");
                    fetchBotData(logPage);
                } catch (e) {
                    showToast(e.response?.data?.error || "Fehler beim Debug-Lauf", "error");
                } finally {
                    setRunningJobId(null);
                }
            }
        );
    };

    const logs = recentJobLogs.logs || [];
    const totalPages = recentJobLogs.pages || 0;

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-4 text-primary">
                        <Zap className="text-primary stroke-[2.5px]" size={32} />
                        Automatisierungen
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Geplante Hintergrundaufgaben und Nachrichten-Automationen.</p>
                </div>
                {canEdit('BOT_CONTROL') && (
                    <Button onClick={() => {
                        setJobForm({ name: '', type: 'PLAN_UPDATE', mode: 'recurring', weekdays: ['*'], hour: '10', minute: '00', params: { ...(JOB_TYPES.PLAN_UPDATE?.defaults || {}), targetJid: '' } });
                        setShowModal(true);
                    }}>
                        <Plus size={20} /> Neue Aufgabe planen
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="shadow-xl border-primary/5 flex flex-col">
                    <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                            <History size={16} className="text-primary stroke-[2.5px]" /> Letzte Aktivitäten
                        </CardTitle>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 rounded-md" 
                                    disabled={logPage <= 1}
                                    onClick={() => setLogPage(prev => prev - 1)}
                                >
                                    <ChevronLeft size={14} />
                                </Button>
                                <span className="text-[10px] font-bold text-muted-foreground w-8 text-center">{logPage} / {totalPages}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 rounded-md" 
                                    disabled={logPage >= totalPages}
                                    onClick={() => setLogPage(prev => prev + 1)}
                                >
                                    <ChevronRight size={14} />
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="p-6 flex-1">
                        <div className="space-y-4">
                            {logs.length === 0 && (
                                <p className="text-muted-foreground text-xs text-center py-12 font-bold uppercase tracking-widest opacity-30">Keine Aktivitäten.</p>
                            )}
                            {logs.map((l, idx) => {
                                const job = Array.isArray(jobs) ? jobs.find(j => (j._id || j.id) === l.jobId) : null;
                                return (
                                    <div key={l._id || `log-${idx}`} className="flex items-center gap-4 text-xs border-b last:border-0 pb-3 group/log">
                                        <div className={cn(
                                            "h-2 w-2 rounded-full shrink-0",
                                            l.status === 'SUCCESS' || l.status === 'UPDATE' ? 'bg-emerald-500' : 'bg-destructive'
                                        )} />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-muted-foreground font-bold whitespace-nowrap">{new Date(l.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <Badge variant={l.status === 'SUCCESS' || l.status === 'UPDATE' ? 'success' : 'destructive'} className="h-4 px-1.5 text-[8px] font-black uppercase">{l.status}</Badge>
                                                    <span className="font-bold truncate text-primary/80">{job?.name || 'System'}</span>
                                                </div>
                                                <span className="text-[9px] text-muted-foreground font-medium opacity-50 ml-2">{new Date(l.createdAt).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}</span>
                                            </div>
                                            <span className="font-medium truncate text-[10px] text-muted-foreground mt-0.5">{l.message || (l.status === 'SUCCESS' ? 'Erfolgreich ausgeführt' : 'Fehler aufgetreten')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xl border-primary/5">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                            <Clock size={16} className="text-primary stroke-[2.5px]" /> Nächste Läufe
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            {(!Array.isArray(jobs) || jobs.filter(j => j.active && j.nextRun).length === 0) && (
                                <p className="text-muted-foreground text-xs text-center py-12 font-bold uppercase tracking-widest opacity-30">Keine Aufgaben geplant.</p>
                            )}
                            {Array.isArray(jobs) && jobs.filter(j => j.active && j.nextRun).sort((a,b) => new Date(a.nextRun) - new Date(b.nextRun)).slice(0, 8).map((j, idx) => (
                                <div key={j._id || j.id || `next-${idx}`} className="flex justify-between items-center text-xs border-b last:border-0 pb-3">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">{JOB_TYPES[j.type]?.icon || <Settings size={14} />}</div>
                                        <span className="font-bold truncate">{j.name}</span>
                                    </div>
                                    <span className="text-primary font-black ml-2 whitespace-nowrap">{new Date(j.nextRun).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {Array.isArray(jobs) && jobs.map((job, idx) => (
                    <Card key={job._id || job.id || `job-${idx}`} className="relative group overflow-hidden border-primary/5 hover:border-primary/20 transition-all duration-300 shadow-lg">
                        <CardContent className="p-6 flex flex-col gap-4 h-full">
                            <div className="flex items-start justify-between">
                                <div className="p-4 rounded-2xl bg-muted text-primary border shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                                    {JOB_TYPES[job.type]?.icon || <Settings size={24} />}
                                </div>
                                <div className={cn("w-2.5 h-2.5 rounded-full shadow-lg", job.active ? "bg-emerald-500 animate-pulse shadow-emerald-500/50" : "bg-muted shadow-inner")} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg tracking-tight truncate">{job.name}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <div className="flex items-center gap-1">
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase px-2 h-5 border-primary/20 text-primary bg-primary/5">{JOB_TYPES[job.type]?.label || 'Unbekannt'}</Badge>
                                        {JOB_TYPES[job.type]?.description && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button type="button" className="text-muted-foreground hover:text-foreground">
                                                            <Info size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs text-xs">
                                                        <p className="font-semibold">{JOB_TYPES[job.type]?.description}</p>
                                                        {Array.isArray(JOB_TYPES[job.type]?.variables) && JOB_TYPES[job.type].variables.length > 0 && (
                                                            <p className="mt-1">Variablen: {JOB_TYPES[job.type].variables.map(v => `$(${v})`).join(', ')}</p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{formatCron(job.cronExpression)}</p>
                                </div>

                                {job.params && (
                                    <div className="mt-4 p-3 bg-muted/20 rounded-xl border border-dashed flex flex-col gap-2">
                                        {(job.params.targetJid || job.params.number) && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                                                {job.params.targetJid?.includes('@g.us') ? (
                                                    <><Users size={12} className="text-primary" /> {groups.find(g => (g._id || g.id) === job.params.targetJid)?.subject || 'Gruppe'}</>
                                                ) : (
                                                    <><User size={12} className="text-primary" /> {job.params.targetJid || job.params.number}</>
                                                )}
                                            </div>
                                        )}
                                        {job.params.message && (
                                            <div className="flex items-start gap-2 text-[10px] font-medium text-muted-foreground italic line-clamp-1">
                                                <MessageSquare size={12} className="shrink-0" /> "{job.params.message}"
                                            </div>
                                        )}
                                        {job.type === 'CHECK_REMINDERS' && Array.isArray(job.params.categories) && job.params.categories.length > 0 && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                                <Tag size={12} className="text-primary shrink-0" />
                                                <span className="truncate">Kategorien: {job.params.categories.join(', ')}</span>
                                            </div>
                                        )}
                                        {job.type === 'SYSTEM_STATS' && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                                                <Activity size={12} className="text-primary" /> Dashboard Metriken
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="mt-6 pt-4 border-t border-dashed flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Geplant für</p>
                                        <p className="text-xs font-black text-primary">
                                            {job.nextRun ? new Date(job.nextRun).toLocaleString('de-DE', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '-'}
                                        </p>
                                    </div>
                                    
                                    {canEdit('BOT_CONTROL') && (
                                        <div className="flex gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-emerald-500"
                                                onClick={() => handleRunJob(job._id || job.id)}
                                                disabled={runningJobId === (job._id || job.id)}
                                                title="Jetzt sofort ausführen"
                                            >
                                                {runningJobId === (job._id || job.id) ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-primary"
                                                title="Debug-Lauf an Zielnummer"
                                                disabled={runningJobId === `debug-${job._id || job.id}`}
                                                onClick={() => handleDebugRun(job)}
                                            >
                                                {runningJobId === `debug-${job._id || job.id}` ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => { 
                                                const isRecurring = !!job.cronExpression; 
                                                const [min, hr, d1, d2, wd] = isRecurring ? job.cronExpression.split(' ') : ['00', '10', '*', '*', '*']; 
                                                const parsedWeekdays = !wd || wd === '*' ? ['*'] : wd.split(',');
                                                setJobForm({ id: job._id || job.id, name: job.name, type: job.type, mode: isRecurring ? 'recurring' : 'once', weekdays: parsedWeekdays, hour: hr || '10', minute: min || '00', executionTime: job.executionTime ? new Date(job.executionTime).toISOString().slice(0, 16) : '', params: job.params || {} }); 
                                                setShowModal(true); 
                                            }}>
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { 
                                                showConfirm("Aufgabe löschen", `"${job.name}" wirklich entfernen?`, async () => { 
                                                    await api.delete(`/api/jobs/${job._id || job.id}`); 
                                                    fetchBotData(); 
                                                    showToast("Gelöscht", "success"); 
                                                }); 
                                            }}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

function PersonSelect({ label, value, onChange, users = [], options, icon, onBlock }) {
    const isBlocked = value === '/';

    const items = useMemo(() => {
        if (Array.isArray(options) && options.length > 0) return options;
        return users.map(u => ({
            label: `${u.firstName} ${u.lastName}`.trim() || u.username,
            value: u.username
        })).sort((a, b) => a.label.localeCompare(b.label, 'de'));
    }, [options, users]);

    const selectedItem = items.find(i => i.value === value);
    const selectedLabel = selectedItem ? selectedItem.label : (value === '/' || value === '?' || value === '-' || !value ? value : `⚠️ ${value}`);

    return (
        <Field className="grid gap-2">
            <div className="flex justify-between items-center px-1">
                <FieldLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {icon} {label}
                </FieldLabel>
                <div className="flex items-center gap-1">
                    {value && !isBlocked && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                            onClick={() => onChange('')}
                            title="Austragen"
                        >
                            <X size={12} />
                        </Button>
                    )}
                    {onBlock && (
                        <Button 
                            type="button" 
                            variant={isBlocked ? "destructive" : "ghost"}
                            size="icon"
                            className="h-6 w-6 rounded-md"
                            onClick={() => onBlock(isBlocked ? '' : '/')} 
                            title={isBlocked ? "Aktivieren" : "Deaktivieren / Blockieren"}
                        >
                            <Ban size={12} />
                        </Button>
                    )}
                </div>
            </div>
            <div className="relative">
                {isBlocked ? (
                    <div className="h-10 flex items-center px-3 rounded-md border border-input bg-destructive/5 text-destructive/50 line-through font-medium text-sm">
                        Entfällt
                    </div>
                ) : (
                    <Combobox
                        items={items}
                        value={value}
                        onValueChange={onChange}
                    >
                        <ComboboxInput placeholder={selectedLabel || "Person wählen..."} />
                        <ComboboxContent>
                            <ComboboxEmpty>Niemand gefunden.</ComboboxEmpty>
                            <ComboboxList>
                                {(item) => (
                                    <ComboboxItem key={item.value} value={item.value}>
                                        {item.label}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                )}
            </div>
        </Field>
    );
}

// --- PAGES / SECTIONS ---

const QuickAssign = ({ currentUser, requestLogin, showToast }) => {
    const { token, planId } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [savingRoleKey, setSavingRoleKey] = useState('');
    const [savingProbe, setSavingProbe] = useState(false);
    const [savingSongs, setSavingSongs] = useState(false);
    const [probeDraft, setProbeDraft] = useState('');
    const [probePollDraft, setProbePollDraft] = useState('');
    const [songsDraft, setSongsDraft] = useState([]);
    const [calendarTarget, setCalendarTarget] = useState('service');
    const navigate = useNavigate();
    const planIdMode = Boolean(planId);
    const assignInfoEndpoint = planIdMode ? `/api/assign/info/plan/${planId}` : `/api/assign/info/${token}`;
    const assignActionEndpoint = planIdMode ? `/api/assign/plan/${planId}` : `/api/assign/${token}`;
    const assignPresenceEndpoint = planIdMode ? `/api/assign/presence/plan/${planId}` : `/api/assign/presence/${token}`;
    const loginRedirectTarget = planIdMode ? `/dienstplaner/detail/${planId}` : `/assign/${token}`;
    const mapSongsForDraft = (rawSongs) => (
        (Array.isArray(rawSongs) ? rawSongs : [])
            .map((song) => ({
                number: String(song?.number || '').trim(),
                title: String(song?.title || '').trim(),
                sourceUrl: String(song?.sourceUrl || '').trim()
            }))
    );
    const sanitizeSongsForSave = (rawSongs) => (
        mapSongsForDraft(rawSongs)
            .filter((song) => song.number || song.title)
            .slice(0, 20)
    );

    const fetchInfo = async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(assignInfoEndpoint);
            setData(res.data);
            const probeIso = res.data?.plan?.Probe ? new Date(res.data.plan.Probe).toISOString().slice(0, 16) : '';
            setProbeDraft(probeIso);
            setProbePollDraft((res.data?.plan?.probePollOptions || []).join('\n'));
            setSongsDraft(mapSongsForDraft(res.data?.plan?.songs));
        } catch (e) {
            setError(e.response?.data?.error || "Link ungültig");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInfo();
    }, [currentUser, assignInfoEndpoint]);

    useEffect(() => {
        if (!data?.plan?.Probe && calendarTarget === 'probe') {
            setCalendarTarget('service');
        }
    }, [data?.plan?.Probe, calendarTarget]);

    useEffect(() => {
        if (!currentUser) return undefined;
        let stopped = false;
        const beat = async () => {
            try {
                const res = await api.post(assignPresenceEndpoint);
                if (!stopped && res.data?.viewers) {
                    setData((prev) => (prev ? { ...prev, viewers: res.data.viewers } : prev));
                }
            } catch (_) {}
        };
        beat();
        const interval = setInterval(beat, 15000);
        return () => {
            stopped = true;
            clearInterval(interval);
        };
    }, [currentUser, assignPresenceEndpoint]);

    const preserveScroll = (windowY, mainY) => {
        requestAnimationFrame(() => {
            if (typeof windowY === 'number') window.scrollTo({ top: windowY, behavior: 'auto' });
            const mainEl = document.querySelector('main');
            if (mainEl && typeof mainY === 'number') mainEl.scrollTop = mainY;
        });
    };

    const handleAssign = async (roleKey) => {
        setSavingRoleKey(roleKey);
        const windowY = window.scrollY;
        const mainY = document.querySelector('main')?.scrollTop ?? 0;
        try {
            await api.post(assignActionEndpoint, { roleKey });
            if (showToast) showToast(`Du bist jetzt für ${roleKey} eingetragen.`, 'success');
            await fetchInfo();
            preserveScroll(windowY, mainY);
            setTimeout(() => preserveScroll(windowY, mainY), 60);
        } catch (e) {
            setError(e.response?.data?.error || "Fehler");
        } finally {
            setSavingRoleKey('');
        }
    };

    const handleUnassign = async (roleKey) => {
        setSavingRoleKey(roleKey);
        const windowY = window.scrollY;
        const mainY = document.querySelector('main')?.scrollTop ?? 0;
        try {
            await api.post(assignActionEndpoint, { roleKey, action: 'unassign' });
            if (showToast) showToast(`Eintrag für ${roleKey} wurde entfernt.`, 'success');
            await fetchInfo();
            preserveScroll(windowY, mainY);
            setTimeout(() => preserveScroll(windowY, mainY), 60);
        } catch (e) {
            setError(e.response?.data?.error || "Fehler");
        } finally {
            setSavingRoleKey('');
        }
    };

    const saveProbeSettings = async () => {
        if (!data?.plan?._id) return;
        setSavingProbe(true);
        try {
            const options = probePollDraft
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
            await api.patch(`/api/plan/${data.plan._id}/probe-settings`, {
                probe: probeDraft ? new Date(probeDraft).toISOString() : '',
                probePollOptions: options
            });
            if (showToast) showToast('Probeinfos gespeichert.', 'success');
            await fetchInfo();
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || 'Probeinfos konnten nicht gespeichert werden.', 'error');
        } finally {
            setSavingProbe(false);
        }
    };

    const updateSongDraftAt = (index, field, value) => {
        setSongsDraft((prev) => {
            const songs = mapSongsForDraft(prev);
            if (!songs[index]) songs[index] = { number: '', title: '', sourceUrl: '' };
            songs[index] = { ...songs[index], [field]: value };
            return songs;
        });
    };

    const addSongDraft = () => {
        setSongsDraft((prev) => [...mapSongsForDraft(prev), { number: '', title: '', sourceUrl: '' }]);
    };

    const removeSongDraftAt = (index) => {
        setSongsDraft((prev) => mapSongsForDraft(prev).filter((_, i) => i !== index));
    };

    const saveSongsSettings = async () => {
        if (!data?.plan?._id) return;
        setSavingSongs(true);
        try {
            await api.patch(`/api/plan/${data.plan._id}/songs`, {
                songs: sanitizeSongsForSave(songsDraft)
            });
            if (showToast) showToast('Lieder gespeichert.', 'success');
            await fetchInfo();
        } catch (e) {
            if (showToast) showToast(e.response?.data?.error || 'Lieder konnten nicht gespeichert werden.', 'error');
        } finally {
            setSavingSongs(false);
        }
    };

    if (!currentUser) return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in w-full max-w-[100vw] overflow-hidden">
            <div className="w-20 h-20 bg-[rgb(237,132,91)]/12 text-[rgb(237,132,91)] rounded-full flex items-center justify-center mb-6 border border-[rgb(237,132,91)]/30">
                <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Anmeldung erforderlich</h1>
            <p className="text-muted-foreground max-w-xs mb-8 font-medium">
                Bitte melde dich an, um diese Event-Ansicht zu öffnen.
            </p>
            <Button size="lg" className="px-8 font-bold" onClick={() => requestLogin(loginRedirectTarget)}>
                JETZT ANMELDEN
            </Button>
        </div>
    );

    if (loading) return <div className="h-[80vh] flex items-center justify-center w-full"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    if (error) return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in w-full max-w-[100vw] overflow-hidden">
            <div className="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-8 border border-destructive/20"><Clock size={48} /></div>
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-destructive">Hinweis</h1>
            <p className="text-muted-foreground max-w-sm mb-8 font-medium">{error}</p>
            <Button variant="outline" size="lg" className="px-8 h-12 font-semibold gap-2" onClick={() => navigate('/dienstplaner')}>
                <Calendar size={20} /> ZUM DIENSTPLAN
            </Button>
        </div>
    );

    if (!data || !data.plan) return <div className="h-[80vh] flex items-center justify-center w-full"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    const dateStr = data.plan?.Datum ? data.plan.Datum.split('-').reverse().join('.') : 'unbekannt';
    const detailTypeRaw = String(data.plan?.Typ || '').trim();
    const detailType = detailTypeRaw.toLowerCase() === 'sonntag' ? 'Gottesdienst' : (detailTypeRaw || 'Gottesdienst');
    const detailTime = data.plan?.Uhrzeit || '10:30 Uhr';
    const isMusicOrga = String(data.plan?.Organisator || '').trim() === String(currentUser?.username || '').trim();
    const permissionKeys = Array.isArray(currentUser?.permissionKeys) ? currentUser.permissionKeys : [];
    const hasPlanEditPermission = permissionKeys.includes('admin_access')
        || permissionKeys.includes('edit_music_plan')
        || String(currentUser?.role || '').toUpperCase() === 'ADMIN';
    const slots = Array.isArray(data.slots) ? data.slots : [];
    const currentUsername = String(currentUser?.username || '').trim();
    const isAssignedInPlan = slots.some((slot) => String(slot.assignedUsername || '').trim() === currentUsername);
    const canManagePlanMeta = isMusicOrga || isAssignedInPlan || hasPlanEditPermission;
    const liveViewers = Array.isArray(data.viewers) ? data.viewers : [];
    const compactViewers = liveViewers.slice(0, 5);
    const viewerLabel = (viewer) => ((viewer?.firstName || viewer?.lastName)
        ? `${viewer.firstName || ''} ${viewer.lastName || ''}`.trim()
        : String(viewer?.username || 'Unbekannt'));
    const liveViewerNames = liveViewers.map((viewer) => viewerLabel(viewer));
    const hiddenViewerCount = Math.max(0, liveViewers.length - compactViewers.length);
    const openSlotsCount = slots.filter((slot) => slot.open && !slot.blocked).length;
    const assignedSlotsCount = slots.filter((slot) => !slot.open && !slot.blocked).length;
    const blockedSlotsCount = slots.filter((slot) => slot.blocked).length;
    const quickAssignRoleOrder = [
        'Predigt',
        'Anbetungsstunde',
        'Leitung',
        'Organisator',
        'TechnikPC',
        'TechnikSound',
        'Klavier',
        'Gitarre',
        'Bass',
        'Schlagzeug',
        'Gesang1',
        'Gesang2',
        'Blockflöte'
    ];
    const displaySlots = [...slots].sort((a, b) => {
        const stateRank = (slot) => {
            if (slot?.open && !slot?.blocked) return 0;
            if (!slot?.open && !slot?.blocked) return 1;
            return 2;
        };
        const stateDiff = stateRank(a) - stateRank(b);
        if (stateDiff !== 0) return stateDiff;
        const aIndex = quickAssignRoleOrder.indexOf(String(a.roleKey || ''));
        const bIndex = quickAssignRoleOrder.indexOf(String(b.roleKey || ''));
        if (aIndex !== -1 || bIndex !== -1) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        }
        return String(a.label || a.roleKey).localeCompare(String(b.label || b.roleKey), 'de');
    });

    const downloadQuickAssignIcs = () => {
        const baseDate = parsePlanDate(data?.plan?.Datum);
        if (!baseDate) {
            if (showToast) showToast('Ungültiges Event-Datum.', 'error');
            return;
        }

        let start = null;
        let end = null;
        let summary = '';
        const descriptionParts = [
            data.plan?.Thema ? `Thema: ${data.plan.Thema}` : '',
            `Typ: ${data.plan?.Typ || 'Gottesdienst'}`,
            `Datum: ${data.plan?.Datum || ''}`
        ].filter(Boolean);

        if (calendarTarget === 'probe') {
            if (!data?.plan?.Probe) {
                if (showToast) showToast('Für diesen Termin ist keine Probe hinterlegt.', 'error');
                return;
            }
            const probeDate = new Date(data.plan.Probe);
            if (Number.isNaN(probeDate.getTime())) {
                if (showToast) showToast('Probezeit ist ungültig.', 'error');
                return;
            }
            start = probeDate;
            end = new Date(probeDate.getTime() + (2 * 60 * 60 * 1000));
            summary = `Probe - ${data.plan?.Typ || 'Gottesdienst'}`;
            descriptionParts.push(`Probe: ${probeDate.toLocaleString('de-DE')}`);
        } else {
            const { hour, minute } = parsePlanTime(data?.plan?.Uhrzeit || '10:30 Uhr');
            start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, minute, 0);
            end = new Date(start.getTime() + (2 * 60 * 60 * 1000));
            summary = `${data.plan?.Typ || 'Gottesdienst'} - Einsatz`;
            descriptionParts.push(`Uhrzeit: ${data.plan?.Uhrzeit || '10:30 Uhr'}`);
        }

        const now = new Date();
        const uidType = calendarTarget === 'probe' ? 'probe' : 'service';
        const uid = `${String(data?.plan?._id || planId || token)}-${uidType}@efg-nsu-portal`;
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//EFG NSU Portal//Quick Assign//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${escapeIcsText(uid)}`,
            `DTSTAMP:${formatIcsDateTimeLocal(now)}`,
            `DTSTART:${formatIcsDateTimeLocal(start)}`,
            `DTEND:${formatIcsDateTimeLocal(end)}`,
            `SUMMARY:${escapeIcsText(summary)}`,
            `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ];

        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        link.href = url;
        link.download = `event-${uidType}-${datePart}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (showToast) showToast('Kalendereintrag erstellt.', 'success');
    };

    return (
        <div className="min-h-[80vh] p-1.5 sm:p-4 w-full max-w-full overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Card className="w-full max-w-4xl shadow-xl border overflow-hidden mx-auto">
                <CardHeader className="pt-5 pb-5 sm:pt-6 sm:pb-6 bg-muted/30 border-b px-4 sm:px-6 space-y-3">
                    <div className="flex justify-end">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/90 px-2 py-1 shadow-[0_8px_18px_rgba(17,25,43,0.12)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(17,25,43,0.18)]">
                                    <div className="flex items-center">
                                        {compactViewers.length > 0 ? compactViewers.map((viewer, idx) => (
                                            <Tooltip key={viewer.userId}>
                                                <TooltipTrigger asChild>
                                                    <Avatar className={cn("h-7 w-7 border-2 border-white shadow-sm transition-transform duration-200 hover:scale-110", idx > 0 && "-ml-2")}>
                                                        <AvatarImage src={viewer.profileImage} />
                                                        <AvatarFallback className="text-[9px]">
                                                            {(viewer.firstName?.[0] || viewer.username?.[0] || '?').toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="text-xs">
                                                    {viewerLabel(viewer)}
                                                </TooltipContent>
                                            </Tooltip>
                                        )) : (
                                            <span className="text-[10px] font-medium text-muted-foreground px-1">Niemand aktiv</span>
                                        )}
                                        {hiddenViewerCount > 0 && (
                                            <span className="-ml-2 h-7 min-w-7 px-1 rounded-full border-2 border-white bg-muted text-[10px] font-semibold flex items-center justify-center">
                                                +{hiddenViewerCount}
                                            </span>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="h-7 text-[10px] font-semibold bg-background/70">
                                        <Users size={11} className="mr-1" /> {liveViewers.length} aktiv
                                    </Badge>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="end" className="max-w-xs">
                                {liveViewerNames.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aktiv in dieser Ansicht</p>
                                        <div className="text-xs leading-snug">
                                            {liveViewerNames.join(' • ')}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-xs">Niemand aktiv</span>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">{detailType} • {dateStr}</CardTitle>
                            <CardDescription className="font-semibold text-xs sm:text-sm mt-2">
                                {detailTime} • Event-Details und Eintragungsstatus
                            </CardDescription>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col gap-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" size="sm" className="font-semibold w-full sm:w-auto h-10" onClick={downloadQuickAssignIcs}>
                                    <Download size={14} className="mr-2" /> In Kalender speichern
                                </Button>
                                <Button variant="outline" size="sm" className="font-semibold w-full sm:w-auto h-10" onClick={() => navigate('/dienstplaner')}>
                                    <Calendar size={14} className="mr-2" /> Dienstplan öffnen
                                </Button>
                            </div>
                        </div>
                    </div>
                    {data.plan?.Thema && (
                        <div className="mt-3 p-3 rounded-lg border bg-primary/5">
                            <p className="text-[10px] uppercase font-bold text-primary/70">Thema</p>
                            <p className="font-semibold">{data.plan.Thema}</p>
                        </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-border/70 border-l-4 border-l-[rgb(237,132,91)] bg-card/85 p-2 shadow-[0_3px_10px_rgba(17,25,43,0.06)]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Offen</p>
                            <p className="text-sm font-extrabold text-primary">{openSlotsCount}</p>
                        </div>
                        <div className="rounded-lg border border-border/70 border-l-4 border-l-[rgb(92,163,114)] bg-card/85 p-2 shadow-[0_3px_10px_rgba(17,25,43,0.06)]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Eingeteilt</p>
                            <p className="text-sm font-extrabold">{assignedSlotsCount}</p>
                        </div>
                        <div className="rounded-lg border border-border/70 border-l-4 border-l-[rgb(114,157,214)] bg-card/85 p-2 shadow-[0_3px_10px_rgba(17,25,43,0.06)]">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Entfällt</p>
                            <p className="text-sm font-extrabold">{blockedSlotsCount}</p>
                        </div>
                    </div>
                    {(data.plan?.Probe || (data.plan?.probePollOptions || []).length > 0 || data.plan?.Besonderes || (data.plan?.songs || []).length > 0) && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            {data.plan?.Probe && (
                                <div className="p-2 rounded-lg border-[0.5px] border-[rgb(104,74,122)]/16 bg-[rgb(210,186,224)]/22 shadow-[0_3px_10px_rgba(104,74,122,0.1)]">
                                    <p className="text-[10px] uppercase font-bold text-[rgb(104,74,122)]">Probezeit</p>
                                    <p className="text-xs font-semibold">{new Date(data.plan.Probe).toLocaleString('de-DE')}</p>
                                </div>
                            )}
                            {(data.plan?.probePollOptions || []).length > 0 && (
                                <div className="p-2 rounded-lg border-[0.5px] border-black/10 bg-card md:col-span-2 shadow-[0_3px_10px_rgba(17,25,43,0.08)]">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Probezeit-Umfrage</p>
                                    <p className="text-xs">{(data.plan.probePollOptions || []).join(' • ')}</p>
                                </div>
                            )}
                            {data.plan?.Besonderes && (
                                <div className={cn("p-3 rounded-lg border md:col-span-3 shadow-[0_8px_20px_rgba(123,73,171,0.25)]", specialNoteClasses)}>
                                    <p className="text-[11px] uppercase font-extrabold tracking-wide">Besonderes</p>
                                    <p className="text-sm font-semibold leading-snug">{data.plan.Besonderes}</p>
                                </div>
                            )}
                            {(data.plan?.songs || []).length > 0 && (
                                <div className="p-3 rounded-lg border md:col-span-3 bg-card shadow-[0_3px_10px_rgba(17,25,43,0.08)]">
                                    <p className="text-[11px] uppercase font-extrabold tracking-wide mb-2">Lieder</p>
                                    <div className="space-y-1.5">
                                        {(data.plan.songs || []).map((song, idx) => (
                                            <div key={`detail-song-${idx}`} className="text-sm font-medium flex items-center gap-2">
                                                <span className="text-muted-foreground min-w-16">{song.number ? `#${song.number}` : '—'}</span>
                                                <span className="flex-1">{song.title || '-'}</span>
                                                {song.sourceUrl ? (
                                                    <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                                                        Quelle <ExternalLink size={11} />
                                                    </a>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-5">
                    <div className="space-y-3 rounded-xl border bg-card/60 p-3 sm:p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dienste</p>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            {displaySlots.map((slot) => (
                                <div key={slot.roleKey} className={cn("p-2.5 sm:p-3 rounded-lg border border-border/70 border-l-4 bg-card/85 space-y-2 shadow-sm min-h-[96px] sm:min-h-[104px]", assignmentStateClasses[slot.blocked ? 'blocked' : slot.open ? 'open' : 'assigned'])}>
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-sm font-bold">
                                        <span className="text-primary shrink-0">{ROLE_ICONS[slot.roleKey] || <Calendar size={14} />}</span>
                                        <span className="leading-tight">{slot.label}</span>
                                    </div>
                                    {slot.blocked ? (
                                        <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Entfällt</p>
                                    ) : slot.open ? (
                                        <Button
                                            size="sm"
                                            className="h-9 sm:h-10 text-xs sm:text-sm font-bold w-full px-3 sm:px-4"
                                            disabled={savingRoleKey === slot.roleKey}
                                            onClick={() => handleAssign(slot.roleKey)}
                                        >
                                            {savingRoleKey === slot.roleKey ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Check size={12} className="mr-1" />}
                                            Eintragen
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            {(isIntegratedMahlfeierValue(slot.assignedUsername) || isIntegratedMahlfeierValue(slot.assignedName)) ? (
                                                <p className="inline-flex items-center gap-1.5 text-sm font-semibold leading-tight text-[rgb(221,115,75)]">
                                                    <TriangleAlert size={14} className="shrink-0" />
                                                    Integrierte Mahlfeier
                                                </p>
                                            ) : (
                                                <p className="text-sm font-semibold leading-tight">{slot.assignedName || slot.assignedUsername}</p>
                                            )}
                                            {String(slot.assignedUsername || '').trim() === String(currentUser?.username || '').trim() && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 sm:h-10 text-xs sm:text-sm font-semibold w-full px-3 sm:px-4"
                                                    disabled={savingRoleKey === slot.roleKey}
                                                    onClick={() => handleUnassign(slot.roleKey)}
                                                >
                                                    {savingRoleKey === slot.roleKey ? <Loader2 size={12} className="mr-1 animate-spin" /> : <X size={12} className="mr-1" />}
                                                    Austragen
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {canManagePlanMeta && (
                        <>
                            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:p-4 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Termin-Workspace</p>
                                    <Badge variant="outline" className="text-[10px] font-bold">
                                        {hasPlanEditPermission ? 'Admin' : (isMusicOrga ? 'Musik-Orga' : 'Eingeteilt')}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Field className="space-y-2 min-w-0">
                                        <FieldLabel>Probezeit</FieldLabel>
                                        <Input
                                            type="datetime-local"
                                            value={probeDraft}
                                            onChange={(e) => setProbeDraft(e.target.value)}
                                            className="h-11 w-full min-w-0 text-sm sm:text-base"
                                        />
                                    </Field>
                                    <Field className="space-y-2 min-w-0">
                                        <FieldLabel>Umfrage Probezeiten (eine Zeile = eine Option)</FieldLabel>
                                        <textarea
                                            className="min-h-28 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm sm:text-base"
                                            placeholder={"Di 19:00\nMi 20:00"}
                                            value={probePollDraft}
                                            onChange={(e) => setProbePollDraft(e.target.value)}
                                        />
                                    </Field>
                                </div>
                                <div className="sticky bottom-2 sm:static">
                                    <Button size="sm" className="font-semibold w-full sm:w-auto h-11 sm:h-9 shadow-sm" disabled={savingProbe} onClick={saveProbeSettings}>
                                    {savingProbe ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                                    Probeinfos speichern
                                    </Button>
                                </div>
                                <Separator />
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Lieder pflegen</p>
                                        <Button type="button" size="sm" variant="outline" className="h-9" onClick={addSongDraft}>
                                            <Plus size={14} className="mr-1.5" /> Lied hinzufügen
                                        </Button>
                                    </div>
                                    {songsDraft.length === 0 && (
                                        <p className="text-xs text-muted-foreground">Noch keine Lieder eingetragen.</p>
                                    )}
                                    <div className="space-y-2">
                                        {songsDraft.map((song, idx) => (
                                            <div key={`quickassign-song-${idx}`} className="rounded-lg border bg-card p-3 space-y-2">
                                                <div className="grid grid-cols-12 gap-2">
                                                    <Input
                                                        className="col-span-3"
                                                        placeholder="#"
                                                        value={song.number || ''}
                                                        onChange={(e) => updateSongDraftAt(idx, 'number', e.target.value)}
                                                    />
                                                    <Input
                                                        className="col-span-7"
                                                        placeholder="Liedtitel"
                                                        value={song.title || ''}
                                                        onChange={(e) => updateSongDraftAt(idx, 'title', e.target.value)}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="col-span-2 justify-self-end"
                                                        onClick={() => removeSongDraftAt(idx)}
                                                        title="Lied entfernen"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                                <Input
                                                    placeholder="Quelle (optional), z.B. https://..."
                                                    value={song.sourceUrl || ''}
                                                    onChange={(e) => updateSongDraftAt(idx, 'sourceUrl', e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="sticky bottom-2 sm:static">
                                        <Button
                                            size="sm"
                                            className="font-semibold w-full sm:w-auto h-11 sm:h-9 shadow-sm"
                                            disabled={savingSongs}
                                            onClick={saveSongsSettings}
                                        >
                                            {savingSongs ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                                            Lieder speichern
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const Breadcrumbs = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const labels = { 
        '/admin': 'Dashboard', 
        '/admin/users': 'Benutzer', 
        '/admin/roles': 'Berechtigungen', 
        '/admin/bot': 'WhatsApp', 
        '/admin/activity': 'Logs',
        '/admin/plan-slots': 'Dienst-Slots',
        '/admin/monitor': 'Monitoring',
        '/admin/stats': 'Statistik',
        '/admin/security': 'Sicherheit',
        '/admin/email': 'Email Versand'
    };
    if (!path.startsWith('/admin')) return null;
    return (
        <div className="flex items-center gap-2 mb-6 text-xs font-medium text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Shield size={14} /> Admin
            </Link>
            {path !== '/admin' && (
                <>
                    <ChevronRight size={12} />
                    <span className="text-foreground font-semibold">{labels[path]}</span>
                </>
            )}
        </div>
    );
};

const PlanerCardComponent = ({ entry, onEdit, onDelete, onOpenDetails, canEdit, showToast, showConfirm, currentUser, loadPlan, allUsers = [], highlighted = false }) => {
    const [substituteModal, setSubstituteModal] = useState({ show: false, roleKey: '', candidates: [], config: null, loading: false });
    const [subMsg, setSubMsg] = useState('');
    const [notifiedUserIds, setNotifiedUserIds] = useState([]);
    const [editingTopic, setEditingTopic] = useState(false);
    const [topicDraft, setTopicDraft] = useState(entry.Thema || '');
    const [savingTopic, setSavingTopic] = useState(false);
    const [downloadingRunSheet, setDownloadingRunSheet] = useState(false);
    const usersByUsername = useMemo(() => {
        const map = new Map();
        (allUsers || []).forEach((u) => {
            if (u?.username) map.set(u.username, u);
        });
        return map;
    }, [allUsers]);

    const handleQuickAssign = async (roleKey) => {
        if (!currentUser) return;
        
        showConfirm(
            "Dienst übernehmen?", 
            `Möchtest du den Dienst "${roleKey}" am ${entry.Datum.split('-').reverse().join('.')} wirklich übernehmen?`,
            async () => {
                const username = currentUser.username;
                try {
                    const updatedEntry = { ...entry, [roleKey]: username };
                    await api.put(`/api/plan/${entry._id || entry.id}`, { data: updatedEntry, notify: false });
                    if (loadPlan) loadPlan(true);
                    showToast("Dienst erfolgreich übernommen!", "success");
                } catch (e) {
                    showToast("Fehler beim Übernehmen des Dienstes.", "error");
                }
            },
            "info"
        );
    };

    const handleRequestSubstitute = async () => {
        try {
            await api.post(`/api/plan/${entry._id || entry.id}/substitute`, {
                roleKey: substituteModal.roleKey,
                message: subMsg,
                userIds: notifiedUserIds
            });
            showToast("Vertretungsanfrage gesendet!", "success");
            setSubstituteModal({ show: false, roleKey: '', candidates: [], config: null, loading: false });
        } catch (e) {
            showToast(e.response?.data?.error || "Fehler beim Senden.", "error");
        }
    };

    const openSubstituteModal = async (roleKey) => {
        setSubstituteModal({ show: true, roleKey, candidates: [], config: null, loading: true });
        setSubMsg('');
        setNotifiedUserIds([]);
        try {
            const res = await api.get(`/api/plan/${entry._id || entry.id}/substitute/candidates`, { params: { roleKey } });
            const candidates = Array.isArray(res.data?.users) ? res.data.users : [];
            setSubstituteModal({ show: true, roleKey, candidates, config: res.data?.config || null, loading: false });
            setNotifiedUserIds(candidates.map((u) => u._id));
        } catch (e) {
            setSubstituteModal({ show: true, roleKey, candidates: [], config: null, loading: false });
            showToast(e.response?.data?.error || "Konnte keine Kandidaten laden.", "error");
        }
    };

    const toggleNotifiedUser = (id) => {
        setNotifiedUserIds(prev => 
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const canEditTopic = Boolean(canEdit || (currentUser && entry.Predigt === currentUser.username));

    const saveTopic = async () => {
        setSavingTopic(true);
        try {
            await api.patch(`/api/plan/${entry._id || entry.id}/topic`, { Thema: topicDraft });
            if (loadPlan) loadPlan(true);
            showToast("Thema gespeichert", "success");
            setEditingTopic(false);
        } catch (e) {
            showToast(e.response?.data?.error || "Thema konnte nicht gespeichert werden.", "error");
        } finally {
            setSavingTopic(false);
        }
    };

    const handleDownloadRunSheet = async () => {
        const entryId = entry._id || entry.id;
        if (!entryId || downloadingRunSheet) return;
        setDownloadingRunSheet(true);
        try {
            const res = await api.get(`/api/plan/${entryId}/runsheet`, { responseType: 'blob' });
            const contentDisposition = String(res.headers?.['content-disposition'] || '');
            const match = contentDisposition.match(/filename="?([^"]+)"?/i);
            const fileName = match?.[1] ? decodeURIComponent(match[1]) : `Ablaufplan-${entry.Datum || 'dienst'}.xlsx`;
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showToast("Ablaufplan erstellt", "success");
        } catch (e) {
            showToast(e?.response?.data?.error || "Ablaufplan konnte nicht erstellt werden.", "error");
        } finally {
            setDownloadingRunSheet(false);
        }
    };

    const resolveName = (val) => {
        if (!val || val === '/' || val === '?' || val === '-') return val;
        if (isIntegratedMahlfeierValue(val)) return 'Integrierte Mahlfeier';
        const found = usersByUsername.get(val);
        if (found) return `${found.firstName} ${found.lastName}`.trim();
        return `⚠️ ${val}`;
    };

    const renderBesetzung = (val, roleKey) => {
        if (val === '/') return <span className="text-muted-foreground font-medium opacity-40 text-xs uppercase">entfällt</span>;
        if (isIntegratedMahlfeierValue(val)) {
            return (
                <span className="inline-flex items-center gap-1.5 text-[rgb(221,115,75)] font-semibold text-sm">
                    <TriangleAlert size={14} className="shrink-0" />
                    Integrierte Mahlfeier
                </span>
            );
        }
        const isEmpty = !val || val.trim() === '' || val === '-' || val === '?';
        const isMe = currentUser && val === currentUser.username;
        
        if (isEmpty) {
            return (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                    {currentUser && (
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="h-9 px-3 text-xs font-bold uppercase tracking-wide w-full sm:w-auto"
                            onClick={(e) => {
                                e.preventDefault();
                                handleQuickAssign(roleKey);
                            }}
                        >
                            Eintragen
                        </Button>
                    )}
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-1 items-start">
                <span className="font-semibold text-sm break-words">{resolveName(val)}</span>
                {isMe && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 px-3 text-xs font-bold uppercase tracking-wide border-[rgb(237,132,91)]/35 text-[rgb(237,132,91)] hover:bg-[rgb(237,132,91)]/12 hover:text-[rgb(221,115,75)] w-full sm:w-auto"
                        onClick={() => openSubstituteModal(roleKey)}
                    >
                        Vertretung anfordern
                    </Button>
                )}
            </div>
        );
    };

    const renderRoleBlock = (label, roleKey, icon) => {
        if (entry?.[roleKey] === '/') return null;
        return (
            <div className="space-y-1 rounded-lg border border-black/10 bg-background/80 p-3 min-h-[78px]">
                <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                    {icon} {label}
                </Label>
                <div className="text-sm font-medium">{renderBesetzung(entry[roleKey], roleKey)}</div>
            </div>
        );
    };

    const handleProtectedAction = (action, callback) => {
        if (!canEdit) {
            showToast("Keine Berechtigung zum Bearbeiten.", "error");
            return;
        }
        callback();
    };

    const planEntryId = String(entry._id || entry.id || '');
    const displayTags = (Array.isArray(entry.tags) ? entry.tags : []).filter((tag) => String(tag || '').trim().toLowerCase() !== 'sonntag');
    const primaryRoleItems = [
        { label: 'Predigt', key: 'Predigt', icon: <Shield size={14} /> },
        { label: 'Anbetung', key: 'Anbetungsstunde', icon: <HandHelping size={14} /> },
        { label: 'Leitung', key: 'Leitung', icon: <User size={14} /> },
        { label: 'Musik-Orga', key: 'Organisator', icon: <ListMusic size={14} /> },
        { label: 'Technik PC', key: 'TechnikPC', icon: <Monitor size={14} /> },
        { label: 'Technik Sound', key: 'TechnikSound', icon: <Sliders size={14} /> }
    ];
    const musicRoleItems = [
        { key: 'Klavier', icon: <Piano size={14} /> },
        { key: 'Gitarre', icon: <Guitar size={14} /> },
        { key: 'Bass', icon: <Music size={14} /> },
        { key: 'Schlagzeug', icon: <Drum size={14} /> },
        { key: 'Gesang1', icon: <Mic2 size={14} /> },
        { key: 'Gesang2', icon: <Mic2 size={14} /> }
    ];
    const visiblePrimaryRoleItems = primaryRoleItems.filter((item) => entry?.[item.key] !== '/');
    const visibleMusicRoleItems = musicRoleItems.filter((item) => entry?.[item.key] !== '/');

    return (
        <>
        <Card
            id={planEntryId ? `plan-entry-${planEntryId}` : undefined}
            data-plan-id={planEntryId || undefined}
            className={cn(
                "border-[0.5px] border-black/10 shadow-[0_4px_12px_rgba(17,25,43,0.08)] transition-shadow hover:shadow-[0_6px_16px_rgba(17,25,43,0.11)] group relative mb-4 overflow-hidden",
                highlighted && "ring-2 ring-primary/50"
            )}
        >
            <CardHeader className="p-4 sm:p-6 bg-muted/10">
                <div className="flex items-start gap-3 sm:gap-4">
                <div className="bg-primary/5 text-primary p-3 rounded-lg border border-primary/10">
                    <Calendar size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-primary">{entry.Datum.split('-').reverse().join('.')}</CardTitle>
                        {displayTags.length > 0 ? (
                            displayTags.map(t => (
                                <Badge
                                    key={t}
                                    variant="secondary"
                                    className={cn(
                                        "text-xs font-bold px-2 py-0.5 h-auto",
                                        (t === 'Sonntag' || t === 'Gottesdienst')
                                            ? "bg-[rgb(255,236,217)] text-[rgb(140,78,40)] border border-[rgb(246,198,156)]"
                                            : ""
                                    )}
                                >
                                    {t}
                                </Badge>
                            ))
                        ) : (
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "text-xs font-bold px-2 py-0.5 h-auto",
                                    (entry.Typ === 'Sonntag' || entry.Typ === 'Gottesdienst')
                                        ? "bg-[rgb(255,236,217)] text-[rgb(140,78,40)] border border-[rgb(246,198,156)]"
                                        : ""
                                )}
                            >
                                {entry.Typ || 'Gottesdienst'}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mt-0.5">
                        <Clock size={12} /> {entry.Uhrzeit || '10:30 UHR'}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-start gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="font-semibold h-8 text-xs sm:text-sm self-start"
                            onClick={() => onOpenDetails && onOpenDetails(entry)}
                        >
                            <ExternalLink size={14} className="mr-2" /> Details öffnen
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="font-semibold h-8 text-xs sm:text-sm self-start"
                            onClick={handleDownloadRunSheet}
                            disabled={downloadingRunSheet}
                        >
                            {downloadingRunSheet ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FileSpreadsheet size={14} className="mr-2" />}
                            Ablaufplan
                        </Button>
                    </div>
                </div>
                <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-background/90" onClick={() => handleProtectedAction('edit', () => onEdit(entry))}>
                        <Edit2 size={14} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 bg-background/90" onClick={() => handleProtectedAction('delete', () => onDelete(entry._id || entry.id))}>
                        <Trash2 size={14} />
                    </Button>
                </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <Label className="text-[10px] text-primary/70 uppercase font-bold block">THEMA</Label>
                        {canEditTopic && !editingTopic && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-semibold"
                                onClick={() => setEditingTopic(true)}
                            >
                                <Edit2 size={12} className="mr-1" /> Bearbeiten
                            </Button>
                        )}
                    </div>
                    {editingTopic ? (
                        <div className="space-y-2">
                            <Input
                                value={topicDraft}
                                onChange={(e) => setTopicDraft(e.target.value)}
                                placeholder="Thema eintragen..."
                                className="h-9"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" className="h-8 text-xs" onClick={saveTopic} disabled={savingTopic}>
                                    {savingTopic ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
                                    Speichern
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingTopic(false); setTopicDraft(entry.Thema || ''); }}>
                                    Abbrechen
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className={cn("text-foreground font-semibold leading-tight", !entry.Thema && "text-muted-foreground italic font-normal opacity-60")}>
                            {entry.Thema ? `"${entry.Thema}"` : "Thema noch nicht festgelegt"}
                        </p>
                    )}
                </div>

                {visiblePrimaryRoleItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visiblePrimaryRoleItems.map((item) => (
                        <React.Fragment key={item.key}>
                            {renderRoleBlock(item.label, item.key, item.icon)}
                        </React.Fragment>
                    ))}
                </div>
            )}

                {visibleMusicRoleItems.length > 0 && (
                    <div className="space-y-3 pt-2">
                        <Label className="text-[10px] text-primary uppercase font-bold flex items-center gap-2"><Music size={14} /> MUSIK-BESETZUNG</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibleMusicRoleItems.map((inst) => (
                                <div key={inst.key} className="flex flex-col gap-2 rounded-lg border border-black/10 bg-background/80 p-3 min-h-[78px]">
                                    <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">{inst.icon} {inst.key.replace(/(\d)/, ' $1')}</span>
                                    <div className="text-sm font-semibold w-full sm:w-auto">{renderBesetzung(entry[inst.key], inst.key)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>

            {(entry.Probe || entry.Besonderes || (entry.songs || []).length > 0) && (
                <CardFooter className="px-6 pb-6 pt-0 flex flex-col sm:flex-row gap-3">
                    {entry.Probe && (
                        <div className="flex items-center gap-2 text-[10px] font-semibold bg-[rgb(210,186,224)]/24 px-3 py-1.5 rounded-md border-[0.5px] border-[rgb(104,74,122)]/16 text-[rgb(104,74,122)] shadow-[0_3px_10px_rgba(104,74,122,0.1)]">
                            <Clock size={12} />
                            <span>MUSIKPROBE: {new Date(entry.Probe).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                    {entry.Besonderes && (
                        <div className={cn("flex-1 flex items-center gap-2 p-3 px-4 text-sm font-bold rounded-md border shadow-[0_8px_20px_rgba(123,73,171,0.25)]", specialNoteClasses)}>
                            <Zap size={16} className="shrink-0" />
                            <span className="leading-snug">{entry.Besonderes}</span>
                        </div>
                    )}
                    {(entry.songs || []).length > 0 && (
                        <div className="w-full text-xs rounded-md border bg-card p-3">
                            <p className="font-bold uppercase tracking-wide text-muted-foreground mb-1">Lieder</p>
                            <p className="font-medium leading-relaxed">
                                {(entry.songs || []).map((song) => `${song.number ? `#${song.number} ` : ''}${song.title || ''}`.trim()).filter(Boolean).join(' • ')}
                            </p>
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>

        <Dialog open={substituteModal.show} onOpenChange={(o) => !o && setSubstituteModal({ ...substituteModal, show: false })}>
            <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl rounded-xl border">
                <DialogHeader className="p-6 border-b bg-muted/30">
                    <DialogTitle className="text-xl font-bold tracking-tight">Vertretung anfordern</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Sende eine Anfrage für deinen Dienst "{substituteModal.roleKey}" am {entry.Datum.split('-').reverse().join('.')}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary flex justify-between items-center px-1">
                            <span>Empfänger ({notifiedUserIds.length})</span>
                            <span className="text-muted-foreground font-medium lowercase">Automatisch nach Slot-Regeln</span>
                        </p>
                        <div className="grid grid-cols-1 gap-2 bg-muted/20 p-3 rounded-xl border border-dashed">
                            {substituteModal.loading && (
                                <div className="py-4 flex items-center justify-center text-xs text-muted-foreground">
                                    <Loader2 size={14} className="mr-2 animate-spin" /> Lade Kandidaten...
                                </div>
                            )}
                            {!substituteModal.loading && substituteModal.candidates.map(member => (
                                <div
                                    key={member._id}
                                    onClick={() => toggleNotifiedUser(member._id)}
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border",
                                        notifiedUserIds.includes(member._id) ? "bg-background border-primary/20 shadow-sm" : "opacity-40 border-transparent grayscale grayscale-0"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                                        notifiedUserIds.includes(member._id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                                    )}>
                                        {notifiedUserIds.includes(member._id) && <Check size={12} className="stroke-[3px]" />}
                                    </div>
                                    <UserAvatar user={member} size="xs" />
                                    <span className="text-xs font-bold">{member.firstName} {member.lastName}</span>
                                </div>
                            ))}
                            {!substituteModal.loading && substituteModal.candidates.length === 0 && (
                                <p className="text-center py-4 text-xs text-muted-foreground italic uppercase font-bold tracking-tighter">Keine Kandidaten gefunden.</p>
                            )}
                        </div>
                    </div>

                    <Field>
                        <FieldLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Nachricht (Optional)</FieldLabel>
                        <Input placeholder="Grund, Details..." value={subMsg} onChange={e => setSubMsg(e.target.value)} className="h-11" />
                    </Field>
                </div>
                <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
                    <Button variant="outline" onClick={() => setSubstituteModal({ ...substituteModal, show: false })}>Abbrechen</Button>
                    <Button 
                        onClick={handleRequestSubstitute} 
                        variant="destructive" 
                        className="font-bold"
                        disabled={notifiedUserIds.length === 0}
                    >
                        ANFRAGE SENDEN
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
};

export const PlanerCard = React.memo(PlanerCardComponent, (prev, next) => {
    const prevId = String(prev.entry?._id || prev.entry?.id || '');
    const nextId = String(next.entry?._id || next.entry?.id || '');
    const prevUser = String(prev.currentUser?.username || '');
    const nextUser = String(next.currentUser?.username || '');
    return (
        prevId === nextId &&
        prev.entry === next.entry &&
        prev.onOpenDetails === next.onOpenDetails &&
        prev.canEdit === next.canEdit &&
        prev.highlighted === next.highlighted &&
        prevUser === nextUser &&
        prev.allUsers === next.allUsers
    );
});
PlanerCard.displayName = 'PlanerCard';

export const PlanerModal = ({ entry, onClose, onSave, allUsers = [] }) => {
    const mapSongs = (rawSongs) => (
        (Array.isArray(rawSongs) ? rawSongs : [])
            .map((song) => ({
                number: String(song?.number || '').trim(),
                title: String(song?.title || '').trim(),
                sourceUrl: String(song?.sourceUrl || '').trim()
            }))
    );
    const sanitizeSongsForSave = (rawSongs) => mapSongs(rawSongs).filter((song) => song.number || song.title);
    const [formData, setFormData] = useState(() => {
        const base = entry || { Datum: '', Uhrzeit: '10:30 Uhr', Typ: 'Gottesdienst', tags: [], songs: [], Thema: '', Predigt: '', Leitung: '', Anbetungsstunde: '', Organisator: '', TechnikPC: '', TechnikSound: '', Klavier: '', Gitarre: '', Bass: '', Schlagzeug: '', 'Blockflöte': '', Gesang1: '', Gesang2: '', Probe: '', Anmerkung: '', Besonderes: '' };
        const normalizedTyp = String(base?.Typ || '').trim().toLowerCase() === 'sonntag' ? 'Gottesdienst' : base.Typ;
        const normalizedTags = Array.isArray(base?.tags)
            ? base.tags.map((tag) => String(tag || '').trim().toLowerCase() === 'sonntag' ? 'Gottesdienst' : tag)
            : [];
        return { ...base, Typ: normalizedTyp || 'Gottesdienst', tags: normalizedTags, songs: mapSongs(base?.songs) };
    });
    const [songSuggestions, setSongSuggestions] = useState({});
    const [songLoadingByIndex, setSongLoadingByIndex] = useState({});
    const [songDropdownIndex, setSongDropdownIndex] = useState(null);
    const songSearchTimersRef = useRef({});
    const songSearchCacheRef = useRef(new Map());
    const [categoryOptions, setCategoryOptions] = useState([
        { label: 'Gottesdienst', value: 'Gottesdienst' },
        { label: 'Bibel- und Gebetsabend', value: 'Bibel- und Gebetsabend' }
    ]);
    const userOptions = useMemo(
        () => (allUsers || [])
            .map((u) => ({
                label: `${u.firstName} ${u.lastName}`.trim() || u.username,
                value: u.username
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'de')),
        [allUsers]
    );
    const worshipOptions = useMemo(() => {
        const special = { label: 'Integrierte Mahlfeier', value: 'Integrierte Mahlfeier!' };
        const hasSpecial = userOptions.some((item) => item.value === special.value);
        return hasSpecial ? userOptions : [special, ...userOptions];
    }, [userOptions]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/api/plan/categories');
                if (cancelled) return;
                const categories = Array.isArray(res.data?.categories) ? res.data.categories : [];
                const normalized = categories
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
                    .map((value) => value.toLowerCase() === 'sonntag' ? 'Gottesdienst' : value);
                const deduped = Array.from(new Set(normalized));
                if (deduped.length > 0) {
                    setCategoryOptions(deduped.map((value) => ({ label: value, value })));
                }
            } catch (_e) {
                // Fallback options remain available for editing.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        return () => {
            const timers = songSearchTimersRef.current || {};
            Object.values(timers).forEach((timerId) => {
                if (timerId) clearTimeout(timerId);
            });
            songSearchTimersRef.current = {};
        };
    }, []);

    const setSongAt = (index, patch) => {
        setFormData((prev) => {
            const songs = mapSongs(prev.songs);
            if (!songs[index]) songs[index] = { number: '', title: '', sourceUrl: '' };
            songs[index] = {
                ...songs[index],
                ...patch
            };
            return { ...prev, songs };
        });
    };

    const addSongRow = () => {
        setFormData((prev) => ({
            ...prev,
            songs: [...mapSongs(prev.songs), { number: '', title: '', sourceUrl: '' }]
        }));
    };

    const removeSongRow = (index) => {
        setFormData((prev) => ({
            ...prev,
            songs: mapSongs(prev.songs).filter((_, i) => i !== index)
        }));
        setSongSuggestions((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
        setSongLoadingByIndex((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
        if (songDropdownIndex === index) setSongDropdownIndex(null);
    };

    const searchSongSuggestions = async (index, query) => {
        const q = String(query || '').trim();
        if (q.length < 2) {
            if (songSearchTimersRef.current[index]) {
                clearTimeout(songSearchTimersRef.current[index]);
                delete songSearchTimersRef.current[index];
            }
            setSongSuggestions((prev) => ({ ...prev, [index]: [] }));
            setSongLoadingByIndex((prev) => ({ ...prev, [index]: false }));
            return;
        }
        const cacheKey = q.toLowerCase();
        const cached = songSearchCacheRef.current.get(cacheKey);
        if (cached) {
            songSearchCacheRef.current.delete(cacheKey);
            songSearchCacheRef.current.set(cacheKey, cached);
            setSongSuggestions((prev) => ({ ...prev, [index]: cached }));
            setSongLoadingByIndex((prev) => ({ ...prev, [index]: false }));
            return;
        }
        setSongLoadingByIndex((prev) => ({ ...prev, [index]: true }));
        if (songSearchTimersRef.current[index]) {
            clearTimeout(songSearchTimersRef.current[index]);
        }
        songSearchTimersRef.current[index] = setTimeout(async () => {
            try {
                const res = await api.get('/api/songs/search', {
                    params: { q, limit: 12 }
                });
                const songs = Array.isArray(res.data?.songs) ? res.data.songs : [];
                songSearchCacheRef.current.set(cacheKey, songs);
                while (songSearchCacheRef.current.size > 100) {
                    const oldest = songSearchCacheRef.current.keys().next().value;
                    songSearchCacheRef.current.delete(oldest);
                }
                setSongSuggestions((prev) => ({ ...prev, [index]: songs }));
            } catch (_e) {
                setSongSuggestions((prev) => ({ ...prev, [index]: [] }));
            } finally {
                setSongLoadingByIndex((prev) => ({ ...prev, [index]: false }));
            }
        }, 300);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] p-0 flex flex-col shadow-lg rounded-xl border overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                        {entry ? 'Termin bearbeiten' : 'Neuer Termin'}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Aktualisiere den Gottesdienstplan.</DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 perf-scroll">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Field className="grid gap-2">
                            <FieldLabel className="flex items-center gap-2 ml-1 uppercase text-[10px] font-bold tracking-wider text-muted-foreground"><Calendar size={14} /> Datum</FieldLabel>
                            <DatePicker 
                                value={formData.Datum} 
                                onChange={v => setFormData({...formData, Datum: v})} 
                                className="w-full"
                            />
                        </Field>
                        <Field className="grid gap-2">
                            <FieldLabel className="flex items-center gap-2 ml-1 uppercase text-[10px] font-bold tracking-wider text-muted-foreground"><Clock size={14} /> Uhrzeit</FieldLabel>
                            <TimePicker 
                                value={formData.Uhrzeit} 
                                onChange={v => {
                                    const update = { ...formData, Uhrzeit: v };
                                    // Wenn Uhrzeit nicht 9:30 ist, Anbetung auf Mahlfeier setzen (falls leer)
                                    if (!v.includes('9:30') && (!formData.Anbetungsstunde || formData.Anbetungsstunde === '')) {
                                        update.Anbetungsstunde = 'Integrierte Mahlfeier!';
                                    }
                                    setFormData(update);
                                }} 
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Field className="grid gap-2">
                            <FieldLabel className="flex items-center gap-2"><Tag size={14} /> Kategorie (Typ)</FieldLabel>
                            <Select
                                value={String(formData.Typ || '').trim() || 'Gottesdienst'}
                                onValueChange={(val) => setFormData({ ...formData, Typ: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategorie wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {categoryOptions.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel className="flex items-center gap-2"><Plus size={14} /> Kategorien</FieldLabel>
                            <ComboboxMultiple 
                                placeholder="Typ definieren..."
                                selected={formData.tags || []} 
                                onChange={vals => setFormData({...formData, tags: vals})} 
                                options={categoryOptions}
                            />
                        </Field>
                        <Field className="grid gap-2 sm:col-span-2">
                            <FieldLabel className="flex items-center gap-2 ml-1 uppercase text-[10px] font-bold tracking-wider text-muted-foreground"><Clock size={14} /> Musikprobe</FieldLabel>
                            <DateTimePicker 
                                value={formData.Probe} 
                                onChange={v => setFormData({...formData, Probe: v})} 
                            />
                        </Field>
                    </div>

                    <div className="space-y-6 pt-2 border-t">
                        <Field>
                            <FieldLabel>Thema</FieldLabel>
                            <Input placeholder="Thema des Dienstes..." className="h-12 text-base font-semibold " value={formData.Thema} onChange={e => setFormData({...formData, Thema: e.target.value})} />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <PersonSelect
                                label="Predigt"
                                icon={<Shield size={14} />}
                                value={formData.Predigt || ''}
                                onChange={(v) => setFormData({ ...formData, Predigt: v })}
                                onBlock={(v) => setFormData({ ...formData, Predigt: v })}
                                options={userOptions}
                            />
                            <PersonSelect
                                label="Leitung"
                                icon={<User size={14} />}
                                value={formData.Leitung || ''}
                                onChange={(v) => setFormData({ ...formData, Leitung: v })}
                                onBlock={(v) => setFormData({ ...formData, Leitung: v })}
                                options={userOptions}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="space-y-6">
                            <PersonSelect
                                label="Anbetung"
                                icon={<HandHelping size={14} />}
                                value={formData.Anbetungsstunde || ''}
                                onChange={(v) => setFormData({ ...formData, Anbetungsstunde: v })}
                                onBlock={(v) => setFormData({ ...formData, Anbetungsstunde: v })}
                                options={worshipOptions}
                            />
                            <PersonSelect
                                label="Musik-Orga"
                                icon={<ListMusic size={14} />}
                                value={formData.Organisator || ''}
                                onChange={(v) => setFormData({ ...formData, Organisator: v })}
                                onBlock={(v) => setFormData({ ...formData, Organisator: v })}
                                options={userOptions}
                            />
                        </div>
                        <div className="space-y-6">
                            <PersonSelect
                                label="Technik PC"
                                icon={<Monitor size={14} />}
                                value={formData.TechnikPC || ''}
                                onChange={(v) => setFormData({ ...formData, TechnikPC: v })}
                                onBlock={(v) => setFormData({ ...formData, TechnikPC: v })}
                                options={userOptions}
                            />
                            <PersonSelect
                                label="Technik Sound"
                                icon={<Sliders size={14} />}
                                value={formData.TechnikSound || ''}
                                onChange={(v) => setFormData({ ...formData, TechnikSound: v })}
                                onBlock={(v) => setFormData({ ...formData, TechnikSound: v })}
                                options={userOptions}
                            />
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 border-t">
                        <Label className="text-xs font-bold text-primary flex items-center gap-2">
                            <Music size={16} /> MUSIKTEAM
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[{ key: 'Klavier', icon: <Piano size={14} /> }, { key: 'Gitarre', icon: <Guitar size={14} /> }, { key: 'Bass', icon: <Music size={14} /> }, { key: 'Schlagzeug', icon: <Drum size={14} /> }, { key: 'Gesang1', icon: <Mic2 size={14} /> }, { key: 'Gesang2', icon: <Mic2 size={14} /> }].map(inst => (
                                <PersonSelect 
                                    key={inst.key} 
                                    label={inst.key.replace(/([A-Z])/g, ' $1').trim()} 
                                    icon={inst.icon} 
                                    value={formData[inst.key] || ''} 
                                    onChange={val => setFormData({...formData, [inst.key]: val})} 
                                    onBlock={val => setFormData({...formData, [inst.key]: val})}
                                    options={userOptions} 
                                />
                            ))}
                        </div>
                    </div>

                    <Field>
                        <FieldLabel className="flex items-center gap-2.5 uppercase text-[10px] font-bold tracking-[0.2em] ml-1 text-muted-foreground"><MessageSquare size={14} className="stroke-[3px]" /> Interne Anmerkung</FieldLabel>
                        <Input placeholder="Infos für das Team..." className="h-12 font-medium" value={formData.Anmerkung || ''} onChange={e => setFormData({...formData, Anmerkung: e.target.value})} />
                    </Field>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-primary flex items-center gap-2">
                                <Music size={16} /> LIEDER (MUSIKPLAN)
                            </Label>
                            <Button type="button" variant="outline" size="sm" onClick={addSongRow}>
                                <Plus size={14} className="mr-1.5" /> Lied hinzufügen
                            </Button>
                        </div>

                        {(Array.isArray(formData.songs) ? formData.songs : []).length === 0 && (
                            <p className="text-xs text-muted-foreground">Noch keine Lieder eingetragen.</p>
                        )}

                        <div className="space-y-3">
                            {(Array.isArray(formData.songs) ? formData.songs : []).map((song, index) => (
                                <div key={`song-${index}`} className="rounded-lg border p-3 space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2">
                                        <Input
                                            placeholder="Nummer"
                                            value={song.number || ''}
                                            onChange={(e) => setSongAt(index, { number: e.target.value })}
                                        />
                                        <div className="relative">
                                            <Input
                                                placeholder="Titel (Autovervollständigung)"
                                                value={song.title || ''}
                                                onFocus={() => setSongDropdownIndex(index)}
                                                onChange={(e) => {
                                                    const nextTitle = e.target.value;
                                                    setSongAt(index, { title: nextTitle });
                                                    setSongDropdownIndex(index);
                                                    searchSongSuggestions(index, nextTitle);
                                                }}
                                            />
                                            {songLoadingByIndex[index] && (
                                                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                                            )}
                                            {songDropdownIndex === index && (
                                                <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto">
                                                    {songLoadingByIndex[index] && (
                                                        <div className="px-3 py-2 text-xs text-muted-foreground">Suche...</div>
                                                    )}
                                                    {!songLoadingByIndex[index] && (!(songSuggestions[index] || []).length) && (
                                                        <div className="px-3 py-2 text-xs text-muted-foreground">Keine Treffer</div>
                                                    )}
                                                    {!songLoadingByIndex[index] && (songSuggestions[index] || []).map((item, itemIndex) => (
                                                        <button
                                                            key={`song-suggestion-${index}-${itemIndex}`}
                                                            type="button"
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                                                            onClick={() => {
                                                                setSongAt(index, {
                                                                    title: item.title || '',
                                                                    number: item.number || song.number || '',
                                                                    sourceUrl: item.sourceUrl || ''
                                                                });
                                                                setSongDropdownIndex(null);
                                                            }}
                                                        >
                                                            <span className="font-medium">{item.title || '-'}</span>
                                                            {item.number ? <span className="ml-2 text-xs text-muted-foreground">#{item.number}</span> : null}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeSongRow(index)}>
                                            <Trash2 size={15} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-muted/30 shrink-0 gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Abbrechen</Button>
                    <Button onClick={() => onSave({ ...formData, songs: sanitizeSongsForSave(formData.songs) })} className="flex-1 sm:flex-none">
                        <Save className="mr-2 h-4 w-4" /> PLAN SPEICHERN
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const ProfileModal = ({ user, onClose, onSave, showToast }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [formData, setFormData] = useState({ 
        firstName: user.firstName || '', 
        lastName: user.lastName || '', 
        email: user.email || '', 
        birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : ''
    });
    const [countryCode, setCountryCode] = useState('49');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(true);
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(user.profileImage || null);
    const [clearProfileImage, setClearProfileImage] = useState(false);
    const [coverImage, setCoverImage] = useState(null);
    const [coverPreview, setCoverPreview] = useState(user.optimizedCoverImage || user.coverImage || null);
    const [coverColor, setCoverColor] = useState(user.coverColor || '#a1ced9');
    const [contactVisibility, setContactVisibility] = useState({
        emailPublic: Boolean(user?.contactVisibility?.emailPublic),
        phonePublic: Boolean(user?.contactVisibility?.phonePublic)
    });
    const [notifications, setNotifications] = useState(user.notifications || {});
    const [savingProfile, setSavingProfile] = useState(false);
    const [calendarFeed, setCalendarFeed] = useState({
        token: user?.calendarFeed?.token || '',
        enabledSources: Array.isArray(user?.calendarFeed?.enabledSources) ? user.calendarFeed.enabledSources : ['PLAN_ASSIGNMENTS', 'PLAN_PROBES'],
        availableSources: Array.isArray(user?.calendarFeed?.availableSources) ? user.calendarFeed.availableSources : [
            { key: 'PLAN_ASSIGNMENTS', label: 'Meine Einsätze' },
            { key: 'PLAN_PROBES', label: 'Meine Proben' }
        ],
        url: user?.calendarFeed?.token ? `${window.location.origin}/api/calendar/my/${user.calendarFeed.token}.ics` : ''
    });
    const [loadingCalendarFeed, setLoadingCalendarFeed] = useState(false);
    const [savingCalendarFeed, setSavingCalendarFeed] = useState(false);
    const [regeneratingCalendarToken, setRegeneratingCalendarToken] = useState(false);

    useEffect(() => {
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
        }
        // Sync preview when user object changes (e.g. after save)
        setPreview(user.optimizedProfileImage || user.profileImage || null);
        setCoverPreview(user.optimizedCoverImage || user.coverImage || null);
        setCoverColor(user.coverColor || '#a1ced9');
        setContactVisibility({
            emailPublic: Boolean(user?.contactVisibility?.emailPublic),
            phonePublic: Boolean(user?.contactVisibility?.phonePublic)
        });
        setClearProfileImage(false);
    }, [user]);

    const loadCalendarFeed = async () => {
        setLoadingCalendarFeed(true);
        try {
            const res = await api.get('/api/auth/calendar-feed');
            setCalendarFeed({
                token: res.data?.token || '',
                enabledSources: Array.isArray(res.data?.enabledSources) ? res.data.enabledSources : ['PLAN_ASSIGNMENTS', 'PLAN_PROBES'],
                availableSources: Array.isArray(res.data?.availableSources) ? res.data.availableSources : [],
                url: res.data?.url || ''
            });
        } catch (e) {
            showToast(e?.response?.data?.error || 'Kalender-Feed konnte nicht geladen werden.', 'error');
        } finally {
            setLoadingCalendarFeed(false);
        }
    };

    useEffect(() => {
        loadCalendarFeed();
    }, []);

    const handleImageChange = (e) => { 
        const file = e.target.files[0]; 
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast("Bild ist zu groß (max. 10MB).", "error");
            return;
        }
        setImage(file); 
        setClearProfileImage(false);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleClearProfileImage = () => {
        setImage(null);
        setPreview(null);
        setClearProfileImage(true);
    };

    const handleCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast("Titelbild ist zu groß (max. 10MB).", "error");
            return;
        }
        setCoverImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setCoverPreview(reader.result);
        reader.readAsDataURL(file);
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (savingProfile) return;
        if (phoneNumber && !isPhoneValid) return;
        setSavingProfile(true);
        const fd = new FormData();
        Object.keys(formData).forEach(k => fd.append(k, formData[k]));
        if (phoneNumber) fd.append('phone', countryCode + phoneNumber);
        if (image) fd.append('image', image);
        if (clearProfileImage) fd.append('clearProfileImage', 'true');
        if (coverImage) fd.append('coverImage', coverImage);
        fd.append('coverColor', coverColor);
        fd.append('contactVisibility', JSON.stringify(contactVisibility));
        fd.append('notifications', JSON.stringify(notifications));
        fd.append('theme', 'LIGHT');
        try {
            await onSave(fd);
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleNotification = async (key, channel) => {
        const current = notifications[key] || { app: true, whatsapp: true, email: false };
        const newVal = !current[channel];
        if (channel === 'email' && newVal && !String(formData.email || '').trim()) {
            showToast('Bitte zuerst eine E-Mail-Adresse im Profil hinterlegen.', 'error');
            return;
        }
        const updated = { ...notifications, [key]: { ...current, [channel]: newVal } };
        setNotifications(updated);
        try {
            await api.put('/api/auth/notifications', { key, channel, value: newVal });
        } catch (e) { console.error("Fehler beim Speichern der Benachrichtigung", e); }
    };

    const toggleCalendarSource = (sourceKey) => {
        const current = Array.isArray(calendarFeed.enabledSources) ? calendarFeed.enabledSources : [];
        if (current.includes(sourceKey)) {
            setCalendarFeed({
                ...calendarFeed,
                enabledSources: current.filter((key) => key !== sourceKey)
            });
            return;
        }
        setCalendarFeed({
            ...calendarFeed,
            enabledSources: [...current, sourceKey]
        });
    };

    const saveCalendarFeed = async () => {
        setSavingCalendarFeed(true);
        try {
            const res = await api.put('/api/auth/calendar-feed', {
                enabledSources: calendarFeed.enabledSources
            });
            setCalendarFeed({
                token: res.data?.token || '',
                enabledSources: Array.isArray(res.data?.enabledSources) ? res.data.enabledSources : [],
                availableSources: Array.isArray(res.data?.availableSources) ? res.data.availableSources : calendarFeed.availableSources,
                url: res.data?.url || calendarFeed.url
            });
            showToast('Kalender-Einstellungen gespeichert.', 'success');
        } catch (e) {
            showToast(e?.response?.data?.error || 'Kalender-Einstellungen konnten nicht gespeichert werden.', 'error');
        } finally {
            setSavingCalendarFeed(false);
        }
    };

    const regenerateCalendarToken = async () => {
        setRegeneratingCalendarToken(true);
        try {
            const res = await api.post('/api/auth/calendar-feed/regenerate');
            setCalendarFeed({
                token: res.data?.token || '',
                enabledSources: Array.isArray(res.data?.enabledSources) ? res.data.enabledSources : [],
                availableSources: Array.isArray(res.data?.availableSources) ? res.data.availableSources : calendarFeed.availableSources,
                url: res.data?.url || ''
            });
            showToast('Kalender-Link wurde neu erzeugt.', 'success');
        } catch (e) {
            showToast(e?.response?.data?.error || 'Token konnte nicht erneuert werden.', 'error');
        } finally {
            setRegeneratingCalendarToken(false);
        }
    };

    const copyCalendarFeedUrl = async () => {
        const url = String(calendarFeed.url || '').trim();
        if (!url) {
            showToast('Kein Kalender-Link verfügbar.', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            showToast('Kalender-Link kopiert.', 'success');
        } catch (_) {
            showToast('Kopieren fehlgeschlagen.', 'error');
        }
    };

    const notificationGroups = [
        { 
            title: 'Dienstplaner', 
            icon: <Calendar size={18} className="text-primary" />,
            items: [
                { key: 'plan_assigned', label: 'Dienst-Zuweisung', desc: 'Wenn du eingetragen wirst' },
                { key: 'plan_reminder', label: 'Dienst-Erinnerung', desc: 'Automatische Erinnerung vor deinem Dienst (flexibles Zeitfenster)' },
                { key: 'plan_changed', label: 'Termin-Änderung', desc: 'Bei Änderungen an deinen Diensten' },
                { key: 'substitute_request', label: 'Vertretungs-Anfragen', desc: 'Wenn jemand in deinem Team Hilfe braucht' }
            ]
        },
        { 
            title: 'Schwarzes Brett', 
            icon: <MessageSquare size={18} className="text-emerald-500" />,
            items: [
                { key: 'wall_new_post', label: 'Neue Beiträge', desc: 'Bei jedem neuen Beitrag im Schwarzen Brett' },
                { key: 'wall_comment', label: 'Kommentare', desc: 'Wenn jemand bei dir kommentiert' },
                { key: 'wall_like', label: 'Likes', desc: 'Wenn jemandem dein Post gefällt' }
            ]
        }
    ];

    if (user.role === 'ADMIN') {
        notificationGroups.push({
            title: 'System & Sicherheit',
            icon: <ShieldAlert size={18} className="text-destructive" />,
            items: [
                { key: 'system_critical', label: 'System-Fehler', desc: 'Kritische Probleme, Bot-Ausfälle und Admin-Alarm per E-Mail' },
                { key: 'security_alert', label: 'Sicherheits-Alarm', desc: 'IP-Sperren & Bedrohungen' }
            ]
        });
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl rounded-xl border">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Mein Profil</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Kontoeinstellungen verwalten.</DialogDescription>
                </DialogHeader>

                <div className="flex border-b bg-muted/10 p-1">
                    <button 
                        onClick={() => setActiveTab('profile')} 
                        className={cn(
                            "flex-1 py-2 text-xs font-semibold transition-colors rounded-lg",
                            activeTab === 'profile' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        Profil
                    </button>
                    <button 
                        onClick={() => setActiveTab('notifications')} 
                        className={cn(
                            "flex-1 py-2 text-xs font-semibold transition-colors rounded-lg",
                            activeTab === 'notifications' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        Mitteilungen
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={cn(
                            "flex-1 py-2 text-xs font-semibold transition-colors rounded-lg",
                            activeTab === 'calendar' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        Kalender
                    </button>
                </div>

                <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-6">
                    {activeTab === 'profile' ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex flex-col items-center gap-3 py-4 bg-muted/20 rounded-xl border border-dashed text-center">
                                <div className="relative group">
                                    <UserAvatar user={{ ...user, profileImage: preview, optimizedProfileImage: null }} size="xl" className="shadow-lg" />
                                    <label className="absolute inset-0 bg-primary/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                                        <ImageIcon className="text-white" size={24} />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </label>
                                </div>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Klicken zum Ändern</p>
                                {preview && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 px-3 text-[10px] font-semibold rounded-md"
                                        onClick={handleClearProfileImage}
                                    >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        Bild entfernen
                                    </Button>
                                )}
                            </div>

                            <Field className="space-y-3">
                                <FieldLabel>Titelbild</FieldLabel>
                                <div
                                    className={cn(
                                        "h-24 rounded-xl border border-dashed overflow-hidden",
                                        !coverPreview && "bg-muted/20"
                                    )}
                                    style={!coverPreview ? { backgroundColor: coverColor } : undefined}
                                >
                                    {coverPreview && (
                                        <img src={coverPreview} alt="Titelbild Vorschau" className="h-full w-full object-cover rounded-xl" />
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label className="inline-flex">
                                        <input type="file" className="hidden" accept="image/*" onChange={handleCoverImageChange} />
                                        <span className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[rgb(161,206,217)]/25 px-3 text-xs font-semibold cursor-pointer hover:bg-[rgb(161,206,217)]/35">
                                            Titelbild hochladen
                                        </span>
                                    </label>
                                    <div className="flex items-center gap-2 rounded-md border px-3 h-10 bg-white">
                                        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Farbe</span>
                                        <input
                                            type="color"
                                            value={coverColor}
                                            onChange={(e) => setCoverColor(e.target.value)}
                                            className="h-6 w-8 p-0 border-0 bg-transparent cursor-pointer"
                                            aria-label="Titelbild Farbe"
                                        />
                                        <span className="text-[10px] font-mono text-muted-foreground ml-auto uppercase">{coverColor}</span>
                                    </div>
                                </div>
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel htmlFor="firstName">Vorname</FieldLabel>
                                    <Input id="firstName" className="h-10 font-medium" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="lastName">Nachname</FieldLabel>
                                    <Input id="lastName" className="h-10 font-medium" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                                </Field>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="email">E-Mail</FieldLabel>
                                <Input id="email" type="email" className="h-10 font-medium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                            </Field>

                            <Field className="space-y-2">
                                <FieldLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Kontaktfreigabe</FieldLabel>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={contactVisibility.emailPublic ? "default" : "outline"}
                                        className="justify-start font-semibold"
                                        onClick={() => setContactVisibility(prev => ({ ...prev, emailPublic: !prev.emailPublic }))}
                                    >
                                        E-Mail: {contactVisibility.emailPublic ? 'Öffentlich' : 'Privat'}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={contactVisibility.phonePublic ? "default" : "outline"}
                                        className="justify-start font-semibold"
                                        onClick={() => setContactVisibility(prev => ({ ...prev, phonePublic: !prev.phonePublic }))}
                                    >
                                        WhatsApp: {contactVisibility.phonePublic ? 'Öffentlich' : 'Privat'}
                                    </Button>
                                </div>
                                <FieldDescription>Du entscheidest, ob andere Nutzer deine E-Mail und WhatsApp-Nummer im Steckbrief sehen dürfen.</FieldDescription>
                            </Field>

                            <Field className="grid gap-2">
                                <FieldLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Geburtstag</FieldLabel>
                                <DatePicker 
                                    value={formData.birthday} 
                                    onChange={val => setFormData({...formData, birthday: val})} 
                                    placeholder="Pick a date"
                                />
                            </Field>
                            
                            <PhoneInput 
                                label="WhatsApp Nummer"
                                countryCode={countryCode} setCountryCode={setCountryCode}
                                phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber}
                                onValidationChange={setIsPhoneValid}
                            />

                            <Button 
                                disabled={(phoneNumber && !isPhoneValid) || savingProfile}
                                loading={savingProfile}
                                type="submit" 
                                className="w-full"
                            >
                                {!savingProfile && <Check className="mr-2 h-4 w-4" />} PROFIL SPEICHERN
                            </Button>
                        </form>
                    ) : activeTab === 'notifications' ? (
                        <div className="space-y-8 py-2">
                            {notificationGroups.map((group, gIdx) => (
                                <div key={`notif-group-${group.title}-${gIdx}`} className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-normal border-b pb-2">
                                        {group.icon} {group.title}
                                    </h4>
                                    <div className="space-y-3">
                                        {group.items.map((item, iIdx) => {
                                            const pref = notifications[item.key] || { app: true, whatsapp: true, email: false };
                                            return (
                                                <div key={`notif-item-${item.key}-${iIdx}`} className="flex justify-between items-center gap-4 py-1">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <p className="text-sm font-semibold truncate">{item.label}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <Button 
                                                            size="sm" 
                                                            variant={pref.app ? "default" : "outline"} 
                                                            className="h-7 px-3 text-[10px] font-bold rounded-md"
                                                            onClick={() => toggleNotification(item.key, 'app')}
                                                        >
                                                            Portal
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant={pref.whatsapp ? "success" : "outline"} 
                                                            className="h-7 px-3 text-[10px] font-bold rounded-md"
                                                            onClick={() => toggleNotification(item.key, 'whatsapp')}
                                                        >
                                                            WhatsApp
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant={pref.email ? "secondary" : "outline"} 
                                                            className="h-7 px-3 text-[10px] font-bold rounded-md"
                                                            onClick={() => toggleNotification(item.key, 'email')}
                                                        >
                                                            E-Mail
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6 py-2">
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Persönlicher iCal Feed</p>
                                <p className="text-xs text-muted-foreground">
                                    Abonniere den Link einmal in deinem Kalender. Änderungen an deinen Einsätzen werden automatisch übernommen.
                                </p>
                            </div>

                            {loadingCalendarFeed ? (
                                <div className="h-24 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-primary" size={20} />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Field className="space-y-2">
                                        <FieldLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Event-Typen</FieldLabel>
                                        <div className="space-y-2">
                                            {(calendarFeed.availableSources || []).map((source) => (
                                                <Button
                                                    key={source.key}
                                                    type="button"
                                                    size="sm"
                                                    variant={(calendarFeed.enabledSources || []).includes(source.key) ? "default" : "outline"}
                                                    className="w-full justify-start font-semibold"
                                                    onClick={() => toggleCalendarSource(source.key)}
                                                >
                                                    {source.label || source.key}
                                                </Button>
                                            ))}
                                        </div>
                                        <FieldDescription>
                                            Du kannst später weitere Event-Typen aktivieren, sobald neue Kalenderquellen verfügbar sind.
                                        </FieldDescription>
                                    </Field>

                                    <Field className="space-y-2">
                                        <FieldLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Abo-Link</FieldLabel>
                                        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs font-mono break-all">
                                            {calendarFeed.url || 'Wird geladen...'}
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button type="button" variant="outline" className="flex-1" onClick={copyCalendarFeedUrl}>
                                                <Copy size={14} className="mr-2" /> Link kopieren
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="flex-1"
                                                disabled={regeneratingCalendarToken}
                                                onClick={regenerateCalendarToken}
                                            >
                                                {regeneratingCalendarToken ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
                                                Link neu erzeugen
                                            </Button>
                                        </div>
                                    </Field>

                                    <Button
                                        type="button"
                                        className="w-full"
                                        disabled={savingCalendarFeed}
                                        onClick={saveCalendarFeed}
                                    >
                                        {savingCalendarFeed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Kalender-Einstellungen speichern
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

const FirstLoginWizard = ({ user, showToast, onComplete }) => {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(user?.optimizedProfileImage || user?.profileImage || null);
    const [email, setEmail] = useState(user?.email || '');
    const [birthday, setBirthday] = useState(user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '');
    const onboardingNotificationItems = [
        { key: 'plan_assigned', label: 'Dienst-Zuweisung' },
        { key: 'plan_reminder', label: 'Dienst-Erinnerung' },
        { key: 'plan_changed', label: 'Termin-Änderung' },
        { key: 'substitute_request', label: 'Vertretungs-Anfragen' },
        { key: 'wall_new_post', label: 'Neue Beiträge' },
        { key: 'wall_comment', label: 'Kommentare' },
        { key: 'wall_like', label: 'Likes' }
    ];
    const [onboardingNotifications, setOnboardingNotifications] = useState(() => {
        const fromUser = user?.notifications || {};
        const base = {};
        onboardingNotificationItems.forEach((item) => {
            const current = fromUser[item.key] || {};
            base[item.key] = {
                app: true,
                whatsapp: current.whatsapp ?? true,
                email: current.email ?? false
            };
        });
        return base;
    });

    const toggleOnboardingNotification = (key, channel) => {
        if (channel === 'email' && !String(email || '').trim()) {
            showToast('Bitte zuerst eine E-Mail-Adresse eintragen, um E-Mail-Benachrichtigungen zu aktivieren.', 'error');
            return;
        }
        setOnboardingNotifications((prev) => {
            const current = prev[key] || { app: true, whatsapp: true, email: false };
            return {
                ...prev,
                [key]: {
                    ...current,
                    [channel]: !current[channel]
                }
            };
        });
    };

    const completeWizard = async ({ skipAll = false } = {}) => {
        setSaving(true);
        try {
            const fd = new FormData();
            if (email) fd.append('email', email);
            if (birthday) fd.append('birthday', birthday);
            if (image) fd.append('image', image);
            fd.append('notifications', JSON.stringify(onboardingNotifications));
            fd.append('onboardingCompleted', 'true');
            fd.append('onboardingSkipped', skipAll ? 'true' : 'false');
            await onComplete(fd, skipAll);
        } finally {
            setSaving(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast("Bild ist zu groß (max. 10MB).", "error");
            return;
        }
        setImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(file);
    };

    return (
        <Dialog open={true}>
            <DialogContent showClose={false} className="w-[95vw] sm:max-w-lg max-h-[92vh] p-0 overflow-hidden rounded-xl flex flex-col">
                <DialogHeader className="p-6 border-b bg-muted/30">
                    <div className="flex flex-col items-center sm:items-start">
                        <div className="inline-flex flex-col items-center sm:items-start leading-none">
                            <span className="text-[1.04rem] font-bold tracking-[0.08em] uppercase">
                                <span className="text-[rgb(161,206,217)]">EFG</span>{' '}
                                <span className="text-[rgb(237,132,91)]">Neckarsulm</span>
                            </span>
                            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Portal</span>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-4 sm:p-8 space-y-6 overflow-y-auto flex-1 min-h-0">
                    {step === 1 && (
                        <Card className="border-dashed">
                            <CardContent className="p-6 text-center space-y-3">
                                <UserPlus size={28} className="mx-auto text-primary" />
                                <h3 className="text-lg font-bold">Willkommen {user?.firstName || user?.username}!</h3>
                                <p className="text-sm text-muted-foreground font-medium">
                                    Schön, dass du da bist. Wir helfen dir kurz beim Start im internen Portal der Gemeinde.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {step === 2 && (
                        <Card className="border-dashed">
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-base font-bold flex items-center gap-2"><ImageIcon size={16} /> Profilbild (optional)</h3>
                                <div className="flex flex-col items-center gap-3 py-4 bg-muted/20 rounded-xl border border-dashed text-center">
                                    <div className="relative group">
                                        <Avatar className="h-24 w-24 shadow-lg">
                                            <AvatarImage src={preview || ''} className="object-cover object-center" />
                                            <AvatarFallback>{(user?.firstName || user?.username || '?')[0]}</AvatarFallback>
                                        </Avatar>
                                        <label className="absolute inset-0 bg-primary/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                                            <Camera className="text-white" size={20} />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                    <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Bild hochladen</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === 3 && (
                        <Card className="border-dashed">
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-base font-bold">Kontaktdaten (optional)</h3>
                                <p className="text-sm text-muted-foreground font-medium">
                                    Hinterlege E-Mail und Geburtstag, damit wir dich künftig besser kontaktieren können.
                                </p>
                                <Field className="space-y-2">
                                    <FieldLabel htmlFor="onboarding-email" className="flex items-center gap-2"><Mail size={14} /> E-Mail</FieldLabel>
                                    <Input id="onboarding-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" />
                                </Field>
                                <DatePickerSimple value={birthday} onChange={setBirthday} />
                            </CardContent>
                        </Card>
                    )}

                    {step === 4 && (
                        <Card className="border-dashed">
                            <CardContent className="p-4 sm:p-5 space-y-3">
                                <h3 className="text-base font-bold flex items-center gap-2"><Bell size={16} /> Benachrichtigungen</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                                    Wir informieren dich über wichtige Ereignisse, z.B. wenn du für einen Dienst eingeteilt wirst. WhatsApp ist standardmäßig aktiv.
                                </p>
                                {!String(email || '').trim() && (
                                    <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] sm:text-xs font-medium text-amber-900">
                                        Für E-Mail-Benachrichtigungen bitte zuerst im Schritt „Kontaktdaten“ eine E-Mail-Adresse eintragen.
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    {onboardingNotificationItems.map((item) => {
                                        const pref = onboardingNotifications[item.key] || { app: true, whatsapp: true, email: false };
                                        return (
                                            <div key={`onboarding-notif-${item.key}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5">
                                                <p className="truncate pr-2 text-[10px] sm:text-[11px] font-semibold leading-tight" title={item.label}>{item.label}</p>
                                                <div className="flex w-[152px] shrink-0 justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant={pref.whatsapp ? "success" : "outline"}
                                                        className="h-6 w-[84px] px-2 text-[8px] sm:text-[9px] font-bold whitespace-nowrap"
                                                        onClick={() => toggleOnboardingNotification(item.key, 'whatsapp')}
                                                    >
                                                        WhatsApp
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={pref.email ? "secondary" : "outline"}
                                                        className="h-6 w-[64px] px-1 text-[9px] sm:text-[10px] font-bold whitespace-nowrap"
                                                        onClick={() => toggleOnboardingNotification(item.key, 'email')}
                                                    >
                                                        E-Mail
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className={cn(
                        "sticky bottom-0 z-10 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 gap-2",
                        step === 4 ? "flex flex-row items-center justify-between" : "flex flex-col-reverse sm:flex-row sm:justify-between"
                    )}>
                        {step > 1 && (
                            <Button
                                variant="ghost"
                                className={step === 4 ? "h-9" : undefined}
                                onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
                                disabled={saving}
                            >
                                Zurück
                            </Button>
                        )}

                        <div className="flex w-full justify-end gap-2 sm:w-auto sm:ml-auto">
                            {step > 1 && step < 4 && (
                                <Button variant="outline" onClick={() => setStep((prev) => prev + 1)} disabled={saving}>
                                    Diesen Schritt überspringen
                                </Button>
                            )}

                            {step === 1 && (
                                <Button onClick={() => setStep(2)} disabled={saving}>
                                    Weiter
                                </Button>
                            )}

                            {step === 2 && (
                                <Button onClick={() => setStep(3)} disabled={saving}>
                                    Weiter
                                </Button>
                            )}

                            {step === 3 && (
                                <Button onClick={() => setStep(4)} disabled={saving}>
                                    Weiter
                                </Button>
                            )}

                            {step === 4 && (
                                <Button className="h-9" onClick={() => completeWizard()} disabled={saving}>
                                    {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Check className="mr-2 h-4 w-4" />}
                                    Profil abschließen
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ChannelWallRoute = ({ user, showConfirm, showPrompt, showAlert, showToast }) => {
    const { channelId } = useParams();
    return (
        <div className="max-w-3xl mx-auto">
            <CommunityWall
                currentUser={user}
                showConfirm={showConfirm}
                showPrompt={showPrompt}
                showAlert={showAlert}
                showToast={showToast}
                forcedChannelId={channelId}
                hideChannelFilters
            />
        </div>
    );
};

const GlobalSearch = ({ user, open, onOpenChange }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState({ users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });

    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults({ users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });
            return;
        }
        const q = query.trim();
        if (q.length < 2) {
            setResults({ users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });
            setLoading(false);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
                setResults(res.data || { users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });
            } catch {
                setResults({ users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });
            } finally {
                setLoading(false);
            }
        }, 220);
        return () => clearTimeout(timer);
    }, [query, open]);

    const onSelect = (href) => {
        onOpenChange(false);
        navigate(href);
    };

    if (!user) return null;

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={{ shouldFilter: false, className: "flex min-h-0 flex-1 flex-col" }}>
            <CommandInput
                wrapperClassName="mx-3 mt-1 mb-2 rounded-xl border border-border/70 bg-muted/20 px-3"
                className="h-10 py-2 text-base sm:text-sm"
                placeholder="Suche nach Benutzern, Kanälen, Beiträgen, Dienstplänen und Tools..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto px-1 pb-3">
                {loading && <div className="p-4 text-xs text-muted-foreground">Suche läuft...</div>}
                {!loading && query.trim().length >= 2 && (
                    <>
                        <CommandEmpty>Keine Treffer.</CommandEmpty>

                        {results.users?.length > 0 && (
                            <CommandGroup heading="Benutzer">
                                {results.users.map((item) => (
                                    <CommandItem key={`user-${item.id}`} onSelect={() => onSelect(item.href)}>
                                        <User className="mr-2 h-4 w-4" /> {item.title} <span className="ml-2 text-xs text-muted-foreground">{item.subtitle}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {results.channels?.length > 0 && (
                            <CommandGroup heading="Kanäle">
                                {results.channels.map((item) => (
                                    <CommandItem key={`channel-${item.id}`} onSelect={() => onSelect(item.href)}>
                                        <ListMusic className="mr-2 h-4 w-4" /> {item.title}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {results.posts?.length > 0 && (
                            <CommandGroup heading="Beiträge">
                                {results.posts.map((item) => (
                                    <CommandItem key={`post-${item.id}`} onSelect={() => onSelect(item.href)}>
                                        <MessageSquare className="mr-2 h-4 w-4" /> {item.title}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {results.plans?.length > 0 && (
                            <CommandGroup heading="Dienstplan">
                                {results.plans.map((item) => (
                                    <CommandItem key={`plan-${item.id}`} onSelect={() => onSelect(item.href)}>
                                        <Calendar className="mr-2 h-4 w-4" /> {item.title}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {results.tools?.length > 0 && (
                            <CommandGroup heading="Tools">
                                {results.tools.map((item) => (
                                    <CommandItem key={`tool-${item.id}`} onSelect={() => onSelect(item.href)}>
                                        <Settings className="mr-2 h-4 w-4" /> {item.title} <span className="ml-2 text-xs text-muted-foreground">{item.subtitle}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
};

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [messengerUsers, setMessengerUsers] = useState([]);
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [theme, setTheme] = useState('LIGHT');
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);

    const onlineUsersCount = useMemo(() => {
        if (!Array.isArray(messengerUsers)) return 0;
        return messengerUsers.filter(u => u.isOnline && u.username !== user?.username).length;
    }, [messengerUsers, user]);

    const onlineUsers = useMemo(() => {
        if (!Array.isArray(messengerUsers)) return [];
        return messengerUsers.filter(u => u.isOnline && u.username !== user?.username);
    }, [messengerUsers, user]);

    useEffect(() => {
        const handler = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setShowGlobalSearch(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (user && !socket) {
            console.log("[socket] Initializing socket connection...");
            const newSocket = io(window.location.origin, {
                path: '/socket.io/',
                transports: ['polling', 'websocket'] 
            });

            newSocket.on('connect', () => {
                console.log("[socket] Connected successfully");
                // Update local status immediately
                setMessengerUsers(prev => prev.map(u => u.username === user.username ? { ...u, isOnline: true } : u));
                setUser(prev => prev ? { ...prev, isOnline: true, lastSeen: new Date().toISOString() } : prev);
            });

            newSocket.on('user_status_change', (data) => {
                setMessengerUsers(prev => prev.map(u => u._id === data.userId ? { ...u, ...data } : u));
                setUser(prev => (
                    prev && String(prev.id || prev._id) === String(data.userId)
                        ? { ...prev, isOnline: data.isOnline, lastSeen: data.lastSeen || prev.lastSeen }
                        : prev
                ));
            });

            newSocket.on('connect_error', (err) => {
                console.error("[socket] Connection error:", err.message);
            });

            setSocket(newSocket);
            return () => {
                console.log("[socket] Closing socket...");
                newSocket.close();
            };
        } else if (!user && socket) {
            socket.close();
            setSocket(null);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchMessengerUsers();
        }
    }, [user]);

    const fetchMessengerUsers = async () => {
        try {
            const res = await api.get('/api/users/messenger');
            setMessengerUsers(res.data);
        } catch (e) { console.error(e); }
    };
    const [showLogin, setShowLogin] = useState(false);
    const [loginRedirectPath, setLoginRedirectPath] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('ui:sidebar-collapsed') === '1';
        } catch (_) {
            return false;
        }
    });
    const [status, setStatus] = useState({ connected: false });
    const [jobs, setJobs] = useState([]);
    const [recentJobLogs, setRecentJobLogs] = useState({ logs: [], total: 0, pages: 0, currentPage: 1 });
    const [logPage, setLogPage] = useState(1);
    const [groups, setGroups] = useState([]);
    const [plan, setPlan] = useState([]);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [filterMe, setFilterMe] = useState(false);
    const [plannerView, setPlannerView] = useState('list');
    const [plannerCalendarMode, setPlannerCalendarMode] = useState('week');
    const [plannerCalendarAnchor, setPlannerCalendarAnchor] = useState(startOfToday());
    const [showPastPlans, setShowPastPlans] = useState(false);
    const [pastPlansVisibleCount, setPastPlansVisibleCount] = useState(6);
    const [highlightedPlanEntryId, setHighlightedPlanEntryId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const showScrollTopRef = useRef(false);
    const mainScrollRef = useRef(null);
    const planScrollRestoreRef = useRef(null);
    const [dialog, setDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger', isPrompt: false, placeholder: '', defaultValue: '', isAlert: false });
    const [promptValue, setPromptValue] = useState('');
    const [detailsModal, setDetailsModal] = useState({ show: false, title: '', data: null });
    const [editEntry, setEditEntry] = useState(null);
    const [jobForm, setJobForm] = useState({ name: '', type: 'PLAN_UPDATE', mode: 'recurring', weekdays: ['*'], hour: '10', minute: '00', params: { targetJid: '' } });
    const [showBulkPlanModal, setShowBulkPlanModal] = useState(false);
    const [bulkPlanFrom, setBulkPlanFrom] = useState('');
    const [bulkPlanTo, setBulkPlanTo] = useState('');
    const [bulkPlanOverwrite, setBulkPlanOverwrite] = useState(false);
    const [bulkPlanCreateMode, setBulkPlanCreateMode] = useState('both');
    const [generatingBulkPlan, setGeneratingBulkPlan] = useState(false);
    const buildIdRef = useRef(null);
    const updateToastShownRef = useRef(false);

    const toDateInputValue = (date) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    const showToast = (message, type = 'info') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error' || type === 'danger') toast.error(message);
        else if (type === 'warning') toast.warning(message);
        else toast.info(message);
    };
    const showConfirm = (title, message, onConfirm, type = 'danger') => { setDialog({ show: true, title, message, onConfirm, type, isPrompt: false, isAlert: false }); };
    const showPrompt = (title, message, placeholder, defaultValue, onConfirm) => { setPromptValue(defaultValue || ''); setDialog({ show: true, title, message, onConfirm: (val) => onConfirm(val), type: 'info', isPrompt: true, placeholder, isAlert: false }); };
    const showAlert = (title, message, type = 'info') => { 
        if (type === 'success') toast.success(title, { description: message });
        else if (type === 'error' || type === 'danger') toast.error(title, { description: message });
        else if (type === 'warning') toast.warning(title, { description: message });
        else toast.info(title, { description: message });
    };
    const showDetails = (title, data) => { setDetailsModal({ show: true, title, data }); };
    const requestLoginWithRedirect = (path) => {
        const target = path || `${location.pathname || '/'}${location.search || ''}`;
        setLoginRedirectPath(target);
        setShowLogin(true);
    };

    const capturePlanScrollPosition = () => {
        const container = mainScrollRef.current;
        planScrollRestoreRef.current = {
            windowY: window.scrollY || 0,
            containerY: container ? container.scrollTop : 0
        };
    };

    const restorePlanScrollPosition = () => {
        const restore = planScrollRestoreRef.current;
        if (!restore) return;
        const container = mainScrollRef.current;
        requestAnimationFrame(() => {
            window.scrollTo({ top: restore.windowY, behavior: 'auto' });
            if (container) container.scrollTop = restore.containerY;
            requestAnimationFrame(() => {
                window.scrollTo({ top: restore.windowY, behavior: 'auto' });
                if (container) container.scrollTop = restore.containerY;
                planScrollRestoreRef.current = null;
            });
        });
    };
    const resetScrollToTop = () => {
        const mainEl = document.querySelector('main');
        mainEl?.scrollTo({ top: 0, behavior: 'auto' });
        window.scrollTo({ top: 0, behavior: 'auto' });
        if (document?.documentElement) document.documentElement.scrollTop = 0;
        if (document?.body) document.body.scrollTop = 0;
    };

    const handleUpdateProfile = async (data) => { 
        try { 
            await api.put('/api/auth/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }); 
            await checkAuth(); 
            setShowProfileModal(false); 
            showToast("Profil aktualisiert", "success"); 
        } catch (e) { 
            showToast(e.response?.data?.error || "Update fehlgeschlagen", "error"); 
        } 
    };

    const handleCompleteOnboarding = async (data, skipped = false) => {
        try {
            await api.put('/api/auth/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            await checkAuth();
            setShowOnboardingWizard(false);
            showToast(skipped ? "Onboarding übersprungen. Du kannst alles später im Profil ergänzen." : "Profil eingerichtet. Willkommen im Portal!", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Onboarding konnte nicht gespeichert werden", "error");
        }
    };
    
    const handleSaveJob = async (finalJob) => {
        try {
            if (jobForm.id) await api.put(`/api/jobs/${jobForm.id}`, finalJob);
            else await api.post('/api/jobs', finalJob);
            setShowModal(false);
            fetchBotData();
            showToast("Gespeichert", "success");
        } catch (e) { showToast("Fehler", "error"); }
    };

    const checkAuth = async () => {
        try { 
            const res = await api.get('/api/auth/me'); 
            setUser(res.data.user); 
            setTheme('LIGHT');
            setShowOnboardingWizard(res.data.user.onboardingCompleted === false);
            setShowLogin(false); 
        } catch (e) { 
            if (e.response && e.response.status === 401) {
                setUser(null); 
                setShowOnboardingWizard(false);
            }
            console.error("Auth-Check fehlgeschlagen:", e.message);
        } finally { setIsAppLoading(false); } 
    };

    const fetchAllUsers = async () => {
        try {
            const res = await api.get('/api/users');
            setAllUsers(res.data);
        } catch (e) {}
    };

    useEffect(() => {
        if (user) fetchAllUsers();
    }, [user]);

    useEffect(() => { 
        checkAuth(); 
        const authInterval = setInterval(checkAuth, 5 * 60 * 1000);
        return () => clearInterval(authInterval);
    }, []);

    useEffect(() => {
        let stopped = false;
        const checkVersion = async () => {
            try {
                const res = await api.get('/api/version');
                const nextBuildId = String(res.data?.buildId || '').trim();
                if (!nextBuildId) return;
                if (!buildIdRef.current) {
                    buildIdRef.current = nextBuildId;
                    return;
                }
                if (buildIdRef.current !== nextBuildId && !updateToastShownRef.current) {
                    updateToastShownRef.current = true;
                    toast.info('Neue Version verfügbar', {
                        description: 'Bitte Seite neu laden, um die aktuelle Version zu nutzen.',
                        duration: Infinity,
                        action: {
                            label: 'Neu laden',
                            onClick: () => window.location.reload()
                        }
                    });
                }
            } catch (_e) {}
        };

        checkVersion();
        const timer = setInterval(() => {
            if (!stopped) checkVersion();
        }, 60000);

        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, []);

    const fetchUnreadCount = async () => {
        if (!user) return;
        try {
            const res = await api.get('/api/notifications');
            setUnreadNotifications(res.data.filter(n => !n.read).length);
            window.dispatchEvent(new CustomEvent('notifications-refreshed', { detail: res.data }));
        } catch (e) {}
    };

    const fetchUnreadChatCount = async () => {
        if (!user) return;
        try {
            const res = await api.get('/api/chat/unread-count');
            setUnreadMessages(res.data.count);
        } catch (e) {}
    };

    useEffect(() => {
        if (socket) {
            const handleNewMsgCount = () => fetchUnreadChatCount();
            socket.on('new_message', handleNewMsgCount);
            // Also when user marks as read, we should refresh count
            window.addEventListener('chat-read', handleNewMsgCount);
            return () => {
                socket.off('new_message', handleNewMsgCount);
                window.removeEventListener('chat-read', handleNewMsgCount);
            };
        }
    }, [socket]);

    useEffect(() => {
        fetchUnreadCount();
        fetchUnreadChatCount();
        const interval = setInterval(() => {
            fetchUnreadCount();
            fetchUnreadChatCount();
        }, 60000);
        let eventSource;
        if (user) {
            eventSource = new EventSource('/api/notifications/stream');
            eventSource.onmessage = (event) => {
                const notif = JSON.parse(event.data);
                if (!notif.read) {
                    fetchUnreadCount();
                    showToast(`Hinweis: ${notif.title}`, "info");
                }
            };
            eventSource.onerror = () => {
                eventSource.close();
                setTimeout(() => { if(user) eventSource = new EventSource('/api/notifications/stream'); }, 5000);
            };
        }
        return () => { clearInterval(interval); if (eventSource) eventSource.close(); };
    }, [user]);
    
    useEffect(() => {
        if (canView('BOT_CONTROL')) {
            const fetchStatus = async () => {
                try {
                    const res = await api.get('/api/whatsapp/status');
                    setStatus(res.data || { connected: false });
                } catch (e) {}
            };
            fetchStatus();
            const interval = setInterval(fetchStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("dark");
        root.classList.add("light");
    }, [theme]);

    const handleLogout = async () => { try { await api.post('/api/auth/logout'); } catch(e) {} setUser(null); navigate('/'); showToast("Abgemeldet"); };
    const handleRolePreviewSwitch = async (roleName) => {
        try {
            await api.post('/api/auth/view-role', { roleName });
            await checkAuth();
            navigate('/');
            showToast(`Ansicht gewechselt: ${formatRoleLabel(roleName)}`, "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Rollenwechsel fehlgeschlagen", "error");
        }
    };
    const handleRolePreviewReset = async () => {
        try {
            await api.post('/api/auth/view-role/reset');
            await checkAuth();
            navigate('/');
            showToast("Zurück zur Admin-Ansicht", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Zurücksetzen fehlgeschlagen", "error");
        }
    };
    const triggerOnboardingDebug = async () => {
        if (!user?._id) return;
        try {
            await api.post(`/api/users/${user._id}/onboarding-debug`);
            await checkAuth();
            setShowOnboardingWizard(true);
            setUserMenuOpen(false);
            setMobileActionsOpen(false);
            showToast("First-Login Debug gestartet.", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Debug-Trigger fehlgeschlagen", "error");
        }
    };

    const loadPlan = async (silent = false) => { 
        if (!silent) setLoadingPlan(true); 
        try { 
            const res = await api.get(`/api/plan`); 
            setPlan(res.data.plan); 
        } catch (e) {} finally { if (!silent) setLoadingPlan(false); } 
    };

    const fetchBotData = async (page = 1) => { 
        if (!canView('BOT_CONTROL')) return; 
        try {
            const res = await api.get('/api/whatsapp/status');
            setStatus(res.data || { connected: false });
        } catch (e) { setStatus({ connected: false }); }
        try {
            const [j, jl, g] = await Promise.all([
                api.get('/api/jobs'), 
                api.get(`/api/jobs/logs/recent?page=${page}&limit=10`), 
                api.get('/api/whatsapp/groups').catch(() => ({ data: { groups: [] } }))
            ]); 
            setJobs(j.data || []); 
            setRecentJobLogs(jl.data || { logs: [], total: 0, pages: 0, currentPage: 1 }); 
            setGroups(g.data?.groups || []); 
        } catch (e) {}
    };

    useEffect(() => { 
        if (canView('BOT_CONTROL') && (location.pathname === '/admin/bot' || location.pathname === '/admin/jobs')) { 
            fetchBotData(logPage); 
            const interval = setInterval(() => fetchBotData(logPage), 10000); 
            return () => clearInterval(interval); 
        } 
    }, [user, location.pathname, logPage]);
    useEffect(() => {
        if (!user) return;
        if (!canView('MUSIC_PLANER')) return;
        if (location.pathname !== '/dienstplaner') return;
        loadPlan();
    }, [user, location.pathname]);

    useEffect(() => {
        const pulse = () => api.get('/api/pulse').catch(() => {});
        pulse();
        const interval = setInterval(pulse, 30000);
        return () => clearInterval(interval);
    }, []);

    const savePlanEntry = async (data) => { 
        try { 
            capturePlanScrollPosition();
            if (data.id || data._id) { 
                await api.put(`/api/plan/${data.id || data._id}`, { data }); 
            } else { 
                await api.post('/api/plan', { data }); 
            } 
            setShowPlanModal(false); 
            setEditEntry(null); 
            await loadPlan(true);
            restorePlanScrollPosition();
            showToast("Gespeichert", "success"); 
        } catch (e) { 
            showToast("Fehler beim Speichern", "error"); 
        } 
    };
    const deletePlanEntry = async (id) => { showConfirm("Termin löschen", "Möchtest du diesen Termin wirklich entfernen?", async () => { try { await api.delete(`/api/plan/${id}`); loadPlan(); showToast("Termin gelöscht", "success"); } catch (e) { showToast("Fehler beim Löschen", "error"); } }); };
    const openPlanDetailView = async (entry) => {
        const entryId = String(entry?._id || entry?.id || '').trim();
        if (!entryId) {
            showToast("Termin konnte nicht geöffnet werden.", "error");
            return;
        }
        navigate(`/dienstplaner/detail/${entryId}`);
    };
    const openBulkPlanModal = () => {
        const now = new Date();
        const plusSixMonths = new Date(now);
        plusSixMonths.setMonth(plusSixMonths.getMonth() + 6);
        setBulkPlanFrom(toDateInputValue(now));
        setBulkPlanTo(toDateInputValue(plusSixMonths));
        setBulkPlanOverwrite(false);
        setBulkPlanCreateMode('both');
        setShowBulkPlanModal(true);
    };
    const generateBulkPlanShells = async () => {
        if (!bulkPlanFrom || !bulkPlanTo) {
            showToast("Bitte Start- und Enddatum angeben.", "error");
            return;
        }
        setGeneratingBulkPlan(true);
        try {
            const res = await api.post('/api/plan/bulk-shells', {
                from: bulkPlanFrom,
                to: bulkPlanTo,
                overwriteExisting: bulkPlanOverwrite,
                createMode: bulkPlanCreateMode
            });
            const created = Number(res.data?.createdCount || 0);
            const overwritten = Number(res.data?.overwrittenCount || 0);
            const skipped = Number(res.data?.skippedExisting || 0);
            showToast(`Massenanlage abgeschlossen: ${created} neu, ${overwritten} aktualisiert, ${skipped} übersprungen.`, (created + overwritten) > 0 ? "success" : "info");
            setShowBulkPlanModal(false);
            loadPlan();
        } catch (e) {
            showToast(e.response?.data?.error || "Massenanlage fehlgeschlagen", "error");
        } finally {
            setGeneratingBulkPlan(false);
        }
    };

    const canView = (key) => {
        if (user) return user.role === 'ADMIN' || user.permissions?.some(p => p.key === key && p.canView);
        return false;
    };
    const canEdit = (key) => {
        if (user) return user.role === 'ADMIN' || user.permissions?.some(p => p.key === key && p.canEdit);
        return false;
    };

    const filteredPlan = useMemo(() => {
        if (!Array.isArray(plan)) return [];
        return plan.filter(entry => {
            if (!filterMe || !user) return true;
            const username = user.username.toLowerCase();
            return Object.values(entry).some(val => typeof val === 'string' && val.toLowerCase() === username);
        });
    }, [plan, filterMe, user]);

    const myServices = useMemo(() => {
        if (!user?.username || !Array.isArray(plan)) return [];
        const username = String(user.username).trim().toLowerCase();
        const roleKeys = Object.keys(ROLE_ICONS);
        const services = [];

        plan.forEach((entry) => {
            roleKeys.forEach((roleKey) => {
                const rawValue = String(entry?.[roleKey] || '').trim();
                if (!rawValue || rawValue === '/') return;
                if (rawValue.toLowerCase() !== username) return;
                services.push({
                    entryId: entry?._id || entry?.id || `${entry?.Datum || 'unknown'}-${roleKey}`,
                    roleKey,
                    roleLabel: getRoleLabel(roleKey),
                    datum: entry?.Datum || '',
                    uhrzeit: entry?.Uhrzeit || '10:30 Uhr',
                    typ: entry?.Typ || 'Gottesdienst',
                    thema: entry?.Thema || ''
                });
            });
        });

        services.sort((a, b) => {
            const aDate = parsePlanDate(a?.datum);
            const bDate = parsePlanDate(b?.datum);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });

        return services;
    }, [plan, user?.username]);

    const downloadMyServicesIcs = () => {
        if (!myServices.length) {
            showToast('Keine Dienste zum Exportieren vorhanden.', 'error');
            return;
        }

        const now = new Date();
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//EFG NSU Portal//Meine Dienste//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        myServices.forEach((service, index) => {
            const date = parsePlanDate(service.datum);
            if (!date) return;
            const { hour, minute } = parsePlanTime(service.uhrzeit);
            const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0);
            const end = new Date(start.getTime() + (2 * 60 * 60 * 1000));
            const uid = `${String(service.entryId)}-${service.roleKey}-${index}@efg-nsu-portal`;
            const summary = `${service.roleLabel} - ${service.typ}`;
            const descriptionParts = [
                `Dienst: ${service.roleLabel}`,
                service.thema ? `Thema: ${service.thema}` : '',
                `Datum: ${service.datum}`,
                `Uhrzeit: ${service.uhrzeit}`
            ].filter(Boolean);

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${escapeIcsText(uid)}`);
            lines.push(`DTSTAMP:${formatIcsDateTimeLocal(now)}`);
            lines.push(`DTSTART:${formatIcsDateTimeLocal(start)}`);
            lines.push(`DTEND:${formatIcsDateTimeLocal(end)}`);
            lines.push(`SUMMARY:${escapeIcsText(summary)}`);
            lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');

        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        link.href = url;
        link.download = `meine-dienste-${datePart}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('iCal Export erstellt.', 'success');
    };

    const todayDate = useMemo(() => startOfToday(), []);

    const { upcomingPlanEntries, pastPlanEntries } = useMemo(() => {
        const upcoming = [];
        const past = [];

        filteredPlan.forEach((entry) => {
            const parsedDate = parsePlanDate(entry?.Datum);
            if (!parsedDate) {
                upcoming.push(entry);
                return;
            }
            if (parsedDate >= todayDate) {
                upcoming.push(entry);
            } else {
                past.push(entry);
            }
        });

        upcoming.sort((a, b) => {
            const aDate = parsePlanDate(a?.Datum);
            const bDate = parsePlanDate(b?.Datum);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });

        past.sort((a, b) => {
            const aDate = parsePlanDate(a?.Datum);
            const bDate = parsePlanDate(b?.Datum);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return bDate - aDate;
        });

        return { upcomingPlanEntries: upcoming, pastPlanEntries: past };
    }, [filteredPlan, todayDate]);

    useEffect(() => {
        setPastPlansVisibleCount(6);
    }, [filterMe, plan.length]);

    const visiblePastPlanEntries = useMemo(
        () => pastPlanEntries.slice(0, pastPlansVisibleCount),
        [pastPlanEntries, pastPlansVisibleCount]
    );

    const calendarPlanEntries = useMemo(() => {
        return [...filteredPlan].sort((a, b) => {
            const aDate = parsePlanDate(a?.Datum);
            const bDate = parsePlanDate(b?.Datum);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });
    }, [filteredPlan]);

    const openPlanEntryFromOverview = (entryId) => {
        const target = String(entryId || '').trim();
        if (!target) return;
        setFilterMe(false);
        setPlannerView('list');
        navigate(`/dienstplaner?entry=${target}`);
    };

    const plannerTargetEntryId = useMemo(() => {
        if (location.pathname !== '/dienstplaner') return '';
        return String(new URLSearchParams(location.search).get('entry') || '').trim();
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!plannerTargetEntryId || location.pathname !== '/dienstplaner') return;

        const inUpcoming = upcomingPlanEntries.some((entry) => String(entry._id || entry.id) === plannerTargetEntryId);
        const pastIndex = pastPlanEntries.findIndex((entry) => String(entry._id || entry.id) === plannerTargetEntryId);

        if (!inUpcoming && pastIndex >= 0) {
            if (!showPastPlans) setShowPastPlans(true);
            const minVisible = pastIndex + 1;
            if (pastPlansVisibleCount < minVisible) {
                setPastPlansVisibleCount(minVisible);
            }
        }

        const scrollTimer = setTimeout(() => {
            const targetEl = document.querySelector(`[data-plan-id="${plannerTargetEntryId}"]`);
            if (!targetEl) return;
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedPlanEntryId(plannerTargetEntryId);
        }, 180);

        return () => clearTimeout(scrollTimer);
    }, [
        plannerTargetEntryId,
        location.pathname,
        upcomingPlanEntries,
        pastPlanEntries,
        showPastPlans,
        pastPlansVisibleCount
    ]);

    useEffect(() => {
        if (!highlightedPlanEntryId) return;
        const timer = setTimeout(() => setHighlightedPlanEntryId(''), 2600);
        return () => clearTimeout(timer);
    }, [highlightedPlanEntryId]);
    
    useEffect(() => {
        const mainEl = document.querySelector('main');
        if (!mainEl) return undefined;

        let rafId = 0;
        const applyThreshold = () => {
            rafId = 0;
            const nextVisible = mainEl.scrollTop > 400;
            if (nextVisible !== showScrollTopRef.current) {
                showScrollTopRef.current = nextVisible;
                setShowScrollTop(nextVisible);
            }
        };

        const handleScroll = () => {
            if (rafId) return;
            rafId = window.requestAnimationFrame(applyThreshold);
        };

        mainEl.addEventListener('scroll', handleScroll, { passive: true });
        applyThreshold();

        return () => {
            mainEl.removeEventListener('scroll', handleScroll);
            if (rafId) window.cancelAnimationFrame(rafId);
        };
    }, []);

    useEffect(() => { 
        const mainEl = document.querySelector('main'); 
        resetScrollToTop();
    }, [user, location.pathname]);

    useEffect(() => {
        try {
            localStorage.setItem('ui:sidebar-collapsed', sidebarCollapsed ? '1' : '0');
        } catch (_) {}
    }, [sidebarCollapsed]);

    if (isAppLoading) return <div className="h-screen w-full bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    const isAdminArea = user && (user.role === 'ADMIN' || user.roles?.includes('ADMIN'));
    const currentPageTitle = location.pathname === '/'
        ? 'Schwarzes Brett'
        : location.pathname === '/channels' || location.pathname.startsWith('/channels/')
            ? 'Meine Kanäle'
            : location.pathname === '/dienstplaner'
                ? 'Dienstplaner'
                : location.pathname.startsWith('/assign')
                    ? 'Dienst eintragen'
                    : 'Administration';
    const currentPageTitleMobile = location.pathname === '/'
        ? 'Brett'
        : location.pathname === '/channels' || location.pathname.startsWith('/channels/')
            ? 'Kanäle'
            : location.pathname === '/dienstplaner'
                ? 'Dienstplan'
                : location.pathname.startsWith('/assign')
                    ? 'Eintragen'
                    : 'Admin';
    const isRegisterRoute = location.pathname === '/register';

    const navigateFromSidebar = (path) => {
        navigate(path);
        setSidebarOpen(false);
    };

    const sidebarNavButtonClass = "bg-primary text-primary-foreground shadow-none transition-colors duration-200 hover:bg-primary/90 hover:text-primary-foreground";
    const sidebarNavGhostClass = "transition-colors duration-200 hover:bg-[rgb(161,206,217)]/28 hover:text-[#17192b]";

    const NavContent = ({ mobile = false, compact = false }) => {
        const isCompact = !mobile && compact;
        const sidebarNavBaseClass = isCompact
            ? "w-11 h-11 mx-auto justify-center px-0 rounded-md"
            : "w-[calc(100%-64px)] mx-5 justify-start gap-3 px-3.5 h-11 rounded-md";

        return (
        <div className="relative flex flex-col h-full bg-[rgb(249,245,239)] overflow-hidden">
            <div className={cn("h-20 flex items-center relative z-10", isCompact ? "justify-center px-2" : "px-6")}>
                <Link to="/" className={cn("flex items-center font-bold", isCompact ? "w-11 justify-center gap-0" : "gap-3")} onClick={() => setSidebarOpen(false)}>
                    <img src={efgLogo} alt="Logo" className="h-8 w-8 object-contain" />
                    <div className={cn("flex flex-col leading-none", isCompact && "hidden")}>
                        <span className="text-[1.04rem] font-bold tracking-[0.08em] uppercase">
                            <span className="text-[rgb(161,206,217)]">EFG</span>{" "}
                            <span className="text-[rgb(237,132,91)]">Neckarsulm</span>
                        </span>
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Portal</span>
                    </div>
                </Link>
            </div>

            <div className={cn("flex-1 py-6 overflow-y-auto space-y-1.5 relative z-10", isCompact ? "px-2" : "px-4")}>
                {canView('HOME') && (
                    <Button 
                        title="Schwarzes Brett"
                        variant={location.pathname === '/' ? "default" : "ghost"} 
                        className={cn(sidebarNavBaseClass, location.pathname === '/' ? sidebarNavButtonClass : sidebarNavGhostClass)}
                        onClick={() => navigateFromSidebar('/')}
                    >
                        <HomeIcon size={18} />
                        {!isCompact && <span className="font-semibold text-sm">Schwarzes Brett</span>}
                    </Button>
                )}
                {canView('HOME') && (
                    <Button
                        title="Meine Kanäle"
                        variant={location.pathname === '/channels' ? "default" : "ghost"}
                        className={cn(sidebarNavBaseClass, location.pathname === '/channels' ? sidebarNavButtonClass : sidebarNavGhostClass)}
                        onClick={() => navigateFromSidebar('/channels')}
                    >
                        <ListMusic size={18} />
                        {!isCompact && <span className="font-semibold text-sm">Meine Kanäle</span>}
                    </Button>
                )}
                {canView('HOME') && (
                    <Button
                        title="Meine Teams"
                        variant={location.pathname === '/teams' ? "default" : "ghost"}
                        className={cn(sidebarNavBaseClass, location.pathname === '/teams' ? sidebarNavButtonClass : sidebarNavGhostClass)}
                        onClick={() => navigateFromSidebar('/teams')}
                    >
                        <Users size={18} />
                        {!isCompact && <span className="font-semibold text-sm">Meine Teams</span>}
                    </Button>
                )}
                {canView('MUSIC_PLANER') && (
                    <Button 
                        title="Dienstplaner"
                        variant={location.pathname === '/dienstplaner' ? "default" : "ghost"} 
                        className={cn(sidebarNavBaseClass, location.pathname === '/dienstplaner' ? sidebarNavButtonClass : sidebarNavGhostClass)}
                        onClick={() => navigateFromSidebar('/dienstplaner')}
                    >
                        <Calendar size={18} />
                        {!isCompact && <span className="font-semibold text-sm">Dienstplaner</span>}
                    </Button>
                )}

                {isAdminArea && (
                    <div className={cn(isCompact ? "pt-4" : "pt-6")}>
                        {!isCompact && <p className="px-3 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Administration</p>}
                        <div className="space-y-1.5">
                            <Button title="Dashboard" variant={location.pathname === '/admin' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin')}>
                                <LayoutDashboard size={18} /> {!isCompact && <span className="font-semibold text-sm">Dashboard</span>}
                            </Button>
                            {canView('USER_MGMT') && (
                                <Button title="Benutzer" variant={location.pathname === '/admin/users' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/users' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/users')}>
                                    <Users size={18} /> {!isCompact && <span className="font-semibold text-sm">Benutzer</span>}
                                </Button>
                            )}
                            {canView('ROLES') && (
                                <Button title="Rollen" variant={location.pathname === '/admin/roles' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/roles' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/roles')}>
                                    <Shield size={18} /> {!isCompact && <span className="font-semibold text-sm">Rollen</span>}
                                </Button>
                            )}
                            {canView('USER_MGMT') && (
                                <>
                                    <Button title="Teams" variant={location.pathname === '/admin/teams' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/teams' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/teams')}>
                                        <Users size={18} /> {!isCompact && <span className="font-semibold text-sm">Teams</span>}
                                    </Button>
                                    <Button title="Globale Kategorien" variant={location.pathname === '/admin/tags' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/tags' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/tags')}>
                                        <Tag size={18} /> {!isCompact && <span className="font-semibold text-sm">Globale Kategorien</span>}
                                    </Button>
                                    <Button title="Dienst-Slots" variant={location.pathname === '/admin/plan-slots' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/plan-slots' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/plan-slots')}>
                                        <Settings size={18} /> {!isCompact && <span className="font-semibold text-sm">Dienst-Slots</span>}
                                    </Button>
                                    <Button title="Email Versand" variant={location.pathname === '/admin/email' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/email' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/email')}>
                                        <Mail size={18} /> {!isCompact && <span className="font-semibold text-sm">Email Versand</span>}
                                    </Button>
                                </>
                            )}
                            {canView('BOT_CONTROL') && (
                                <>
                                    <Button title="Automatisierungen" variant={location.pathname === '/admin/jobs' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/jobs' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/jobs')}>
                                        <Zap size={18} /> {!isCompact && <span className="font-semibold text-sm">Automatisierungen</span>}
                                    </Button>
                                    <Button title="WhatsApp Bot" variant={location.pathname === '/admin/bot' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/bot' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/bot')}>
                                        <MessageSquare size={18} /> {!isCompact && <span className="font-semibold text-sm">WhatsApp Bot</span>}
                                    </Button>
                                </>
                            )}
                            {canView('ACTIVITY_LOGS') && (
                                <>
                                    <Button title="System Intelligence" variant={location.pathname === '/admin/monitor' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/monitor' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/monitor')}>
                                        <Activity size={18} /> {!isCompact && <span className="font-semibold text-sm">System Intelligence</span>}
                                    </Button>
                                    <Button title="Security & Privacy" variant={location.pathname === '/admin/security' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/security' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/security')}>
                                        <Lock size={18} /> {!isCompact && <span className="font-semibold text-sm">Security & Privacy</span>}
                                    </Button>
                                    <Button title="Audit Logs" variant={location.pathname === '/admin/activity' ? "default" : "ghost"} className={cn(sidebarNavBaseClass, location.pathname === '/admin/activity' ? sidebarNavButtonClass : sidebarNavGhostClass)} onClick={() => navigateFromSidebar('/admin/activity')}>
                                        <History size={18} /> {!isCompact && <span className="font-semibold text-sm">Audit Logs</span>}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className={cn("p-4 space-y-4 relative z-10", isCompact && "p-2")}>
                {onlineUsersCount > 0 && !isCompact && (
                    <div className="px-2 space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {onlineUsersCount} Online
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {messengerUsers.filter(u => u.isOnline && u.username !== user?.username).slice(0, 5).map(u => (
                                <button 
                                    key={u._id} 
                                    onClick={() => { navigate(`/profile/${u.username}`); setSidebarOpen(false); }}
                                    title={`${u.firstName} ${u.lastName}`}
                                    className="transition-transform hover:scale-110 active:scale-95"
                                >
                                    <UserAvatar user={u} size="xs" showStatus={true} />
                                </button>
                            ))}
                            {onlineUsersCount > 5 && (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[8px] font-black text-muted-foreground border border-dashed">
                                    +{onlineUsersCount - 5}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {onlineUsersCount > 0 && isCompact && (
                    <div className="flex justify-center">
                        <Badge variant="secondary" className="text-[10px] px-2 h-6">{onlineUsersCount} online</Badge>
                    </div>
                )}
                {!user && (
                    <Button onClick={() => setShowLogin(true)} className={cn("h-10 rounded-md font-bold gap-2", isCompact ? "w-11 mx-auto px-0 justify-center" : "w-[calc(100%-64px)] mx-5")}>
                        <LogIn size={18} /> {!isCompact && "Anmelden"}
                    </Button>
                )}
            </div>

        </div>
    )};

    return (
        <TooltipProvider>
            <div className="min-h-screen w-full bg-transparent text-foreground font-sans p-0">
                <Toaster richColors position="top-center" />
                <div className="flex w-full min-h-screen overflow-hidden bg-background">
                {/* Desktop Sidebar */}
            <aside className={cn("hidden md:flex flex-col relative bg-[rgb(249,245,239)] text-slate-900 transition-all duration-200", sidebarCollapsed ? "w-24" : "w-80")}>
                <NavContent compact={sidebarCollapsed} />
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-[300px] bg-[rgb(249,245,239)] text-slate-900 border-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navigation</SheetTitle>
                    </SheetHeader>
                    <NavContent mobile />
                </SheetContent>
            </Sheet>

            <div className="flex-1 flex flex-col min-w-0 relative bg-white md:-ml-4 md:z-10 md:rounded-l-[1.75rem] md:overflow-hidden">
                {!isRegisterRoute && (
                <header className="h-20 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-4 md:px-8 flex items-center justify-between relative">
                    <div className="pointer-events-none absolute bottom-0 left-5 right-5 h-px bg-slate-200" />
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-md bg-white hover:bg-[rgb(161,206,217)] hover:text-[#1f2a37]" onClick={() => setSidebarOpen(true)}>
                            <PanelLeft size={20} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden md:inline-flex h-9 w-9 rounded-md bg-white hover:bg-[rgb(161,206,217)] hover:text-[#1f2a37]"
                            onClick={() => setSidebarCollapsed((prev) => !prev)}
                            title={sidebarCollapsed ? "Sidebar erweitern" : "Sidebar einklappen"}
                        >
                            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </Button>
                        <Separator orientation="vertical" className="h-7 w-[3px] rounded-full bg-[rgb(237,132,91)] hidden md:block" />
                        <h2 className="font-semibold text-sm min-w-0 truncate">
                            <span className="sm:hidden">{currentPageTitleMobile}</span>
                            <span className="hidden sm:inline">{currentPageTitle}</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {user && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 sm:w-auto sm:px-3 sm:gap-2 rounded-md bg-white hover:bg-[rgb(161,206,217)] hover:text-[#1f2a37]"
                                onClick={() => setShowGlobalSearch(true)}
                                title="Suche (Cmd/Ctrl+K)"
                            >
                                <Search size={14} />
                                <span className="hidden sm:inline text-xs font-semibold">Suche</span>
                                <Badge variant="secondary" className="hidden md:inline-flex text-[10px] bg-[rgb(237,132,91)] text-[rgb(116,50,26)]">⌘K</Badge>
                            </Button>
                        )}

                        {user && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-9 px-2 gap-2 rounded-md bg-white hover:bg-[rgb(173,235,179)] hover:text-[#17192b] transition-colors group">
                                        <div className="relative">
                                            <Users size={18} className="text-[#17192b]" />
                                            {onlineUsersCount > 0 && (
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold hidden sm:inline text-[#17192b]">{onlineUsersCount} Online</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-64 p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                                    <div className="bg-muted/30 p-4 border-b">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Gerade Online</p>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        {onlineUsers.length === 0 ? (
                                            <p className="text-[10px] text-center py-4 font-bold text-muted-foreground uppercase opacity-40">Niemand außer dir</p>
                                        ) : onlineUsers.map(u => (
                                            <div key={u._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-primary/5 group transition-all">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <UserAvatar user={u} size="sm" showStatus={true} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold truncate leading-tight">{u.firstName} {u.lastName}</p>
                                                        <p className="text-[8px] text-muted-foreground font-medium uppercase truncate">@{u.username}</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-white transition-all"
                                                    onClick={() => navigate(`/messenger`)} // For now, just messenger or better: handle finding/creating conv
                                                >
                                                    <MessageSquare size={14} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        <Button 
                            variant={location.pathname.startsWith('/messenger') ? "secondary" : "ghost"} 
                            size="icon" 
                            className={cn("h-9 w-9 relative rounded-md bg-white hover:bg-[rgb(161,206,217)] hover:text-[#1f2a37] transition-all", location.pathname.startsWith('/messenger') && "bg-primary/10 text-primary")} 
                            onClick={() => {
                                if (location.pathname.startsWith('/messenger')) {
                                    navigate('/');
                                } else {
                                    navigate('/messenger');
                                }
                            }} 
                            title="Messenger"
                        >
                            <MessageSquare size={18} className={location.pathname.startsWith('/messenger') ? "stroke-[2.5px]" : ""} />
                            {unreadMessages > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white border-2 border-background">
                                    {unreadMessages > 9 ? '9+' : unreadMessages}
                                </span>
                            )}
                            {onlineUsersCount > 0 && unreadMessages === 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-background"></span>
                                </span>
                            )}
                        </Button>

                        {user && (
                            <>
                                <div className="relative">
                                    <Button variant="ghost" size="icon" className={cn("h-9 w-9 relative rounded-md bg-white hover:bg-[rgb(161,206,217)] hover:text-[#1f2a37]", showNotifications && "bg-accent")} onClick={() => setShowNotifications(!showNotifications)}>
                                        <Bell size={18} />
                                        {unreadNotifications > 0 && (
                                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[rgb(237,132,91)]" />
                                        )}
                                    </Button>
                                    {showNotifications && (
                                        <div className="fixed inset-0 sm:absolute sm:inset-auto sm:right-0 sm:top-12 z-[100] p-4 sm:p-0">
                                            <div className="fixed inset-0 sm:hidden bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
                                            <div className="relative z-[110] w-full max-w-md sm:w-[400px]">
                                                <NotificationCenter 
                                                    onClose={() => { setShowNotifications(false); fetchUnreadCount(); }} 
                                                    onNavigate={(path) => navigate(path)} 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="hidden sm:flex items-center gap-2 px-2 h-10 rounded-md bg-white hover:bg-[rgb(249,245,239)] hover:text-[#1f2a37]">
                                            <UserAvatar user={user} size="sm" />
                                            <div className="hidden sm:flex flex-col items-start text-left">
                                                <span className="text-xs font-bold leading-none">{user.firstName}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase mt-0.5">
                                                    {user.rolePreviewActive ? `Ansicht: ${formatRoleLabel(user.rolePreviewAs || user.role)}` : formatRoleLabel(user.role)}
                                                </span>
                                            </div>
                                            <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 mt-1">
                                        <DropdownMenuLabel className="flex flex-col">
                                            <span>Mein Konto</span>
                                            <span className="text-[10px] font-normal text-muted-foreground">{user.email || user.username}</span>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => navigate(`/profile/${user.username}`)}>
                                            <UserCircle className="mr-2 h-4 w-4" /> Profil
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setShowProfileModal(true)}>
                                            <Settings className="mr-2 h-4 w-4" /> Einstellungen
                                        </DropdownMenuItem>
                                        {isAdminArea && (
                                            <>
                                                <DropdownMenuItem onClick={() => navigate('/admin')}>
                                                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Dashboard
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={triggerOnboardingDebug}>
                                                    <UserPlus className="mr-2 h-4 w-4" /> First-Login Debug starten
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        <DropdownMenuSeparator />
                                        {(user?.canRolePreview || user?.rolePreviewActive) && (
                                            <>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <Shield className="mr-2 h-4 w-4" />
                                                        <span>Rolle ansehen als</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                            {Array.isArray(user?.availablePreviewRoles) && user.availablePreviewRoles.map((roleName) => (
                                                                <DropdownMenuItem key={roleName} onClick={() => handleRolePreviewSwitch(roleName)}>
                                                                    {formatRoleLabel(roleName)} {user?.rolePreviewAs === roleName && <Check className="ml-auto h-4 w-4" />}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            {user?.rolePreviewActive && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={handleRolePreviewReset}>
                                                                        Admin-Ansicht wiederherstellen
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}
                                        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <LogOut className="mr-2 h-4 w-4" /> Abmelden
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        )}

                        {user && (
                            <Sheet open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-9 px-1.5 gap-1 rounded-full border border-border/60 bg-background/70 backdrop-blur sm:hidden" title="Schnellzugriff">
                                        <UserAvatar user={user} size="xs" />
                                        <ChevronDown size={14} className="text-muted-foreground" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[92vw] max-w-[420px] p-0 border-l border-border/60 bg-background/95 backdrop-blur-xl">
                                    <div className="flex h-full flex-col">
                                        <SheetHeader className="border-b bg-muted/30 px-5 py-4">
                                            <SheetTitle className="text-left text-base">Schnellzugriff</SheetTitle>
                                        </SheetHeader>
                                        <div className="flex-1 space-y-3 overflow-y-auto p-4">
                                            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
                                                <UserAvatar user={user} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{formatRoleLabel(user.rolePreviewActive ? (user.rolePreviewAs || user.role) : user.role)}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setMobileActionsOpen(false);
                                                        setShowProfileModal(true);
                                                    }}
                                                >
                                                    Profil
                                                </Button>
                                            </div>

                                            <Button
                                                variant="default"
                                                className="w-full justify-between"
                                                onClick={() => {
                                                    setMobileActionsOpen(false);
                                                    navigate('/messenger');
                                                }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <MessageSquare size={16} />
                                                    Messenger
                                                </span>
                                                {unreadMessages > 0 && (
                                                    <Badge variant="destructive" className="text-[10px]">{unreadMessages > 99 ? '99+' : unreadMessages}</Badge>
                                                )}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => {
                                                    setMobileActionsOpen(false);
                                                    setShowNotifications(true);
                                                }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Bell size={16} />
                                                    Benachrichtigungen
                                                </span>
                                                {unreadNotifications > 0 && (
                                                    <Badge variant="secondary" className="text-[10px]">{unreadNotifications > 99 ? '99+' : unreadNotifications}</Badge>
                                                )}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => {
                                                    setMobileActionsOpen(false);
                                                    navigate('/messenger');
                                                }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Users size={16} />
                                                    Online
                                                </span>
                                                <Badge variant="secondary" className="text-[10px]">{onlineUsersCount}</Badge>
                                            </Button>

                                            {isAdminArea && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start gap-2"
                                                        onClick={() => {
                                                            setMobileActionsOpen(false);
                                                            navigate('/admin');
                                                        }}
                                                    >
                                                        <LayoutDashboard size={16} />
                                                        Admin Dashboard
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start gap-2"
                                                        onClick={triggerOnboardingDebug}
                                                    >
                                                        <UserPlus size={16} />
                                                        First-Login Debug starten
                                                    </Button>
                                                </>
                                            )}

                                            {(user?.canRolePreview || user?.rolePreviewActive) && (
                                                <div className="space-y-2 rounded-xl border p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">Rolle ansehen als</p>
                                                    {Array.isArray(user?.availablePreviewRoles) && user.availablePreviewRoles.map((roleName) => (
                                                        <Button
                                                            key={roleName}
                                                            variant={user?.rolePreviewAs === roleName ? "secondary" : "outline"}
                                                            className="w-full justify-start"
                                                            onClick={() => {
                                                                setMobileActionsOpen(false);
                                                                handleRolePreviewSwitch(roleName);
                                                            }}
                                                        >
                                                            {formatRoleLabel(roleName)}
                                                        </Button>
                                                    ))}
                                                    {user?.rolePreviewActive && (
                                                        <Button
                                                            variant="ghost"
                                                            className="w-full justify-start"
                                                            onClick={() => {
                                                                setMobileActionsOpen(false);
                                                                handleRolePreviewReset();
                                                            }}
                                                        >
                                                            Admin-Ansicht wiederherstellen
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="border-t p-4">
                                            <Button
                                                variant="destructive"
                                                className="w-full"
                                                onClick={() => {
                                                    setMobileActionsOpen(false);
                                                    handleLogout();
                                                }}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Abmelden
                                            </Button>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        )}

                        {!user && (
                            <Button variant="outline" size="sm" className="font-bold h-9" onClick={() => setShowLogin(true)}>
                                Login
                            </Button>
                        )}
                    </div>
                </header>
                )}

                <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-7 lg:p-8">
                        {!isRegisterRoute && <Breadcrumbs />}
                        <div className="page-transition">
                            <Routes>
                                <Route path="/" element={
                                    user ? (
                                        <div className="max-w-3xl mx-auto"><BibleVerse /><CommunityWall currentUser={user} showConfirm={showConfirm} showPrompt={showPrompt} showAlert={showAlert} showToast={showToast} /></div>
                                    ) : (
                                        <Navigate to="/login-required" replace />
                                    )
                                } />
                                <Route path="/channels" element={user ? <MyChannels showToast={showToast} /> : <Navigate to="/login-required" replace />} />
                                <Route path="/teams" element={user ? <div className="max-w-6xl mx-auto"><MyTeams /></div> : <Navigate to="/login-required" replace />} />
                                <Route path="/channels/:channelId" element={user ? <ChannelWallRoute user={user} showConfirm={showConfirm} showPrompt={showPrompt} showAlert={showAlert} showToast={showToast} /> : <Navigate to="/login-required" replace />} />
                                <Route path="/wall/post/:id" element={user ? <div className="max-w-3xl mx-auto"><SinglePostView currentUser={user} showToast={showToast} allUsers={allUsers} showConfirm={showConfirm} /></div> : <Navigate to="/login-required" replace />} />
                                <Route path="/messenger" element={user ? <Messenger currentUser={user} socket={socket} /> : <Navigate to="/login-required" replace />} />
                                <Route path="/messenger/:conversationId" element={user ? <Messenger currentUser={user} socket={socket} /> : <Navigate to="/login-required" replace />} />
                                <Route path="/profile/:username" element={user ? <UserProfile currentUser={user} socket={socket} showToast={showToast} /> : <Navigate to="/login-required" replace />} />
                                <Route path="/login-required" element={
                                    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                                        <div className="w-20 h-20 bg-[rgb(237,132,91)]/12 text-[rgb(237,132,91)] rounded-full flex items-center justify-center mb-6 border border-[rgb(237,132,91)]/30">
                                            <Lock size={32} />
                                        </div>
                                        <h1 className="text-2xl font-bold tracking-tight mb-2">Anmeldung erforderlich</h1>
                                        <p className="text-muted-foreground max-w-xs mb-8 font-medium">
                                            Bitte melde dich an, um auf das Schwarze Brett zuzugreifen.
                                        </p>
                                        <Button size="lg" className="px-8 font-bold" onClick={() => setShowLogin(true)}>
                                            JETZT ANMELDEN
                                        </Button>
                                    </div>
                                } />
                                <Route path="/dienstplaner" element={canView('MUSIC_PLANER') ? <div className="max-w-4xl mx-auto">
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                                        <div>
                                            <h1 className="text-3xl font-bold tracking-tight">Dienstplaner</h1>
                                            <p className="text-muted-foreground text-sm font-medium mt-1">Gottesdienste & Teams</p>
                                        </div>
                                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                                        {user && (
                                                <Button 
                                                    variant={filterMe ? "default" : "outline"} 
                                                    size="sm"
                                                    className="h-9 font-semibold w-full sm:w-auto justify-center text-xs sm:text-sm min-w-0"
                                                    onClick={() => setFilterMe(!filterMe)}
                                                >
                                                    <Filter size={14} className="mr-2 shrink-0" /> {filterMe ? 'Alle Dienste' : 'Meine Dienste'}
                                                </Button>
                                            )}
                                            {user && filterMe && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 font-semibold w-full sm:w-auto justify-center text-xs sm:text-sm min-w-0"
                                                    onClick={() => { setShowProfileModal(true); setActiveTab('calendar'); }}
                                                >
                                                    <Calendar size={14} className="mr-2 shrink-0" /> Kalender-Abo
                                                </Button>
                                            )}
                                            <Button
                                                variant={plannerView === 'calendar' ? "default" : "outline"}
                                                size="sm"
                                                className="h-9 font-semibold w-full sm:w-auto justify-center text-xs sm:text-sm min-w-0"
                                                onClick={() => setPlannerView((prev) => prev === 'calendar' ? 'list' : 'calendar')}
                                            >
                                                <Calendar size={14} className="mr-2 shrink-0" /> {plannerView === 'calendar' ? 'Liste' : 'Kalender'}
                                            </Button>
                                            {canEdit('MUSIC_PLANER') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 font-semibold w-full sm:w-auto justify-center text-xs sm:text-sm min-w-0"
                                                    onClick={openBulkPlanModal}
                                                >
                                                    <RefreshCw size={14} className="mr-2 shrink-0" /> Hüllen anlegen
                                                </Button>
                                            )}
                                            {canEdit('MUSIC_PLANER') && (
                                                <Button 
                                                    size="sm"
                                                    className="h-9 font-semibold w-full sm:w-auto justify-center text-xs sm:text-sm min-w-0"
                                                    onClick={() => { setEditEntry(null); setShowPlanModal(true); }}
                                                >
                                                    <Plus size={16} className="mr-2 shrink-0" /> Neu
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {plannerView === 'calendar' ? (
                                            loadingPlan ? (
                                                <><CardSkeleton /><CardSkeleton /></>
                                            ) : calendarPlanEntries.length === 0 ? (
                                                <Card className="p-12 text-center bg-muted/20 border-dashed">
                                                    <p className="text-muted-foreground font-medium">Keine Termine für die Kalenderansicht gefunden.</p>
                                                </Card>
                                            ) : (
                                                <PlanCalendarView
                                                    entries={calendarPlanEntries}
                                                    mode={plannerCalendarMode}
                                                    anchorDate={plannerCalendarAnchor}
                                                    onModeChange={setPlannerCalendarMode}
                                                    onAnchorDateChange={setPlannerCalendarAnchor}
                                                    onOpenEntry={(entry) => openPlanEntryFromOverview(entry?._id || entry?.id)}
                                                />
                                            )
                                        ) : (
                                        filterMe ? (
                                            loadingPlan ? (
                                                <><CardSkeleton /><CardSkeleton /></>
                                            ) : myServices.length === 0 ? (
                                                <Card className="p-10 text-center bg-muted/20 border-dashed">
                                                    <p className="text-base font-semibold">Keine eigenen Dienste gefunden.</p>
                                                    <p className="text-sm text-muted-foreground mt-2 font-medium">Sobald du eingeteilt bist, erscheinen deine Dienste hier.</p>
                                                </Card>
                                            ) : (
                                                <>
                                                    <Card className="border-primary/15 bg-primary/5">
                                                        <CardHeader className="pb-3">
                                                            <CardTitle className="text-lg">Meine Dienste</CardTitle>
                                                            <CardDescription>
                                                                {myServices.length} Eintrag{myServices.length === 1 ? '' : 'e'} gefunden.
                                                            </CardDescription>
                                                        </CardHeader>
                                                    </Card>
                                                    <div className="space-y-3">
                                                        {myServices.map((service, idx) => (
                                                            <Card key={`my-service-${service.entryId}-${service.roleKey}-${idx}`} className="border-primary/10">
                                                                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge variant="secondary" className="font-bold">{service.roleLabel}</Badge>
                                                                            <span className="text-sm font-semibold">{service.typ}</span>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground font-medium">
                                                                            {service.datum ? service.datum.split('-').reverse().join('.') : 'Datum offen'} . {service.uhrzeit || '10:30 Uhr'}
                                                                        </p>
                                                                        {service.thema && (
                                                                            <p className="text-sm font-medium text-foreground/80">{service.thema}</p>
                                                                        )}
                                                                    </div>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="font-semibold sm:self-start"
                                                                        onClick={() => openPlanEntryFromOverview(service.entryId)}
                                                                    >
                                                                        <Calendar size={14} className="mr-2" /> Termin öffnen
                                                                    </Button>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                </>
                                            )
                                        ) : (
                                            loadingPlan ? (
                                                <><CardSkeleton /><CardSkeleton /></>
                                            ) : upcomingPlanEntries.length === 0 && pastPlanEntries.length === 0 ? (
                                                <Card className="p-12 text-center bg-muted/20 border-dashed">
                                                    <p className="text-muted-foreground font-medium">Keine Termine gefunden.</p>
                                                </Card>
                                            ) : (
                                                <>
                                                    {upcomingPlanEntries.length > 0 ? (
                                                        <>
                                                            {upcomingPlanEntries.map((entry, idx) => (
                                                                <PlanerCard 
                                                                    key={`upcoming-${entry._id || entry.id || idx}`}
                                                                    entry={entry} 
                                                                    canEdit={canEdit('MUSIC_PLANER')} 
                                                                    onOpenDetails={openPlanDetailView}
                                                                    onEdit={(e) => { setEditEntry(e); setShowPlanModal(true); }} 
                                                                    onDelete={deletePlanEntry} 
                                                                    showToast={showToast}
                                                                    showConfirm={showConfirm}
                                                                    currentUser={user}
                                                                    loadPlan={loadPlan}
                                                                    allUsers={allUsers}
                                                                    highlighted={highlightedPlanEntryId === String(entry._id || entry.id)}
                                                                />
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <Card className="p-6 bg-muted/20 border-dashed">
                                                            <p className="text-sm font-semibold">Kein kommender Termin vorhanden.</p>
                                                            <p className="text-xs text-muted-foreground font-medium mt-1">Im Verlauf findest du ältere Einträge.</p>
                                                        </Card>
                                                    )}

                                                    {pastPlanEntries.length > 0 && (
                                                        <div className="space-y-3 pt-2">
                                                            <Button
                                                                variant="outline"
                                                                className="w-full justify-between h-10 font-semibold"
                                                                onClick={() => setShowPastPlans(prev => !prev)}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <History size={16} /> Vergangene Termine ({pastPlanEntries.length})
                                                                </span>
                                                                {showPastPlans ? <ChevronDown size={16} className="rotate-180 transition-transform" /> : <ChevronDown size={16} className="transition-transform" />}
                                                            </Button>

                                                            {showPastPlans && (
                                                                <div className="space-y-4">
                                                                    {visiblePastPlanEntries.map((entry, idx) => (
                                                                        <PlanerCard
                                                                            key={`past-${entry._id || entry.id || idx}`}
                                                                            entry={entry}
                                                                            canEdit={canEdit('MUSIC_PLANER')}
                                                                            onOpenDetails={openPlanDetailView}
                                                                            onEdit={(e) => { setEditEntry(e); setShowPlanModal(true); }}
                                                                            onDelete={deletePlanEntry}
                                                                            showToast={showToast}
                                                                            showConfirm={showConfirm}
                                                                            currentUser={user}
                                                                            loadPlan={loadPlan}
                                                                            allUsers={allUsers}
                                                                            highlighted={highlightedPlanEntryId === String(entry._id || entry.id)}
                                                                        />
                                                                    ))}

                                                                    {pastPlansVisibleCount < pastPlanEntries.length && (
                                                                        <Button
                                                                            variant="secondary"
                                                                            className="w-full font-semibold"
                                                                            onClick={() => setPastPlansVisibleCount(prev => prev + 6)}
                                                                        >
                                                                            Mehr aus dem Verlauf laden
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )
                                        )
                                        )}
                                    </div>
                                </div> : <AccessDenied title="Dienstplaner" message="Dieser Bereich ist exklusiv für registrierte Mitarbeiter." />} />
                                
                                <Route path="/admin" element={isAdminArea ? <div className="max-w-5xl mx-auto"><h1 className="text-3xl font-bold tracking-tight mb-8">System Steuerung</h1><AdminDashboard canView={canView} /></div> : <AccessDenied title="Admin-Bereich" message="Zugriff verweigert. Administrator-Rechte erforderlich." />} />
                                <Route path="/admin/users" element={canView('USER_MGMT') ? <div className="max-w-6xl mx-auto"><UserManagement currentUser={user} showConfirm={showConfirm} showToast={showToast} /></div> : <AccessDenied />} />
                                <Route path="/admin/roles" element={canView('ROLES') ? <div className="max-w-6xl mx-auto"><RoleManagement showToast={showToast} showConfirm={showConfirm} showPrompt={showPrompt} /></div> : <AccessDenied />} />
                                <Route path="/admin/teams" element={canView('USER_MGMT') ? <div className="max-w-6xl mx-auto"><TeamManagement /></div> : <AccessDenied />} />
                                <Route path="/admin/tags" element={canView('USER_MGMT') ? <div className="max-w-6xl mx-auto"><TagManagement /></div> : <AccessDenied />} />
                                <Route path="/admin/plan-slots" element={canView('USER_MGMT') ? <div className="max-w-6xl mx-auto"><PlanSlotManagement /></div> : <AccessDenied />} />
                                <Route path="/admin/monitor" element={canView('ACTIVITY_LOGS') ? <div className="max-w-7xl mx-auto"><SystemMonitor showDetails={showDetails} showToast={showToast} /></div> : <AccessDenied />} />
                                <Route path="/admin/stats" element={canView('ACTIVITY_LOGS') ? <div className="max-w-7xl mx-auto"><SystemStats /></div> : <AccessDenied />} />
                                <Route path="/admin/security" element={canView('USER_MGMT') ? <div className="max-w-7xl mx-auto"><SecuritySettings showToast={showToast} /></div> : <AccessDenied />} />
                                <Route path="/admin/email" element={canView('USER_MGMT') ? <div className="max-w-7xl mx-auto"><EmailBroadcast showToast={showToast} /></div> : <AccessDenied />} />
                                <Route path="/admin/activity" element={canView('ACTIVITY_LOGS') ? <div className="max-w-6xl mx-auto space-y-12"><ActivityLogs showDetails={showDetails} /><Separator /><SystemLogs showAlert={showAlert} /></div> : <AccessDenied />} />
                                <Route path="/admin/bot" element={canView('BOT_CONTROL') ? <BotSettings status={status} fetchBotData={fetchBotData} canEdit={canEdit} showDetails={showDetails} /> : <AccessDenied />} />
                                <Route path="/admin/jobs" element={canView('BOT_CONTROL') ? <JobsControl jobs={jobs} recentJobLogs={recentJobLogs} fetchBotData={fetchBotData} canEdit={canEdit} setShowModal={setShowModal} setJobForm={setJobForm} showConfirm={showConfirm} showPrompt={showPrompt} showToast={showToast} groups={groups} logPage={logPage} setLogPage={setLogPage} /> : <AccessDenied />} />
                                <Route path="/register" element={<div className="min-h-full flex items-center justify-center py-10"><RegisterView onAuthSuccess={async () => { await checkAuth(); navigate('/'); setTimeout(resetScrollToTop, 0); showToast("Willkommen!", "success"); }} /></div>} />
                                <Route path="/impressum" element={<Imprint />} />
                                <Route path="/datenschutz" element={<Privacy />} />
                                <Route path="/dienstplaner/detail/:planId" element={<QuickAssign currentUser={user} requestLogin={requestLoginWithRedirect} showToast={showToast} />} />
                                <Route path="/assign/:token" element={<QuickAssign currentUser={user} requestLogin={requestLoginWithRedirect} showToast={showToast} />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </div>
                    </div>

                    <footer className="py-12 border-t mt-12 px-6">
                        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex gap-6 text-[10px] font-bold uppercase tracking-normal text-muted-foreground/60">
                                <button onClick={() => navigate('/impressum')} className="hover:text-foreground transition-colors">Impressum</button>
                                <button onClick={() => navigate('/datenschutz')} className="hover:text-foreground transition-colors">Datenschutz</button>
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-normal select-none">
                                EfG Portal v{version} • © 2026 Neckarsulm
                            </p>
                        </div>
                    </footer>
                </main>
            </div>
            </div>

            {showPlanModal && <PlanerModal entry={editEntry} onClose={() => setShowPlanModal(false)} onSave={savePlanEntry} allUsers={allUsers} />}

            <Dialog open={showBulkPlanModal} onOpenChange={setShowBulkPlanModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Massenanlage Dienstplan-Hüllen</DialogTitle>
                        <DialogDescription>
                            Legt zwischen Start und Ende automatisch fehlende Hüllen an. Du kannst Gottesdienste, Bibel & Gebet oder beides wählen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field className="space-y-2">
                            <FieldLabel>Typ</FieldLabel>
                            <Select value={bulkPlanCreateMode} onValueChange={setBulkPlanCreateMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bitte auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Beides (Sonntag + Dienstag)</SelectItem>
                                    <SelectItem value="service">Nur Gottesdienste (Sonntag)</SelectItem>
                                    <SelectItem value="bible">Nur Bibel- und Gebetsabend (Dienstag)</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field className="space-y-2">
                            <FieldLabel>Startdatum</FieldLabel>
                            <Input type="date" value={bulkPlanFrom} onChange={(e) => setBulkPlanFrom(e.target.value)} />
                        </Field>
                        <Field className="space-y-2">
                            <FieldLabel>Enddatum</FieldLabel>
                            <Input type="date" value={bulkPlanTo} onChange={(e) => setBulkPlanTo(e.target.value)} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={bulkPlanOverwrite}
                                onChange={(e) => setBulkPlanOverwrite(Boolean(e.target.checked))}
                            />
                            Bestehende Hüllen im Zeitraum mit den Regeln überschreiben
                        </label>
                        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                            <p>Regeln:</p>
                            <p>- Sonntag: Gottesdienst (wenn gewählt)</p>
                            <p>- Letzter Sonntag im Monat: 10:30 Uhr, Anbetung entfällt, Integrierte Mahlfeier</p>
                            <p>- Dienstag: Bibel- und Gebetsabend (wenn gewählt: nur Thema + Predigt offen, restliche Rollen entfallen)</p>
                            <p>- Bestehende Tage werden nur bei aktiviertem Überschreiben angepasst</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkPlanModal(false)}>Abbrechen</Button>
                        <Button onClick={generateBulkPlanShells} disabled={generatingBulkPlan}>
                            {generatingBulkPlan ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
                            Jetzt anwenden
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {showModal && (
                <BotJobModal 
                    isOpen={showModal} 
                    onClose={() => setShowModal(false)} 
                    onSave={handleSaveJob}
                    jobForm={jobForm}
                    setJobForm={setJobForm}
                    groups={groups}
                    currentUser={user}
                />
            )}

            {showProfileModal && <ProfileModal user={user} onClose={() => setShowProfileModal(false)} onSave={handleUpdateProfile} showToast={showToast} />}

            {user && showOnboardingWizard && (
                <FirstLoginWizard user={user} showToast={showToast} onComplete={handleCompleteOnboarding} />
            )}
            
            {detailsModal.show && (
                <Dialog open={true} onOpenChange={() => setDetailsModal({ show: false, data: null })}>
                    <DialogContent className="max-w-3xl p-0 shadow-2xl rounded-xl border overflow-hidden">
                        <DialogHeader className="p-6 bg-muted/30 border-b">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Database size={20} className="text-primary" /> {detailsModal.title}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6 max-h-[60vh] overflow-y-auto bg-zinc-950">
                            <pre className="text-xs font-mono text-emerald-500 p-4 bg-black/50 rounded-lg border border-emerald-500/20">
                                {detailsModal.data ? JSON.stringify(detailsModal.data, null, 2) : 'Keine Daten.'}
                            </pre>
                        </div>
                        <DialogFooter className="p-4 bg-muted/30 border-t">
                            <Button size="sm" onClick={() => setDetailsModal({ show: false, data: null })}>Schließen</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={dialog.show} onOpenChange={(open) => setDialog({ ...dialog, show: open })}>
                <DialogContent className="max-w-sm p-6 shadow-2xl rounded-xl">
                    <div className="space-y-6 text-center">
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                            dialog.type === 'danger' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        )}>
                            {dialog.isPrompt ? <LinkIcon size={32} /> : dialog.type === 'danger' ? <Trash2 size={32} /> : <Bell size={32} />}
                        </div>
                        <div className="space-y-2">
                            <DialogTitle className="text-xl font-bold">{dialog.title}</DialogTitle>
                            <DialogDescription className="text-sm font-medium">{dialog.message}</DialogDescription>
                        </div>
                        {dialog.isPrompt && (
                            <Input 
                                autoFocus 
                                className="h-12 text-lg font-medium text-center" 
                                placeholder={dialog.placeholder} 
                                value={promptValue} 
                                onChange={(e) => setPromptValue(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && (dialog.onConfirm(promptValue), setDialog({ ...dialog, show: false }))} 
                            />
                        )}
                        <div className="flex gap-2">
                            {!dialog.isAlert && (
                                <Button variant="ghost" onClick={() => setDialog({ ...dialog, show: false })} className="flex-1 font-bold">
                                    ABBRECHEN
                                </Button>
                            )}
                            <Button 
                                variant={dialog.type === 'danger' ? "destructive" : "default"}
                                className="flex-1 font-bold"
                                onClick={async () => { 
                                    try {
                                        if (dialog.isPrompt) await dialog.onConfirm(promptValue); 
                                        else if (dialog.onConfirm) await dialog.onConfirm(); 
                                    } catch (err) {
                                        console.error("Confirmation error:", err);
                                        showToast("Aktion fehlgeschlagen", "error");
                                    } finally {
                                        setDialog({ ...dialog, show: false }); 
                                    }
                                }}
                            >
                                {dialog.type === 'danger' ? 'BESTÄTIGEN' : 'OKAY'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {showScrollTop && (
                <Button 
                    size="icon" 
                    className="fixed bottom-8 right-8 h-12 w-12 rounded-full shadow-xl z-40" 
                    onClick={() => document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <ArrowUp size={24} />
                </Button>
            )}

            <GlobalSearch user={user} open={showGlobalSearch} onOpenChange={setShowGlobalSearch} />

            {showLogin && (
                <Dialog open={true} onOpenChange={(open) => { setShowLogin(open); if (!open) setLoginRedirectPath(''); }}>
                    <DialogContent className="max-w-md p-0 bg-transparent border-none shadow-none focus:outline-none" aria-describedby={undefined}>
                        <DialogTitle className="sr-only">Anmeldung</DialogTitle>
                        <LoginView 
                            onClose={() => { setShowLogin(false); setLoginRedirectPath(''); }} 
                            onAuthSuccess={async () => { 
                                await checkAuth(); 
                                if (loginRedirectPath) {
                                    navigate(loginRedirectPath);
                                    setLoginRedirectPath('');
                                    setShowLogin(false);
                                } else if (location.pathname === '/login-required') {
                                    navigate('/');
                                } else {
                                    setShowLogin(false);
                                }
                                setTimeout(resetScrollToTop, 0);
                            }} 
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
        </TooltipProvider>
    );
}

export default App;
