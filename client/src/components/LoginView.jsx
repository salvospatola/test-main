import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ShieldCheck, Loader2, Check, Search, AlertCircle, Phone, Mail, AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';
import PhoneInput from './PhoneInput';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator
} from "@/components/ui/input-otp";
import { RefreshCwIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import efgLogo from '../assets/efg-cross-logo.svg';

const api = axios.create({ baseURL: '', withCredentials: true });
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginView = ({ onAuthSuccess }) => {
    const isLocalDevLoginEnabled = import.meta.env.DEV
        && typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const [step, setStep] = useState(1); // 1: Identifier, 2: OTP
    const [loginMethod, setLoginMethod] = useState('whatsapp'); // whatsapp | email
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [countryCode, setCountryCode] = useState('49');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(false);
    const [email, setEmail] = useState('');
    const [exists, setExists] = useState(null);
    const [checking, setChecking] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [resendCount, setResendCount] = useState(0);
    const MAX_RESENDS = 3;
    const requestInFlightRef = useRef(false);
    const verifyInFlightRef = useRef(false);

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const isEmailValid = EMAIL_REGEX.test(normalizedEmail);

    const handleOtpChange = (value) => {
        setOtp((value || '').replace(/\D/g, '').slice(0, 6));
    };

    const handleOtpComplete = (value) => {
        setOtp((value || '').replace(/\D/g, '').slice(0, 6));
        if (typeof document === 'undefined') return;
        const activeEl = document.activeElement;
        if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
    };

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    useEffect(() => {
        const canCheck = loginMethod === 'whatsapp'
            ? (isPhoneValid && phoneNumber.length > 5)
            : isEmailValid;

        if (!canCheck) {
            setExists(null);
            setError('');
            return;
        }

        setExists(null);
        setError('');
        const timer = setTimeout(async () => {
            setChecking(true);
            try {
                if (loginMethod === 'whatsapp') {
                    const fullPhone = countryCode + phoneNumber;
                    const res = await api.get(`/api/auth/check-phone?phone=${encodeURIComponent(fullPhone)}`);
                    setExists(typeof res?.data?.exists === 'boolean' ? res.data.exists : null);
                } else {
                    const res = await api.get(`/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`);
                    setExists(typeof res?.data?.exists === 'boolean' ? res.data.exists : null);
                }
            } catch (e) {
                setExists(null);
                if (e.response && e.response.status === 429) {
                    setError('Zu viele Anfragen in kurzer Zeit. Bitte warte einen Moment.');
                } else {
                    setError(loginMethod === 'email'
                        ? 'Verbindung zum Server unterbrochen oder ungültige E-Mail.'
                        : 'Verbindung zum Server unterbrochen oder ungültige Nummer.');
                }
            } finally {
                setChecking(false);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [phoneNumber, countryCode, isPhoneValid, normalizedEmail, isEmailValid, loginMethod]);

    const handleRequestOtp = async (e) => {
        if (e) e.preventDefault();
        if (requestInFlightRef.current) return;
        if (!exists) {
            setError('Konto nicht gefunden. Bitte nutze deinen Einladungs-Link.');
            return;
        }
        if (resendTimer > 0 || resendCount >= MAX_RESENDS) return;

        setLoading(true);
        requestInFlightRef.current = true;
        setError('');
        try {
            const payload = loginMethod === 'email'
                ? { method: 'email', email: normalizedEmail }
                : { method: 'whatsapp', phone: countryCode + phoneNumber };
            await api.post('/api/auth/otp/request', payload);
            setStep(2);
            setResendTimer(60);
            setResendCount((prev) => prev + 1);
        } catch (err) {
            if (!err.response) {
                setError('Verbindung zum Server unterbrochen. Bitte erneut versuchen.');
            } else {
                setError(err.response?.data?.error || 'Fehler beim Senden des Codes');
            }
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (verifyInFlightRef.current || submitting || otp.length < 6) return;

        verifyInFlightRef.current = true;
        setSubmitting(true);
        setError('');
        let authSucceeded = false;
        try {
            const payload = loginMethod === 'email'
                ? { method: 'email', email: normalizedEmail, code: otp }
                : { method: 'whatsapp', phone: countryCode + phoneNumber, code: otp };
            const res = await api.post('/api/auth/otp/verify', payload);
            authSucceeded = true;
            await onAuthSuccess(res.data.user);
        } catch (err) {
            if (!err.response) {
                setError('Server momentan nicht erreichbar. Bitte kurz warten und erneut anmelden.');
            } else {
                setError(err.response?.data?.error || 'Code ungültig');
            }
        } finally {
            verifyInFlightRef.current = false;
            if (!authSucceeded) setSubmitting(false);
        }
    };

    const handleDevLogin = async (role) => {
        if (!isLocalDevLoginEnabled || loading || submitting) return;
        setLoading(true);
        setError('');
        try {
            const normalizedRole = String(role || 'ADMIN').toUpperCase();
            const res = await api.get(`/api/dev/mock-login?role=${encodeURIComponent(normalizedRole)}`);
            if (!res?.data?.user) throw new Error('Ungültige Antwort vom Dev-Login.');
            await onAuthSuccess(res.data.user);
        } catch (err) {
            setError(err?.response?.data?.error || 'Lokaler Dev-Login fehlgeschlagen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="relative w-full max-w-md mx-auto overflow-hidden border border-[rgb(161,206,217)]/50 bg-white shadow-2xl page-transition">
            <CardHeader className="text-center pt-10 pb-7 bg-white border-b border-[rgb(161,206,217)]/40">
                <div className="flex justify-center mb-6 animate-in fade-in duration-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <img src={efgLogo} alt="EFG Logo" className="h-14 w-14 object-contain" />
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[1.08rem] font-black tracking-[0.11em] uppercase">
                                <span className="text-[rgb(161,206,217)]">EFG</span>{' '}
                                <span className="text-[rgb(237,132,91)]">Neckarsulm</span>
                            </span>
                            <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Portal</span>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mb-4 h-px w-16 bg-[rgb(161,206,217)]/45" />
                <CardTitle className="text-3xl font-black uppercase tracking-tight text-[rgb(161,206,217)]">Anmelden</CardTitle>
                <CardDescription className="uppercase tracking-[0.2em] text-[10px] font-bold text-muted-foreground mt-2">
                    Sicherer Zugang zum Portal
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 p-8">
                {isLocalDevLoginEnabled && (
                    <div className="space-y-3 rounded-2xl border border-[rgb(161,206,217)]/45 bg-[rgb(161,206,217)]/12 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1">
                            Dev Schnell-Login
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button type="button" variant="outline" className="w-full border-[rgb(161,206,217)]/60 bg-white hover:bg-white" onClick={() => handleDevLogin('ADMIN')}>
                                Login as Admin
                            </Button>
                            <Button type="button" variant="outline" className="w-full border-[rgb(161,206,217)]/60 bg-white hover:bg-white" onClick={() => handleDevLogin('MEMBER')}>
                                Login as Member
                            </Button>
                            <Button type="button" variant="outline" className="w-full border-[rgb(161,206,217)]/60 bg-white hover:bg-white" onClick={() => handleDevLogin('MEMBER')}>
                                Login as Member
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert className="animate-in shake duration-300 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <AlertTitle className="text-[10px] font-bold uppercase tracking-normal">Sicherheitshinweis</AlertTitle>
                        <AlertDescription className="text-[11px] font-bold uppercase tracking-tight leading-relaxed">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                {step === 1 && (
                    <form onSubmit={handleRequestOtp} className="space-y-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/20 p-1">
                                <Button
                                    type="button"
                                    variant={loginMethod === 'whatsapp' ? 'default' : 'ghost'}
                                    className="h-9 text-xs font-bold"
                                    onClick={() => {
                                        setLoginMethod('whatsapp');
                                        setExists(null);
                                        setError('');
                                    }}
                                >
                                    <Phone size={14} className="mr-2" /> WhatsApp
                                </Button>
                                <Button
                                    type="button"
                                    variant={loginMethod === 'email' ? 'default' : 'ghost'}
                                    className="h-9 text-xs font-bold"
                                    onClick={() => {
                                        setLoginMethod('email');
                                        setExists(null);
                                        setError('');
                                    }}
                                >
                                    <Mail size={14} className="mr-2" /> E-Mail
                                </Button>
                            </div>

                            {loginMethod === 'whatsapp' ? (
                                <PhoneInput
                                    countryCode={countryCode}
                                    setCountryCode={setCountryCode}
                                    phoneNumber={phoneNumber}
                                    setPhoneNumber={setPhoneNumber}
                                    label="Deine Nummer"
                                    required
                                    onValidationChange={setIsPhoneValid}
                                />
                            ) : (
                                <Field>
                                    <FieldLabel htmlFor="login-email">Deine E-Mail</FieldLabel>
                                    <Input
                                        id="login-email"
                                        type="email"
                                        className="h-12"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        required
                                    />
                                    <FieldDescription>Wir senden dir den Sicherheitscode an diese Adresse.</FieldDescription>
                                </Field>
                            )}

                            <div className={cn(
                                'p-4 rounded-2xl flex items-center justify-center gap-3 border border-dashed transition-all duration-500 shadow-inner',
                                exists === true ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                    : exists === false ? 'bg-[rgb(237,132,91)]/15 border-[rgb(237,132,91)]/50 text-[rgb(157,73,39)]'
                                        : 'bg-white border-[rgb(161,206,217)]/35 text-muted-foreground'
                            )}>
                                {checking ? (
                                    <><Loader2 size={16} className="animate-spin" /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">{loginMethod === 'email' ? 'Prüfe E-Mail...' : 'Prüfe Nummer...'}</span></>
                                ) : exists === true ? (
                                    <><ShieldCheck size={16} className="stroke-[2.5px]" /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Konto erkannt</span></>
                                ) : exists === false ? (
                                    <><AlertCircle size={16} className="stroke-[2.5px]" /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Nicht registriert</span></>
                                ) : (
                                    <><Search size={16} className="stroke-[2.5px]" /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Bereit zur Prüfung</span></>
                                )}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14"
                            disabled={loading || (loginMethod === 'whatsapp' ? !isPhoneValid : !isEmailValid) || checking || exists !== true}
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : <><Check size={24} /> Code anfordern</>}
                        </Button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                        <Alert className="border-[rgb(161,206,217)]/55 bg-[rgb(161,206,217)]/12 text-slate-800">
                            <CheckCircle2Icon className="h-4 w-4" />
                            <AlertTitle className="text-[10px] font-bold uppercase tracking-normal">Code gesendet</AlertTitle>
                            <AlertDescription className="text-[11px] font-bold uppercase tracking-tight">
                                Wir haben dir einen Sicherheitsschlüssel via {loginMethod === 'email' ? 'E-Mail' : 'WhatsApp'} geschickt.
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
                                    <RefreshCwIcon className={cn('h-3 w-3', loading && 'animate-spin')} />
                                    {resendTimer > 0 ? `Warten (${resendTimer}s)` : resendCount >= MAX_RESENDS ? 'Limit erreicht' : 'Code erneut senden'}
                                </Button>
                            </div>

                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={handleOtpChange}
                                onComplete={handleOtpComplete}
                                required
                                autoFocus
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                name="one-time-code"
                                enterKeyHint="done"
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
                            <Button
                                type="submit"
                                className="w-full h-16 gap-3 text-lg"
                                disabled={submitting || otp.length < 6}
                            >
                                {submitting ? <Loader2 className="animate-spin" size={28} /> : <><ShieldCheck size={28} /> Anmelden</>}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent hover:text-primary transition-colors"
                                onClick={() => { setStep(1); setOtp(''); setResendCount(0); setResendTimer(0); }}
                            >
                                {loginMethod === 'email' ? 'E-Mail ändern' : 'Nummer falsch? Ändern'}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
};

export default LoginView;