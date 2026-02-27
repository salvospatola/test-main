import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Activity, Database, Server, Wifi, ShieldAlert, Lock, Users, Ban, Filter, Loader2, Search, Unlock, TrendingUp, Globe } from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { DatePicker } from "./ui/date-time-picker"

const api = axios.create({ baseURL: '', withCredentials: true });

const StatCard = ({ title, value, icon, color, subValue, alert }) => (
    <Card className={cn(
        "shadow-md border-border/50 transition-all hover:shadow-lg",
        alert && "border-destructive/50 bg-destructive/5"
    )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground">{title}</CardTitle>
            <div className={cn(
                "p-2 rounded-lg",
                alert ? "bg-destructive/10 text-destructive" : `bg-${color}-500/10 text-${color}-500`
            )}>
                {React.cloneElement(icon, { size: 18 })}
            </div>
        </CardHeader>
        <CardContent>
            <div className={cn("text-2xl font-bold", alert && "text-destructive")}>{value}</div>
            {subValue && (
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-tight">
                    {subValue}
                </p>
            )}
        </CardContent>
    </Card>
);

const RangeSelector = ({ current, onSelect, showCustom, onToggleCustom }) => (
    <div className="flex bg-muted/50 p-1 rounded-lg border shadow-inner">
        {[
            { l: 'Live', v: 'live' }, { l: '24h', v: 'day' }, { l: '7T', v: 'week' }, { l: '30T', v: 'month' }
        ].map((opt, oIdx) => (
            <Button 
                key={`${opt.v}-${oIdx}`} 
                variant={current === opt.v ? "default" : "ghost"}
                size="sm"
                className={cn(
                    "h-8 text-[10px] font-bold uppercase px-4 rounded-md transition-all",
                    current === opt.v && "shadow-sm"
                )}
                onClick={() => onSelect(opt.v)}
            >
                {opt.l}
            </Button>
        ))}
        <Button 
            variant={showCustom || current === 'custom' ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-[10px] font-bold uppercase px-3 gap-2 ml-1"
            onClick={onToggleCustom}
        >
            <Filter size={12} /> Custom
        </Button>
    </div>
);

const SystemMonitor = ({ showDetails, showToast }) => {
    const [data, setData] = useState([]);
    const [current, setCurrent] = useState(null);
    const [bans, setBans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [peaks, setPeaks] = useState({});
    
    const [range, setRange] = useState('live');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [showCustom, setShowCustom] = useState(false);

    const prevCounters = useRef({ reads: 0, writes: 0 });

    const fetchData = async () => {
        try {
            const [statsRes, bansRes] = await Promise.all([
                api.get(`/api/monitoring/stats?trafficRange=1`),
                api.get('/api/monitoring/bans')
            ]);
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const dbReadsDelta = prevCounters.current.reads > 0 ? Math.max(0, statsRes.data.db.reads - prevCounters.current.reads) : 0;
            const dbWritesDelta = prevCounters.current.writes > 0 ? Math.max(0, statsRes.data.db.writes - prevCounters.current.writes) : 0;
            
            prevCounters.current = { reads: statsRes.data.db.reads, writes: statsRes.data.db.writes };

            setCurrent(statsRes.data);
            setBans(bansRes.data);

            if (range === 'live') {
                setData(prev => {
                    const newData = [...prev, { 
                        name: timeStr, 
                        cpu: statsRes.data.cpu, 
                        memory: Math.round(statsRes.data.memory / 1024 / 1024),
                        traffic: statsRes.data.traffic,
                        attacks: statsRes.data.attacks || 0,
                        reads: dbReadsDelta,
                        writes: dbWritesDelta
                    }];
                    if (newData.length > 30) newData.shift();
                    return newData;
                });
            }
            setLoading(false);
        } catch (e) { console.error("Monitor-Daten laden fehlgeschlagen:", e); }
    };

    const fetchHistory = async () => {
        if (range === 'live') return;
        setLoading(true);
        try {
            let url = `/api/monitoring/history?range=${range}`;
            if (range === 'custom' && customRange.start) {
                url += `&start=${customRange.start}&end=${customRange.end || new Date().toISOString()}`;
            }
            const res = await api.get(url);
            setPeaks(res.data.peaks || {});
            const historyData = res.data.history.map(h => ({
                name: new Date(h.timestamp).toLocaleString('de-DE', { 
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                }),
                cpu: Number(h.cpu ?? h.cpuUsage ?? 0),
                memory: Math.round((Number(h.memory ?? h.memoryUsage ?? 0) / 1024 / 1024)),
                traffic: Number(h.traffic ?? h.requestsPerMinute ?? 0),
                attacks: Number(h.attackCount || 0),
                reads: h.dbReads || 0,
                writes: h.dbWrites || 0
            }));
            setData(historyData);
        } catch (e) { console.error("Historische Daten laden fehlgeschlagen:", e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (range === 'live') {
            fetchData();
            const interval = setInterval(fetchData, 3000);
            return () => clearInterval(interval);
        } else {
            fetchHistory();
        }
    }, [range, customRange]);

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        setRange('custom');
        setShowCustom(false);
    };

    if (loading && !current) return (
        <div className="h-96 flex flex-col items-center justify-center gap-6 text-muted-foreground page-transition">
            <div className="relative">
                <Loader2 className="animate-spin text-primary" size={48} />
                <Activity className="absolute inset-0 m-auto text-primary opacity-20" size={20} />
            </div>
            <div className="text-center space-y-2">
                <p className="font-bold uppercase tracking-[0.3em] text-sm ">System Intelligence</p>
                <p className="text-xs font-bold uppercase tracking-normal opacity-50">Deep Analytics Pipeline wird initialisiert...</p>
            </div>
        </div>
    );

    const hasSecurityAlerts = current?.security?.alerts > 0 || current?.security?.locked > 0;

    return (
        <div className="space-y-10 pb-20 page-transition">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b pb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight uppercase text-primary">System Intelligence</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full shadow-lg transition-all", range === 'live' ? "bg-emerald-500 animate-pulse shadow-emerald-500/50" : "bg-muted-foreground shadow-inner")} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            {range === 'live' ? 'Echtzeit-Deep-Analytics Aktiv' : `Historische Analyse: ${range.toUpperCase()}`}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <RangeSelector 
                        current={range} 
                        onSelect={setRange} 
                        showCustom={showCustom} 
                        onToggleCustom={() => setShowCustom(!showCustom)} 
                    />
                    <Badge variant={current?.whatsapp?.connected ? "success" : "destructive"} className="gap-2 py-2 px-4 uppercase font-bold tracking-normal text-[10px] rounded-xl shadow-md border-2">
                        <Wifi size={14} className="stroke-[3px]" /> {current?.whatsapp?.connected ? 'WhatsApp Online' : 'WhatsApp Offline'}
                    </Badge>
                </div>
            </div>

            {showCustom && (
                <Card className="animate-in slide-in-from-top-4 border-primary/20 shadow-2xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-8 pb-4">
                        <CardTitle className="text-sm font-bold uppercase tracking-[0.2em] text-primary ">Zeitraum definieren</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-6">
                        <form onSubmit={handleCustomSubmit} className="flex flex-col md:flex-row items-end gap-6">
                            <Field className="flex-1">
                                <FieldLabel className="flex items-center gap-2 mb-2"><CalendarIcon size={14} /> Start-Datum</FieldLabel>
                                <DatePicker 
                                    className="w-full h-12 rounded-xl border-primary/10 font-medium"
                                    value={customRange.start} 
                                    onChange={v => setCustomRange({...customRange, start: v})} 
                                />
                            </Field>
                            <Field className="flex-1">
                                <FieldLabel className="flex items-center gap-2 mb-2"><CalendarIcon size={14} /> End-Datum</FieldLabel>
                                <DatePicker 
                                    className="w-full h-12 rounded-xl border-primary/10 font-medium"
                                    value={customRange.end} 
                                    onChange={v => setCustomRange({...customRange, end: v})} 
                                />
                            </Field>
                            <Button type="submit">Analyse starten</Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Performance" value={`${current?.cpu?.toFixed(1)}%`} icon={<Cpu />} color="blue" subValue={`CPU | ${(current?.memory / 1024 / 1024).toFixed(0)}MB RAM`} />
                <StatCard title="Traffic (Live)" value={`${current?.live?.total || 0}`} icon={<Users />} color="emerald" subValue={`${current?.live?.users || 0} User | ${current?.live?.guests || 0} Gäste`} />
                <StatCard title="Netzwerk Last" value={`${range === 'live' ? current?.traffic : peaks.hourlyTraffic || '-'}`} icon={<Server />} color="amber" subValue={range === 'live' ? "Anfragen pro Minute" : "Peak Anfragen / Std"} />
                <StatCard title="Sicherheit" value={current?.security?.alerts} icon={hasSecurityAlerts ? <ShieldAlert /> : <Lock />} color={hasSecurityAlerts ? "red" : "blue"} subValue={`${current?.security?.locked} Konten gesperrt | ${range === 'live' ? (current?.attacks || 0) : (peaks?.maxAttacks || 0)} Attacken`} alert={hasSecurityAlerts} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="shadow-xl border-primary/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-6 px-8">
                        <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase text-primary">
                            <Activity size={20} className="text-primary stroke-[3px]" /> Ressourcen-Last
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}} />
                                <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={4} name="CPU %" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-xl border-primary/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-6 px-8 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase text-amber-500">
                            <Globe size={20} className="text-amber-500 stroke-[3px]" /> Netzwerk Traffic
                        </CardTitle>
                        <Badge variant="outline" className="font-bold border-amber-200 text-amber-600 uppercase text-[9px]">
                            {range === 'live' ? 'Requests / Min' : 'Requests / Zeitintervall'}
                        </Badge>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}} />
                                <Area type="monotone" dataKey="traffic" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTraffic)" strokeWidth={4} name="Requests" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="shadow-xl border-primary/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-6 px-8">
                        <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase text-sky-500">
                            <Server size={20} className="text-sky-500 stroke-[3px]" /> RAM Verlauf
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] p-8 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}} />
                                <Area type="monotone" dataKey="memory" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRam)" strokeWidth={4} name="RAM (MB)" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="shadow-xl border-primary/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-6 px-8">
                        <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase text-emerald-500">
                            <Database size={20} className="text-emerald-500 stroke-[3px]" /> Datenbank I/O
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] p-8 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorReads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}} />
                                <Area type="monotone" dataKey="reads" stroke="#10b981" fillOpacity={1} fill="url(#colorReads)" strokeWidth={4} name="Reads" animationDuration={1000} />
                                <Area type="monotone" dataKey="writes" stroke="#059669" fillOpacity={0} strokeWidth={3} name="Writes" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="shadow-xl border-primary/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-6 px-8">
                        <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase text-rose-500">
                            <ShieldAlert size={20} className="text-rose-500 stroke-[3px]" /> Attacken
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] p-8 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}} />
                                <Area type="monotone" dataKey="attacks" stroke="#f43f5e" fillOpacity={1} fill="url(#colorAttacks)" strokeWidth={4} name="Attacken" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-2xl border-primary/10 rounded-[2rem] overflow-hidden">
                <CardHeader className={cn(
                    "p-8 bg-muted/30 border-b transition-colors",
                    hasSecurityAlerts && "bg-destructive/5"
                )}>
                    <div className="flex items-center gap-6">
                        <div className={cn(
                            "p-5 rounded-3xl shadow-inner border transition-all duration-500",
                            hasSecurityAlerts ? "bg-destructive/10 text-destructive border-destructive/20 scale-110" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                            {hasSecurityAlerts ? <ShieldAlert size={40} className="stroke-[2.5px]" /> : <Lock size={40} className="stroke-[2.5px]" />}
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold uppercase tracking-tight">Security Intelligence</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-normal mt-1">Echtzeit-Überwachung von Bedrohungen und Anomalien.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-8 border-b bg-background/50">
                        <p className={cn(
                            "text-sm font-bold leading-relaxed uppercase tracking-wider",
                            hasSecurityAlerts ? "text-destructive" : "text-muted-foreground opacity-80"
                        )}>
                            {hasSecurityAlerts 
                                ? `KRITISCH: Es wurden ${current.security.alerts} verdächtige Anfragen registriert. ${current.security.locked} Benutzerkonten sind aufgrund von Sicherheits-Policies gesperrt.`
                                : "STATUS NOMINAL: Das System meldet keine verdächtigen Aktivitäten. Alle Endpunkte arbeiten innerhalb der definierten Sicherheits-Parameter."}
                        </p>
                    </div>
                    {current?.security?.recent?.length > 0 ? (
                        <div className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow className="border-b">
                                        <TableHead className="pl-8 uppercase text-[10px] font-bold tracking-normal py-4">Zeitpunkt</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Intelligence Profil</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Zielpfad</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Erkannte Aktion</TableHead>
                                        <TableHead className="text-right pr-8 uppercase text-[10px] font-bold tracking-normal py-4">Intelligence</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {current.security.recent.map((threat, tIdx) => (
                                        <TableRow key={threat._id || `threat-${tIdx}`} className="hover:bg-destructive/5 transition-colors border-b">
                                            <TableCell className="pl-8 py-5 text-[10px] font-bold text-muted-foreground">
                                                {new Date(threat.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-sm tracking-tight">{threat.ip}</span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{threat.geo?.country || "Terra Incognita"} | {threat.geo?.city || "Unknown"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <code className="text-[10px] bg-muted/50 px-2 py-1 rounded-lg border font-mono font-bold text-primary/80">{threat.path}</code>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <Badge variant={threat.severity === 'HIGH' ? 'destructive' : 'secondary'} className="text-[9px] font-bold uppercase tracking-normal px-3 py-1 border-2">
                                                    {threat.action.replace('API_GET_', '').replace('API_POST_', '')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8 py-5">
                                                <Button variant="ghost" size="icon" onClick={() => showDetails(`Deep Intel: ${threat.ip}`, threat)}>
                                                    <Search size={20} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="p-20 text-center text-muted-foreground font-medium uppercase tracking-normal text-[10px] opacity-30 bg-muted/5">
                            Warte auf Intelligence-Daten...
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemMonitor;
