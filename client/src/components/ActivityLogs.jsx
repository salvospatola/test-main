import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Loader2, Search, Filter, Clock, Globe, Shield, User as UserIcon, 
    ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Database
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { TableRowSkeleton } from './Skeletons';

const api = axios.create({ baseURL: '', withCredentials: true });

const ActivityLogs = ({ showDetails }) => {
    const [data, setData] = useState({ logs: [], total: 0, pages: 1, page: 1 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        method: '',
        path: '',
        from: '',
        to: '',
        limit: 50
    });
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = { ...filters, page };
            const res = await api.get('/api/activity-logs', { params });
            setData(res.data || { logs: [], total: 0, pages: 1, page: 1 });
        } catch (e) {
            console.error("Logs laden fehlgeschlagen:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchLogs, 500);
        return () => clearTimeout(timer);
    }, [filters, page]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); 
    };

    const resetFilters = () => {
        setFilters({ search: '', method: '', path: '', from: '', to: '', limit: 50 });
        setPage(1);
    };

    return (
        <div className="space-y-8 page-transition">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-4 text-primary">
                        <Database className="text-primary stroke-[2.5px]" size={32} />
                        Aktivitäts-Log
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium uppercase tracking-normal mt-1">Systemzugriffe und Benutzeraktionen ({data.total || 0} Einträge)</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            className="pl-10 font-medium"
                            placeholder="IP, Aktion oder Pfad..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>
                    <Button 
                        variant={showFilters ? "secondary" : "outline"} 
                        size="icon"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={20} className={cn(showFilters && "text-primary")} />
                    </Button>
                </div>
            </div>

            {showFilters && (
                <Card className="bg-muted/30 border-dashed animate-in slide-in-from-top-2 overflow-hidden">
                    <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Field>
                            <FieldLabel className="ml-1">Methode</FieldLabel>
                            <Select value={filters.method || "ALL"} onValueChange={v => handleFilterChange('method', v === "ALL" ? "" : v)}>
                                <SelectTrigger className="bg-background font-bold h-10">
                                    <SelectValue placeholder="Alle Methoden" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL" className="font-bold text-[10px] uppercase tracking-normal">Alle Methoden</SelectItem>
                                    <SelectItem value="GET" className="font-bold text-[10px] uppercase tracking-normal">GET</SelectItem>
                                    <SelectItem value="POST" className="font-bold text-[10px] uppercase tracking-normal">POST</SelectItem>
                                    <SelectItem value="PUT" className="font-bold text-[10px] uppercase tracking-normal">PUT</SelectItem>
                                    <SelectItem value="DELETE" className="font-bold text-[10px] uppercase tracking-normal">DELETE</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel className="ml-1">Pfad-Filter</FieldLabel>
                            <Input 
                                className="bg-background font-medium h-10"
                                placeholder="/api/plan..."
                                value={filters.path}
                                onChange={(e) => handleFilterChange('path', e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel className="ml-1">Zeitraum von</FieldLabel>
                            <Input 
                                className="bg-background font-bold h-10"
                                type="date"
                                value={filters.from}
                                onChange={(e) => handleFilterChange('from', e.target.value)}
                            />
                        </Field>
                        <div className="flex items-end">
                            <Button variant="ghost" className="w-full h-10 gap-2 font-bold text-[10px] uppercase tracking-normal text-muted-foreground hover:text-destructive transition-colors" onClick={resetFilters}>
                                <X size={14} className="stroke-[3px]" /> Filter zurücksetzen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-xl border-primary/5 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="pl-8 uppercase text-[10px] font-bold tracking-normal py-4">Zeitpunkt</TableHead>
                            <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Benutzer / IP</TableHead>
                            <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Aktion</TableHead>
                            <TableHead className="uppercase text-[10px] font-bold tracking-normal py-4">Pfad</TableHead>
                            <TableHead className="text-right pr-8 uppercase text-[10px] font-bold tracking-normal py-4">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array(10).fill(0).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                        ) : data.logs && data.logs.length > 0 ? data.logs.map((log, lIdx) => (
                            <TableRow key={log._id || log.id || `log-${lIdx}`} className="hover:bg-muted/5 transition-colors border-b">
                                <TableCell className="pl-8 whitespace-nowrap py-4">
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <Clock size={12} className="stroke-[2.5px]" />
                                        <span className="text-[11px] font-bold">{log.createdAt ? new Date(log.createdAt).toLocaleString('de-DE') : '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4">
                                    {log.UserId ? (
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="h-7 w-7 rounded-full p-0 justify-center bg-primary/5 text-primary border-primary/20 font-bold">
                                                {(log.UserId.username || '?')[0].toUpperCase()}
                                            </Badge>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs tracking-tight">{log.UserId.username || 'Unbekannt'}</span>
                                                <span className="text-[9px] text-muted-foreground font-medium">{log.ip}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="bg-muted p-1.5 rounded-lg">
                                                <Globe size={12} className="text-muted-foreground stroke-[2.5px]" />
                                            </div>
                                            <span className="text-xs font-mono font-medium text-muted-foreground">{log.ip}</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Badge variant={
                                            log.method === 'GET' ? 'secondary' :
                                            log.method === 'POST' ? 'success' :
                                            log.method === 'PUT' ? 'default' : 'destructive'
                                        } className="w-fit text-[8px] h-4 font-bold tracking-normal px-1.5">
                                            {log.method || '???'}
                                        </Badge>
                                        <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/70 truncate max-w-[150px]">{(log.action || '').replace('API_', '')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4">
                                    <code className="text-[10px] text-primary font-bold bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">{log.path}</code>
                                </TableCell>
                                <TableCell className="text-right pr-8 py-4">
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" onClick={() => showDetails('Log Details', log.params || log)}>
                                        <Database size={16} className="stroke-[2.5px]" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium uppercase tracking-normal text-[10px]">
                                    Keine Log-Einträge gefunden.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="p-6 border-t bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em]">
                        Seite <span className="text-primary">{data.page || 1}</span> von {data.pages || 1}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={page <= 1 || loading} 
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft size={20} />
                        </Button>
                        <div className="flex gap-2">
                            {[...Array(Math.min(3, data.pages || 1))].map((_, i) => {
                                let pNum = (data.page || 1) > 2 ? (data.page || 1) - 1 + i : i + 1;
                                if (pNum > (data.pages || 1)) return null;
                                return (
                                    <Button 
                                        key={pNum} 
                                        variant={page === pNum ? "default" : "outline"} 
                                        size="sm" 
                                        onClick={() => setPage(pNum)}
                                    >
                                        {pNum}
                                    </Button>
                                );
                            })}
                        </div>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={page >= (data.pages || 1) || loading} 
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ActivityLogs;
