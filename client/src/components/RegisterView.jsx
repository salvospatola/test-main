import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { 
    ShieldCheck, Loader2, Check, UserPlus
} from 'lucide-react';
import PhoneInput from './PhoneInput';
import AccessDenied from './AccessDenied';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator
} from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import efgLogo from '../assets/efg-cross-logo.svg';

const api = axios.create({ baseURL: '', withCredentials: true });

const RegisterView = ({ onAuthSuccess }) => {
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('invite');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ 
        firstName: '', lastName: ''
    });
    const [countryCode, setCountryCode] = useState('49');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [resendCount, setResendCount] = useState(0);
    const MAX_RESENDS = 3;

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleRequestOtp = async (e) => {
        if (e) e.preventDefault();
        if (resendTimer > 0 || resendCount >= MAX_RESENDS) return;

        setLoading(true);
        setError('');
        try {
            await api.post('/api/auth/otp/request', { 
                phone: countryCode + phoneNumber, 
                firstName: formData.firstName,
                lastName: formData.lastName,
                registerKey: inviteToken 
            });
            setStep(2);
            setResendTimer(60);
            setResendCount(prev => prev + 1);
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Senden des Codes');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteRegistration = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/api/auth/otp/verify', { 
                phone: countryCode + phoneNumber, 
                code: otp
            });
            onAuthSuccess(res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Registrierung fehlgeschlagen');
        } finally {
            setLoading(false);
        }
    };

    if (!inviteToken) return <AccessDenied title="Zugriff Verweigert" message="Ein gültiger Einladungs-Link ist erforderlich, um sich zu registrieren." />;

    return (
        <Card className="w-full max-w-md mx-auto shadow-2xl border-[rgb(161,206,217)]/50 overflow-hidden page-transition">
            <CardHeader className="text-center pt-10 pb-7 bg-white border-b border-[rgb(161,206,217)]/40">
                <div className="flex justify-center mb-6 animate-in fade-in duration-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <img src={efgLogo} alt="EFG Logo" className="h-14 w-14 object-contain" />
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[1.08rem] font-black tracking-[0.11em] uppercase">
                                <span className="text-[rgb(161,206,217)]">EFG</span>{" "}
                                <span className="text-[rgb(237,132,91)]">Neckarsulm</span>
                            </span>
                            <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Portal</span>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mb-4 h-px w-16 bg-[rgb(161,206,217)]/45" />
                <CardTitle className="text-3xl font-black uppercase tracking-tight text-[rgb(161,206,217)]">Registrieren</CardTitle>
                <CardDescription className="uppercase tracking-[0.2em] text-[10px] font-bold text-muted-foreground mt-2">
                    Zugang zur Community erstellen
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 p-8">
                {error && (
                    <Alert className="animate-in shake duration-300 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <AlertTitle className="text-[10px] font-bold uppercase tracking-normal">Fehler</AlertTitle>
                        <AlertDescription className="text-[11px] font-bold uppercase tracking-tight">{error}</AlertDescription>
                    </Alert>
                )}

                {step === 1 && (
                    <form onSubmit={handleRequestOtp} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <Field>
                                <FieldLabel htmlFor="firstName">Vorname</FieldLabel>
                                <Input id="firstName" placeholder="Max" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required className="font-medium" />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="lastName">Nachname</FieldLabel>
                                <Input id="lastName" placeholder="Mustermann" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required className="font-medium" />
                            </Field>
                        </div>
                        
                        <Separator />
                        <PhoneInput 
                            countryCode={countryCode} setCountryCode={setCountryCode} 
                            phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} 
                            label="WhatsApp Nummer" required onValidationChange={setIsPhoneValid}
                        />
                        <Button type="submit" className="w-full h-14" disabled={loading || !isPhoneValid || !formData.firstName || !formData.lastName} aria-label="Bestätigungscode senden">
                            {loading ? <Loader2 className="animate-spin mr-2" size={24} /> : <Check className="mr-2 h-6 w-6" />}
                            CODE SENDEN
                        </Button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleCompleteRegistration} className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                        <Alert className="border-[rgb(161,206,217)]/55 bg-[rgb(161,206,217)]/12 text-slate-800">
                            <CheckCircle2Icon className="h-4 w-4" />
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-normal">Check WhatsApp</AlertTitle>
                            <AlertDescription className="text-[11px] font-bold uppercase tracking-tight">
                                Wir haben dir einen Registrierungsschlüssel geschickt.
                            </AlertDescription>
                        </Alert>

                        <Field className="flex flex-col items-center">
                            <div className="flex items-center justify-between w-full mb-4 px-1">
                                <FieldLabel className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">
                                    6-stelliger Schlüssel
                                </FieldLabel>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-[9px] font-bold uppercase tracking-widest gap-1.5"
                                    disabled={resendTimer > 0 || resendCount >= MAX_RESENDS || loading}
                                    onClick={handleRequestOtp}
                                >
                                    <RefreshCwIcon className={cn("h-3 w-3", loading && "animate-spin")} />
                                    {resendTimer > 0 ? `Warten (${resendTimer}s)` : resendCount >= MAX_RESENDS ? 'Limit erreicht' : 'Code erneut senden'}
                                </Button>
                            </div>
                            
                            <InputOTP 
                                maxLength={6} 
                                value={otp} 
                                onChange={setOtp}
                                required
                                autoFocus
                                autoComplete="one-time-code"
                                containerClassName="justify-center"
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                    <InputOTPSlot index={1} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                    <InputOTPSlot index={2} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                    <InputOTPSlot index={4} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                    <InputOTPSlot index={5} className="h-14 w-12 text-2xl font-bold border-[rgb(161,206,217)]/60 bg-white" />
                                </InputOTPGroup>
                            </InputOTP>
                        </Field>

                        <div className="space-y-4">
                            <Button type="submit" className="w-full h-16 gap-3 text-lg" disabled={loading || otp.length < 6} aria-label="ACCOUNT ERSTELLEN">
                                {loading ? <Loader2 className="animate-spin" size={28} /> : <ShieldCheck size={28} />}
                                JETZT REGISTRIEREN
                            </Button>
                            <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent hover:text-primary transition-colors" onClick={() => { setStep(1); setOtp(''); setResendCount(0); setResendTimer(0); }} aria-label="Zurück">
                                Zurück zur Eingabe
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
};

export default RegisterView;
