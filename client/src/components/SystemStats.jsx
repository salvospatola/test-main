import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    TrendingUp, Users, Activity, Clock, RefreshCw, 
    Calendar, ShieldCheck, Heart, MessageSquare, Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';

const api = axios.create({ baseURL: '', withCredentials: true });

const StatCard = ({ title, value, icon, color }) => (
    <Card className="shadow-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
            <div className={cn("p-2 rounded-lg bg-muted", `text-${color}-500`)}>
                {React.cloneElement(icon, { size: 16 })}
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const SystemStats = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('week');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/monitoring/history?range=${range}`);
            setStats(res.data);
        } catch (e) { console.error("Stats laden fehlgeschlagen:", e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStats(); }, [range]);

    if (loading && !stats) return (
        <div className="h-96 flex flex-col items-center justify-center gap-6 text-muted-foreground page-transition">
            <Loader2 className="animate-spin text-primary" size={48} />
            <div className="text-center space-y-2">
                <p className="font-bold uppercase tracking-[0.3em] text-sm ">Analytics Pipeline</p>
                <p className="text-xs font-bold uppercase tracking-normal opacity-50">Aggregiere historische Datenpunkte...</p>
            </div>
        </div>
    );

    const history = stats?.history || [];
    const peaks = stats?.peaks || {};

    return (
        <div className="space-y-10 pb-20 page-transition">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
                <div>
                    <h2 className="text-4xl font-bold tracking-tight uppercase text-primary">System Analytics</h2>
                    <p className="text-muted-foreground text-sm font-medium uppercase tracking-normal mt-1">Auswertung von Performance und Nutzerinteraktionen.</p>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-2xl border shadow-inner">
                    {['day', 'week', 'month'].map(r => (
                        <Button 
                            key={r} 
                            variant={range === r ? "default" : "ghost"} 
                            size="sm" 
                            className={cn(
                                "h-10 px-6 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all",
                                range === r && "shadow-lg shadow-primary/20 scale-105"
                            )}
                            onClick={() => setRange(r)}
                        >
                            {r === 'day' ? '24h' : r === 'week' ? '7T' : '30T'}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Peak Traffic" value={peaks.hourlyTraffic || 0} icon={<TrendingUp />} color="blue" />
                <StatCard title="Interaktionen" value={history.reduce((acc, h) => acc + (h.dbWrites || 0), 0)} icon={<Activity />} color="emerald" />
                <StatCard title="Datenpunkte" value={history.length} icon={<Clock />} color="amber" />
                <StatCard title="System-Uptime" value="99.9%" icon={<ShieldCheck />} color="blue" />
            </div>

            <Card className="shadow-2xl border-primary/5 rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-muted/20 border-b p-8 px-10">
                    <CardTitle className="text-lg font-bold uppercase flex items-center gap-3 text-primary">
                        <TrendingUp size={24} className="text-primary stroke-[3px]" /> Last-Verlauf (Infrastruktur)
                    </CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-normal text-muted-foreground opacity-70">Visualisierung der Ressourcenauslastung über den gewählten Zeitraum.</CardDescription>
                </CardHeader>
                <CardContent className="h-[450px] p-10 pt-12">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis tick={{fontSize: 10, fontWeight: 700}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                            <Tooltip 
                                labelFormatter={(t) => new Date(t).toLocaleString()}
                                contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px'}}
                            />
                            <Area type="monotone" dataKey="cpuUsage" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUsage)" strokeWidth={4} name="CPU %" animationDuration={1500} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemStats;
