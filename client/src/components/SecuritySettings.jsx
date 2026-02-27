import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Shield, ShieldAlert, Key, Link as LinkIcon, 
    Copy, Trash2, Check, X, Loader2, UserPlus, Info, Plus, ShieldCheck, Ban, RefreshCw, AlertTriangle, Lock, Mail, Send
} from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

const api = axios.create({ baseURL: '', withCredentials: true });

const SecuritySettings = ({ showToast }) => {
    const [config, setConfig] = useState({ registrationOpen: false });
    const [bans, setBans] = useState([]);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [inviteValidDays, setInviteValidDays] = useState(7);
    const [inviteRoleName, setInviteRoleName] = useState('MEMBER');
    const [masterCode, setMasterCode] = useState('');
    const [savingSecret, setSavingSecret] = useState(false);
    const [testEmailTo, setTestEmailTo] = useState('');
    const [testEmailSubject, setTestEmailSubject] = useState('EFG NSU Portal - Test E-Mail');
    const [testEmailMessage, setTestEmailMessage] = useState('Dies ist eine Testnachricht aus dem Admin-Bereich.');
    const [sendingTestEmail, setSendingTestEmail] = useState(false);

    const fetchData = async () => {
        try {
            const [c, i, b, s] = await Promise.all([
                api.get('/api/admin/security/config').catch(() => ({ data: { registrationOpen: false } })),
                api.get('/api/admin/invites').catch(() => ({ data: [] })),
                api.get('/api/monitoring/bans').catch(() => ({ data: [] })),
                api.get('/api/admin/settings/register-secret').catch(() => ({ data: { exists: false } }))
            ]);
            setConfig(c.data);
            setInvites(i.data);
            setBans(b.data);
            // Master code is hashed, so we don't display it, just let them set a new one
        } catch (e) { 
            console.error("Sicherheitsdaten laden fehlgeschlagen:", e);
            if (showToast) showToast("Fehler beim Laden der Sicherheitsdaten", "error");
        }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleRegistration = async () => {
        try {
            const res = await api.post('/api/admin/security/toggle-registration');
            setConfig(prev => ({ ...prev, registrationOpen: res.data.open }));
            showToast(res.data.open ? "Registrierung geöffnet" : "Registrierung geschlossen", "success");
        } catch (e) { showToast("Fehler bei Registrierungs-Toggle", "error"); }
    };

    const generateInvite = async () => {
        setGenerating(true);
        try {
            const days = Math.min(Math.max(Number(inviteValidDays) || 1, 1), 7);
            const res = await api.post('/api/admin/invites/generate', { validDays: days, roleName: inviteRoleName });
            setInvites(prev => [res.data.invite, ...prev]);
            showToast(`Einladungs-Link (${days} Tage, Rolle ${inviteRoleName}) generiert`, "success");
        } catch (e) { showToast("Einladung generieren fehlgeschlagen", "error"); }
        finally { setGenerating(false); }
    };

    const deleteInvite = async (id) => {
        try {
            await api.delete(`/api/admin/invites/${id}`);
            setInvites(prev => prev.filter(i => i._id !== id));
            showToast("Link gelöscht", "info");
        } catch (e) { showToast("Link löschen fehlgeschlagen", "error"); }
    };

    const removeBan = async (id) => {
        try {
            await api.delete(`/api/monitoring/bans/${id}`);
            setBans(prev => prev.filter(b => b._id !== id));
            showToast("IP erfolgreich entsperrt", "success");
        } catch (e) { showToast("IP entsperren fehlgeschlagen", "error"); }
    };

    const saveSecret = async () => {
        if (!masterCode) return;
        setSavingSecret(true);
        try {
            await api.post('/api/admin/settings/register-secret', { secret: masterCode });
            setMasterCode('');
            showToast("Master Registrierungs-Code aktualisiert", "success");
        } catch (e) { showToast("Code speichern fehlgeschlagen", "error"); }
        finally { setSavingSecret(false); }
    };

    const sendTestEmail = async () => {
        if (!testEmailTo.trim()) {
            if (showToast) showToast("Bitte Empfänger-E-Mail eintragen", "error");
            return;
        }
        setSendingTestEmail(true);
        try {
            const res = await api.post('/api/admin/email/test', {
                to: testEmailTo.trim(),
                subject: testEmailSubject.trim(),
                message: testEmailMessage
            });
            if (showToast) showToast(`Test-E-Mail an ${res.data?.to || testEmailTo} gesendet`, "success");
        } catch (e) {
            if (showToast) showToast(e?.response?.data?.error || "Test-E-Mail Versand fehlgeschlagen", "error");
        } finally {
            setSendingTestEmail(false);
        }
    };

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-10 page-transition">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-4 text-primary">
                        <Shield className="text-primary stroke-[2.5px]" size={32} />
                        Sicherheit & Zugriff
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium uppercase tracking-normal mt-1">Verwalte die Registrierung und globale IP-Sperren.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 shadow-xl border-primary/10 overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                            <Lock size={16} className="text-primary stroke-[2.5px]" /> System-Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8 p-8">
                        <div className={cn(
                            "p-8 rounded-[2rem] border-2 flex flex-col items-center text-center gap-6 transition-all duration-500 shadow-inner",
                            config?.registrationOpen ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5" : "bg-destructive/5 border-destructive/20 shadow-destructive/5"
                        )}>
                            <div className={cn(
                                "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-transform hover:scale-110 duration-300",
                                config?.registrationOpen ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/20" : "bg-destructive/20 text-destructive border border-destructive/20"
                            )}>
                                {config?.registrationOpen ? <ShieldCheck size={32} className="stroke-[2.5px]" /> : <ShieldAlert size={32} className="stroke-[2.5px]" />}
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold uppercase tracking-normal text-sm">Öffentliche Registrierung</p>
                                <p className={cn(
                                    "text-[10px] font-bold uppercase tracking-[0.3em] px-3 py-1 rounded-full border inline-block",
                                    config?.registrationOpen ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                                )}>
                                    Status: {config?.registrationOpen ? 'GEÖFFNET' : 'GESCHLOSSEN'}
                                </p>
                            </div>
                            <Button 
                                variant={config?.registrationOpen ? "destructive" : "default"}
                                className="w-full"
                                onClick={toggleRegistration}
                            >
                                {config?.registrationOpen ? 'Jetzt Schließen' : 'System Öffnen'}
                            </Button>
                        </div>

                        <Field className="pt-6 border-t">
                            <FieldLabel htmlFor="masterCode" className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] ml-1">Master Registrierungs-Code</FieldLabel>
                            <div className="flex gap-3">
                                <Input 
                                    id="masterCode"
                                    type="password" 
                                    placeholder="Neuen Code setzen..." 
                                    value={masterCode}
                                    onChange={(e) => setMasterCode(e.target.value)}
                                    className="font-mono"
                                />
                                <Button 
                                    variant={masterCode ? "default" : "secondary"} 
                                    size="icon" 
                                    onClick={saveSecret}
                                    disabled={!masterCode || savingSecret}
                                    className={cn(
                                        "transition-all duration-300",
                                        masterCode && "shadow-lg shadow-primary/20 scale-105 hover:scale-110 active:scale-95"
                                    )}
                                >
                                    {savingSecret ? <Loader2 className="animate-spin" size={20} /> : <Key size={20} />}
                                </Button>
                            </div>
                            <Alert>
                                <InfoIcon className="h-4 w-4" />
                                <AlertDescription className="text-[9px] font-bold uppercase tracking-tight">
                                    Dieser Code ermöglicht die Registrierung auch wenn das System geschlossen ist.
                                </AlertDescription>
                            </Alert>
                        </Field>

                        <Field className="pt-6 border-t space-y-3">
                            <FieldLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Mail size={14} /> E-Mail Testversand
                            </FieldLabel>
                            <Input
                                type="email"
                                placeholder="Empfänger E-Mail"
                                value={testEmailTo}
                                onChange={(e) => setTestEmailTo(e.target.value)}
                                className="font-medium"
                            />
                            <Input
                                type="text"
                                placeholder="Betreff"
                                value={testEmailSubject}
                                onChange={(e) => setTestEmailSubject(e.target.value)}
                                className="font-medium"
                            />
                            <textarea
                                value={testEmailMessage}
                                onChange={(e) => setTestEmailMessage(e.target.value)}
                                className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
                                placeholder="Nachricht"
                            />
                            <Button
                                className="w-full gap-2"
                                onClick={sendTestEmail}
                                disabled={sendingTestEmail}
                            >
                                {sendingTestEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Test-E-Mail senden
                            </Button>
                            <FieldDescription>
                                Nutzt die globale SMTP-Konfiguration (z.B. app@efg-neckarsulm.de).
                            </FieldDescription>
                        </Field>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 shadow-xl border-primary/5 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/30 border-b p-8">
                        <div>
                            <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-2 text-primary">
                                <LinkIcon size={16} className="text-primary stroke-[2.5px]" /> Einladungs-Management
                            </CardTitle>
                            <CardDescription className="text-[10px] mt-1 uppercase font-bold tracking-normal text-muted-foreground">Registrierungs-Links (mehrfach nutzbar bis Ablauf)</CardDescription>
                        </div>
                        <div className="flex items-end gap-2">
                            <Field className="space-y-1">
                                <FieldLabel htmlFor="invite-role-name" className="text-[9px] uppercase font-bold tracking-[0.15em] text-muted-foreground">
                                    Rolle
                                </FieldLabel>
                                <Select value={inviteRoleName} onValueChange={setInviteRoleName}>
                                    <SelectTrigger id="invite-role-name" className="h-9 w-[140px] font-bold">
                                        <SelectValue placeholder="Rolle wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEMBER">Mitglied</SelectItem>
                                        <SelectItem value="GUEST">Gast</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field className="space-y-1">
                                <FieldLabel htmlFor="invite-valid-days" className="text-[9px] uppercase font-bold tracking-[0.15em] text-muted-foreground">
                                    Gültig (1-7 Tage)
                                </FieldLabel>
                                <Input
                                    id="invite-valid-days"
                                    type="number"
                                    min={1}
                                    max={7}
                                    value={inviteValidDays}
                                    onChange={(e) => setInviteValidDays(Math.min(Math.max(Number(e.target.value) || 1, 1), 7))}
                                    className="h-9 w-24 text-center font-bold"
                                />
                            </Field>
                            <Button size="sm" className="gap-2" onClick={generateInvite} disabled={generating}>
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={18} />}
                                Link erstellen
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                        <TableRow className="border-b">
                                            <TableHead className="text-[10px] font-bold uppercase tracking-normal pl-8 py-4">Token / Link</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-normal py-4">Zielrolle</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-normal py-4">Erstellt am</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-normal py-4">Gültig bis</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase tracking-normal pr-8 py-4">Aktionen</TableHead>
                                        </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invites.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-16 text-muted-foreground font-medium uppercase tracking-normal text-[10px]">Keine aktiven Einladungen vorhanden.</TableCell>
                                        </TableRow>
                                    ) : invites.map(invite => (
                                        <TableRow key={invite._id} className="hover:bg-muted/5 transition-colors border-b">
                                            <TableCell className="font-mono text-[10px] font-bold text-primary pl-8 py-4">
                                                {invite.token}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-tight">
                                                    {invite.roleName || 'MEMBER'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground py-4">
                                                {new Date(invite.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground py-4">
                                                {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2 pr-8 py-4">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?invite=${invite.token}`); showToast("Kopiert!", "success"); }}>
                                                    <Copy size={16} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 transition-all" onClick={() => deleteInvite(invite._id)}>
                                                    <Trash2 size={16} />
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

            <Card className="shadow-xl border-destructive/10 overflow-hidden">
                <CardHeader className="bg-destructive/5 border-b p-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-destructive/10 p-3 rounded-2xl text-destructive shadow-inner border border-destructive/20">
                            <Ban size={24} className="stroke-[2.5px]" />
                        </div>
                        <div>
                            <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold text-destructive">Gesperrte IP-Adressen</CardTitle>
                            <CardDescription className="text-[10px] mt-1 uppercase font-bold tracking-normal text-muted-foreground/70">Automatisierte und manuelle Sicherheits-Sperren</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-hidden">
                        <Table>
                            <TableHeader className="bg-destructive/5">
                                <TableRow className="border-b border-destructive/10">
                                    <TableHead className="text-[10px] font-bold uppercase tracking-normal pl-8 py-4 text-destructive/70">IP Adresse</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-normal py-4 text-destructive/70">Grund der Sperre</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-normal py-4 text-destructive/70">Gesperrt am</TableHead>
                                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-normal pr-8 py-4 text-destructive/70">Aktionen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bans.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-16 text-muted-foreground font-medium uppercase tracking-normal text-[10px]">Keine gesperrten IPs in der Liste.</TableCell>
                                    </TableRow>
                                ) : bans.map(ban => (
                                    <TableRow key={ban._id} className="hover:bg-destructive/5 transition-colors border-b border-destructive/5">
                                        <TableCell className="font-mono text-xs font-bold pl-8 py-4">{ban.ip}</TableCell>
                                        <TableCell className="py-4">
                                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight bg-destructive/5 border-destructive/20 text-destructive">{ban.reason}</Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-muted-foreground py-4">
                                            {new Date(ban.createdAt).toLocaleString('de-DE')}
                                        </TableCell>
                                        <TableCell className="text-right pr-8 py-4">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => removeBan(ban._id)}
                                            >
                                                Freischalten
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
    );
};

export default SecuritySettings;
