import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Terminal, RefreshCw, AlertTriangle, Info, Bug, Ban, Copy, Search, Filter, Check } from 'lucide-react';
import { ConsoleSkeleton } from './Skeletons';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const api = axios.create({ baseURL: '', withCredentials: true });

const SystemLogs = ({ showAlert }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('ALL');
    const [copySuccess, setCopySuccess] = useState(false);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/api/system-logs');
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("System-Logs laden fehlgeschlagen:", e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        let interval;
        if (isLive) {
            interval = setInterval(fetchLogs, 3000);
        }
        return () => clearInterval(interval);
    }, [isLive]);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.message?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             log.source?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
        return matchesSearch && matchesLevel;
    });

    const copyToClipboard = () => {
        const logText = filteredLogs.map(l => 
            `[${new Date(l.createdAt).toLocaleString()}] [${l.level}] [${l.source}] ${l.message}`
        ).join('\n');
        
        navigator.clipboard.writeText(logText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const getLevelStyle = (level) => {
        switch (level) {
            case 'ERROR': return 'destructive';
            case 'WARN': return 'secondary';
            case 'DEBUG': return 'outline';
            default: return 'success';
        }
    };

    if (loading && logs.length === 0) return (
        <div className="space-y-4">
            <ConsoleSkeleton />
        </div>
    );

    return (
        <div className="space-y-6 page-transition">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary shadow-inner border border-primary/20">
                        <Terminal size={24} className="stroke-[2.5px]" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tight text-primary">System-Konsole</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={cn("w-2 h-2 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-normal">{isLive ? 'Live Stream Aktiv' : 'Stream Pausiert'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input 
                            className="pl-9 h-10 font-medium bg-muted/20"
                            placeholder="Suchen..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={copyToClipboard}
                    >
                        {copySuccess ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        <span className="hidden sm:inline">{copySuccess ? 'Kopiert!' : 'Kopieren'}</span>
                    </Button>

                    <Button 
                        variant={isLive ? "secondary" : "default"} 
                        size="sm" 
                        onClick={() => setIsLive(!isLive)}
                    >
                        {isLive ? <Ban size={14} /> : <RefreshCw size={14} />}
                        {isLive ? 'Pause' : 'Live starten'}
                    </Button>
                </div>
            </div>

            <Card className="shadow-2xl border-primary/10 overflow-hidden bg-zinc-950 dark:bg-black rounded-2xl">
                <CardContent className="p-0">
                    <div className="h-[600px] overflow-y-auto custom-scrollbar p-4 font-mono text-[11px] leading-relaxed flex flex-col bg-black/40">
                        <div className="space-y-1">
                            {filteredLogs.map((log) => (
                                <div key={log._id || Math.random()} className="group flex items-start gap-4 px-4 py-2 hover:bg-white/[0.04] transition-all border-l-4 border-transparent hover:border-primary/50">
                                    <span className="text-zinc-600 shrink-0 select-none font-bold opacity-50">[{new Date(log.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                    <Badge variant={getLevelStyle(log.level)} className="shrink-0 w-16 justify-center py-0.5 h-5 text-[9px] font-bold tracking-[0.1em] uppercase px-0 border-2">
                                        {log.level}
                                    </Badge>
                                    <span className="text-primary/70 font-bold shrink-0 min-w-[120px] uppercase tracking-tight opacity-80">[{log.source}]</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-zinc-300 break-words font-medium">{log.message}</span>
                                        {log.details && (
                                            <button 
                                                onClick={() => {
                                                    console.log(`--- LOG DETAILS (${log.source}) ---`);
                                                    console.log(log.details);
                                                    if (showAlert) showAlert('Log Details', 'Die technischen Details wurden in die Browser-Konsole gedruckt (F12 drücken).');
                                                }}
                                                className="ml-3 text-[9px] font-bold uppercase tracking-normal text-primary hover:text-white transition-colors cursor-pointer decoration-2 underline decoration-primary/30 hover:decoration-primary"
                                            >
                                                Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredLogs.length === 0 && !loading && (
                                <div className="text-center py-32 text-muted-foreground border border-dashed border-zinc-800 m-6 rounded-[2rem] bg-white/[0.01]">
                                    <Terminal className="mx-auto mb-4 opacity-10" size={48} />
                                    <p className="font-bold uppercase tracking-[0.3em] text-xs opacity-30">Keine System-Einträge gefunden.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemLogs;
