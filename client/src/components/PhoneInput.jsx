import React, { useMemo, useEffect, useId } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"

export const COUNTRY_CODES = [
    { code: '49', label: 'DE (+49)', flag: '🇩🇪', iso: 'DE' },
    { code: '43', label: 'AT (+43)', flag: '🇦🇹', iso: 'AT' },
    { code: '41', label: 'CH (+41)', flag: '🇨🇭', iso: 'CH' },
    { code: '33', label: 'FR (+33)', flag: '🇫🇷', iso: 'FR' },
    { code: '39', label: 'IT (+39)', flag: '🇮🇹', iso: 'IT' },
    { code: '34', label: 'ES (+34)', flag: '🇪🇸', iso: 'ES' },
    { code: '1', label: 'US (+1)', flag: '🇺🇸', iso: 'US' },
    { code: '44', label: 'GB (+44)', flag: '🇬🇧', iso: 'GB' }
];

const PhoneInput = ({ countryCode, setCountryCode, phoneNumber, setPhoneNumber, label, required = false, onValidationChange, suggestions = [] }) => {
    const listId = useId();
    const selectedCountry = useMemo(
        () => COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0],
        [countryCode]
    );
    
    const validation = useMemo(() => {
        if (!phoneNumber) return { isValid: !required, isFake: false };
        
        // 1. Check for obviously fake (repetitive)
        const isRepetitive = /^(.)\1{5,}$/.test(phoneNumber) && phoneNumber.length > 5;
        if (isRepetitive) return { isValid: false, isFake: true, error: 'Ungültiges Muster' };

        // 2. Parse with libphonenumber-js
        const country = COUNTRY_CODES.find(c => c.code === countryCode);
        const fullNumber = `+${countryCode}${phoneNumber}`;
        const parsed = parsePhoneNumberFromString(fullNumber, country?.iso);

        const isValid = !!(parsed && parsed.isValid());
        
        return { isValid, isFake: false, formatted: parsed?.formatInternational() };
    }, [phoneNumber, countryCode, required]);

    // Notify parent in an effect to avoid state updates during render
    useEffect(() => {
        if (onValidationChange) {
            onValidationChange(validation.isValid);
        }
    }, [validation.isValid, onValidationChange]);

    const handlePhoneChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.startsWith('0')) val = val.substring(1);
        setPhoneNumber(val);
    };

    const localSuggestions = useMemo(() => {
        const unique = new Set();
        (Array.isArray(suggestions) ? suggestions : []).forEach((raw) => {
            const sourceNumber = typeof raw === 'string' ? raw : (raw?.number || '');
            const normalized = String(sourceNumber || '').replace(/\D/g, '');
            if (!normalized || !normalized.startsWith(countryCode)) return;
            const local = normalized.slice(countryCode.length);
            if (!local || local === phoneNumber) return;
            if (phoneNumber && !local.startsWith(phoneNumber)) return;
            unique.add(local);
        });
        return Array.from(unique).slice(0, 12);
    }, [suggestions, countryCode, phoneNumber]);

    return (
        <Field>
            <div className="flex justify-between items-center">
                {label && (
                    <FieldLabel className="ml-1">
                        {label} {required && <span className="text-destructive">*</span>}
                    </FieldLabel>
                )}
                {phoneNumber && (
                    <span className={cn(
                        "text-[9px] font-bold uppercase tracking-normal flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all duration-500",
                        validation.isValid ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/10 shadow-sm shadow-emerald-500/5" : "text-destructive bg-destructive/5 border-destructive/10"
                    )}>
                        {validation.isValid ? <CheckCircle2 size={10} className="stroke-[3px]" /> : <AlertCircle size={10} className="stroke-[3px]" />}
                        {validation.isValid ? "Validiert" : (validation.error || "Ungültig")}
                    </span>
                )}
            </div>
            
            <div className="flex gap-2.5 sm:gap-3">
                {/* Ländercode */}
                <div className="w-[96px] sm:w-[112px] shrink-0">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="h-12 font-semibold px-2.5 sm:px-3 [&>span]:overflow-visible [&>span]:truncate-none">
                            <div className="flex w-full items-center justify-start gap-2 leading-none">
                                <div className="w-5 text-center text-base leading-none">{selectedCountry.flag}</div>
                                <div className="text-sm font-semibold leading-none">+{selectedCountry.code}</div>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                            {COUNTRY_CODES.map(c => (
                                <SelectItem key={c.code} value={c.code} className="font-bold py-3 uppercase text-[10px] tracking-normal">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 text-center text-base leading-none">{c.flag}</div>
                                        <div className="leading-none">+{c.code}</div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Nummer */}
                <div className="flex-1">
                    <Input 
                        type="tel"
                        placeholder="170 1234567"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        list={localSuggestions.length > 0 ? listId : undefined}
                        className="h-12 text-lg font-bold tracking-tight"
                    />
                    {localSuggestions.length > 0 && (
                        <datalist id={listId}>
                            {localSuggestions.map((value) => (
                                <option key={value} value={value} />
                            ))}
                        </datalist>
                    )}
                </div>
            </div>
            {phoneNumber && !validation.isValid && (
                <FieldDescription className="text-destructive font-bold uppercase tracking-tight ml-1 mt-1 opacity-70 ">
                    Bitte gib eine echte WhatsApp-Nummer ein.
                </FieldDescription>
            )}
        </Field>
    );
};

export default PhoneInput;
