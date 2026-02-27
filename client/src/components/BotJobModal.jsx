import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Calendar, Bell, MessageSquare, User, Users, AlertCircle, Info, Activity, FileSpreadsheet
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ComboboxMultiple } from "@/components/ui/combobox-multiple";
import PhoneInput, { COUNTRY_CODES } from './PhoneInput';
import { toast } from "sonner";

const api = axios.create({ baseURL: '', withCredentials: true });

const WEEKDAY_OPTIONS = [
    { value: '1', label: 'Mo' },
    { value: '2', label: 'Di' },
    { value: '3', label: 'Mi' },
    { value: '4', label: 'Do' },
    { value: '5', label: 'Fr' },
    { value: '6', label: 'Sa' },
    { value: '0', label: 'So' }
];

const TargetSelector = ({ value, onChange, groups = [], label = "Empfänger" }) => {
    const isGroup = value && value.toString().includes('@g.us');
    const [mode, setMode] = useState(isGroup ? 'group' : 'individual');
    const [countryCode, setCountryCode] = useState('49');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(true);
    
    useEffect(() => {
        if (value && value.toString().includes('@g.us')) {
            setMode('group');
        } else if (value) {
            setMode('individual');
            const sortedCodes = [...COUNTRY_CODES].sort((a,b) => b.code.length - a.code.length);
            const valStr = value.toString();
            const match = sortedCodes.find(c => valStr.startsWith(c.code));
            if (match) {
                setCountryCode(match.code);
                setPhoneNumber(valStr.substring(match.code.length));
            } else {
                setPhoneNumber(valStr);
            }
        }
    }, [value]);

    const handlePhoneChange = (newNum) => {
        setPhoneNumber(newNum);
        if (newNum) {
            onChange(countryCode + newNum);
        } else {
            onChange('');
        }
    };

    const handleCountryChange = (newCode) => {
        setCountryCode(newCode);
        if (phoneNumber) {
            onChange(newCode + phoneNumber);
        }
    };

    return (
        <Field>
            <div className="flex justify-between items-center mb-2">
                <FieldLabel>{label}</FieldLabel>
                {mode === 'individual' && phoneNumber && !isPhoneValid && (
                    <span className="text-[10px] font-bold text-destructive flex items-center gap-1">
                        <AlertCircle size={12} /> UNGÜLTIG
                    </span>
                )}
            </div>
            <div className="flex bg-muted p-1 rounded-lg border mb-4">
                <Button 
                    type="button" 
                    variant={mode === 'individual' ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 gap-2 text-xs font-medium h-8"
                    onClick={() => { setMode('individual'); onChange(''); setPhoneNumber(''); }}
                >
                    <User size={14} /> EINZELPERSON
                </Button>
                <Button 
                    type="button" 
                    variant={mode === 'group' ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 gap-2 text-xs font-medium h-8"
                    onClick={() => { setMode('group'); onChange(''); }}
                >
                    <Users size={14} /> GRUPPE
                </Button>
            </div>
            {mode === 'group' ? (
                <Select value={value || ""} onValueChange={onChange}>
                    <SelectTrigger className="h-12">
                        <SelectValue placeholder="Gruppe wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.isArray(groups) && groups.map((g, gIdx) => (
                            <SelectItem key={g._id || g.id || `group-${gIdx}`} value={g._id || g.id}>
                                {g.subject}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <PhoneInput 
                    countryCode={countryCode} setCountryCode={handleCountryChange}
                    phoneNumber={phoneNumber} setPhoneNumber={handlePhoneChange}
                    onValidationChange={setIsPhoneValid}
                />
            )}
        </Field>
    );
};

export const JOB_TYPES = {
    'PLAN_UPDATE': {
        label: 'Musikplan Info',
        icon: <Calendar size={20} />,
        description: 'Sendet den nächsten relevanten Dienst mit offenen Rollen und einem zentralen Event-Link.',
        variables: ['service_date', 'service_topic', 'service_topic_line', 'open_roles', 'event_link', 'filled_roles', 'filled_roles_block'],
        targetField: 'targetJid',
        templateFields: [
            { key: 'template', label: 'Template', placeholder: '*Dienstplan Update: $(service_date)*\\n$(service_topic_line)\\n\\n*Gesuchte Dienste:*\\n$(open_roles)\\n\\n*Eintragen & Details:*\\n$(event_link)\\n$(filled_roles_block)' }
        ],
        defaults: {
            template: '*Dienstplan Update: $(service_date)*\n$(service_topic_line)\n\n*Gesuchte Dienste:*\n$(open_roles)\n\n*Eintragen & Details:*\n$(event_link)\n$(filled_roles_block)'
        }
    },
    'PROBE_ANNOUNCE': {
        label: 'Probe Info',
        icon: <Bell size={20} />,
        description: 'Sendet Infos zur nächsten hinterlegten Probe im kommenden Dienst.',
        variables: ['probe_date', 'probe_time', 'service_type', 'service_topic'],
        targetField: 'targetJid',
        templateFields: [
            { key: 'template', label: 'Template', placeholder: '*Erinnerung: Probe am $(probe_date)*\\n\\nUhrzeit: $(probe_time) Uhr\\nTyp: $(service_type)\\nThema: $(service_topic)' }
        ],
        defaults: {
            template: '*Erinnerung: Probe am $(probe_date)*\n\nUhrzeit: $(probe_time) Uhr\nTyp: $(service_type)\nThema: $(service_topic)'
        }
    },
    'CHECK_REMINDERS': {
        label: 'Dienst Erinnerung',
        icon: <Bell size={20} />,
        description: 'Prüft Dienste in einem frei definierbaren Tagesfenster und benachrichtigt eingeteilte Personen mit intelligentem Timing-Text.',
        variables: ['service_date', 'service_date_iso', 'days_until', 'timing_phrase', 'role_name', 'username', 'first_name', 'last_name'],
        targetField: null,
        templateFields: [
            { key: 'daysBeforeMin', label: 'Ab wie vielen Tagen vorher', placeholder: '1', rows: 2 },
            { key: 'daysBeforeMax', label: 'Bis wie viele Tage vorher', placeholder: '3', rows: 2 },
            { key: 'cooldownHours', label: 'Cooldown (Stunden, Anti-Spam)', placeholder: '12', rows: 2 },
            { key: 'appTitleTemplate', label: 'Template Titel', placeholder: 'Diensterinnerung', rows: 2 },
            { key: 'appMessageTemplate', label: 'Template Nachricht', placeholder: '$(timing_phrase) bist du zur Aufgabe "$(role_name)" eingeteilt.' }
        ],
        defaults: {
            daysBeforeMin: '1',
            daysBeforeMax: '3',
            cooldownHours: '12',
            categories: [],
            appTitleTemplate: 'Diensterinnerung',
            appMessageTemplate: '$(timing_phrase) bist du zur Aufgabe "$(role_name)" eingeteilt.'
        }
    },
    'SYSTEM_STATS': {
        label: 'System Monitor',
        icon: <Activity size={20} />,
        description: 'Sammelt regelmäßig Systemmetriken für das Monitoring-Dashboard.',
        variables: [],
        targetField: null,
        templateFields: [],
        defaults: {}
    },
    'RUNSHEET_DISTRIBUTE': {
        label: 'Ablaufplan Versand',
        icon: <FileSpreadsheet size={20} />,
        description: 'Erstellt den Ablaufplan aus der Excel-Vorlage und sendet ihn an eingeteilte Personen.',
        variables: ['service_date', 'service_type', 'first_name', 'last_name'],
        targetField: null,
        templateFields: [
            { key: 'daysBefore', label: 'Wie viele Tage vorher', placeholder: '2', rows: 2 },
            { key: 'subjectTemplate', label: 'E-Mail Betreff', placeholder: 'Ablaufplan $(service_date) ($(service_type))', rows: 2 },
            { key: 'messageTemplate', label: 'Nachricht', placeholder: 'Hallo $(first_name), anbei der Ablaufplan für den Dienst am $(service_date).', rows: 3 }
        ],
        defaults: {
            daysBefore: '2',
            categories: [],
            sendEmail: true,
            sendWhatsApp: true,
            subjectTemplate: 'Ablaufplan $(service_date) ($(service_type))',
            messageTemplate: 'Hallo $(first_name), anbei der Ablaufplan für den Dienst am $(service_date).'
        }
    },
    'SIMPLE_MESSAGE': {
        label: 'Nachricht',
        icon: <MessageSquare size={20} />,
        description: 'Sendet eine frei definierte Nachricht an Nummer oder Gruppe.',
        variables: ['message'],
        targetField: 'number',
        templateFields: [
            { key: 'message', label: 'Nachricht', placeholder: 'Deine Nachricht mit Emojis 👍 und Zeilenumbrüchen' }
        ],
        defaults: {
            message: ''
        }
    }
};

const BotJobModal = ({ isOpen, onClose, onSave, jobForm, setJobForm, groups, currentUser }) => {
    const selectedType = JOB_TYPES[jobForm.type] || JOB_TYPES.PLAN_UPDATE;
    const [categoryOptions, setCategoryOptions] = useState([]);

    useEffect(() => {
        if (!isOpen || !['CHECK_REMINDERS', 'RUNSHEET_DISTRIBUTE'].includes(jobForm.type)) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/api/plan/categories');
                if (cancelled) return;
                const options = Array.isArray(res.data?.categories)
                    ? res.data.categories
                        .map((entry) => String(entry || '').trim())
                        .filter(Boolean)
                        .map((name) => ({ label: name, value: name }))
                    : [];
                setCategoryOptions(options);
            } catch (_e) {
                if (!cancelled) setCategoryOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, jobForm.type]);

    const handleParamChange = (key, value) => {
        setJobForm(prev => ({
            ...prev,
            params: { ...prev.params, [key]: value }
        }));
    };

    const toggleWeekday = (dayValue) => {
        const current = Array.isArray(jobForm.weekdays) && jobForm.weekdays.length > 0 ? jobForm.weekdays : ['*'];
        if (dayValue === '*') {
            setJobForm({ ...jobForm, weekdays: ['*'] });
            return;
        }

        const withoutAll = current.filter((day) => day !== '*');
        const alreadySelected = withoutAll.includes(dayValue);
        let next = alreadySelected ? withoutAll.filter((day) => day !== dayValue) : [...withoutAll, dayValue];
        if (next.length === 0) next = ['*'];
        next = [...next].sort((a, b) => Number(a) - Number(b));
        setJobForm({ ...jobForm, weekdays: next });
    };

    const handleSave = () => {
        if (!jobForm.name?.trim()) return toast.error("Bitte einen Namen für die Aufgabe eingeben.");
        
        const finalJob = { ...jobForm };
        if (jobForm.mode === 'recurring') {
            if (!jobForm.hour || !jobForm.minute) return toast.error("Bitte eine gültige Uhrzeit angeben.");
            const selectedWeekdays = Array.isArray(jobForm.weekdays) && jobForm.weekdays.length > 0 ? jobForm.weekdays : ['*'];
            const weekdayCron = selectedWeekdays.includes('*')
                ? '*'
                : [...new Set(selectedWeekdays)].sort((a, b) => Number(a) - Number(b)).join(',');
            finalJob.cronExpression = `${jobForm.minute} ${jobForm.hour} * * ${weekdayCron}`;
            finalJob.executionTime = null;
        } else {
            if (!jobForm.executionTime) return toast.error("Bitte einen Ausführungszeitpunkt wählen.");
            if (new Date(jobForm.executionTime) < new Date()) return toast.error("Der Ausführungszeitpunkt muss in der Zukunft liegen.");
            finalJob.cronExpression = null;
        }

        // Specific Type Validation
        if (selectedType.targetField === 'number') {
            if (!jobForm.params.number) return toast.error("Bitte einen Empfänger angeben.");
            if (!jobForm.params.message?.trim()) return toast.error("Bitte eine Nachricht eingeben.");
        } else if (selectedType.targetField === 'targetJid') {
            if (!jobForm.params.targetJid) return toast.error("Bitte eine Zielgruppe oder Nummer angeben.");
        } else if (jobForm.type === 'CHECK_REMINDERS') {
            const minDays = Number.parseInt(jobForm.params?.daysBeforeMin ?? '1', 10);
            const maxDays = Number.parseInt(jobForm.params?.daysBeforeMax ?? String(minDays), 10);
            const cooldown = Number.parseInt(jobForm.params?.cooldownHours ?? '12', 10);
            if (!Number.isInteger(minDays) || minDays < 0) return toast.error("Bitte einen gültigen Startwert (>=0) für Tage vorher angeben.");
            if (!Number.isInteger(maxDays) || maxDays < minDays) return toast.error("Der Endwert für Tage vorher muss >= Startwert sein.");
            if (!Number.isInteger(cooldown) || cooldown < 1) return toast.error("Cooldown muss mindestens 1 Stunde sein.");
            const categories = (Array.isArray(jobForm.params?.categories) ? jobForm.params.categories : [])
                .map((entry) => String(entry || '').trim())
                .filter(Boolean);
            finalJob.params = {
                ...finalJob.params,
                categories
            };
        } else if (jobForm.type === 'RUNSHEET_DISTRIBUTE') {
            const daysBefore = Number.parseInt(jobForm.params?.daysBefore ?? '2', 10);
            if (!Number.isInteger(daysBefore) || daysBefore < 0) return toast.error("Bitte einen gültigen Wert (>=0) für Tage vorher angeben.");
            const categories = (Array.isArray(jobForm.params?.categories) ? jobForm.params.categories : [])
                .map((entry) => String(entry || '').trim())
                .filter(Boolean);
            finalJob.params = {
                ...finalJob.params,
                daysBefore: String(daysBefore),
                categories,
                sendEmail: jobForm.params?.sendEmail !== false,
                sendWhatsApp: jobForm.params?.sendWhatsApp !== false
            };
        }

        onSave(finalJob);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl rounded-xl border">
                <DialogHeader className="p-6 pb-4 bg-muted/30 border-b">
                    <DialogTitle className="text-xl font-bold tracking-tight">Aufgabe planen</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Automatische WhatsApp-Aktionen.</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <Field>
                        <FieldLabel htmlFor="jobName">Job Name</FieldLabel>
                        <Input id="jobName" className="h-10 font-medium" placeholder="z.B. Team-Info" value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(JOB_TYPES).map(([key, def], jtIdx) => (
                            <button 
                                key={`${key}-${jtIdx}`} 
                                onClick={() => setJobForm({
                                    ...jobForm,
                                    type: key,
                                    params: {
                                        ...(jobForm.params || {}),
                                        ...(def.defaults || {})
                                    }
                                })} 
                                className={cn(
                                    "border rounded-lg p-4 flex flex-col items-center gap-2 transition-all relative",
                                    jobForm.type === key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                )}
                            >
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="absolute right-2 top-2 opacity-70 hover:opacity-100">
                                                <Info size={12} />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs text-xs">
                                            <p className="font-semibold mb-1">{def.description}</p>
                                            {Array.isArray(def.variables) && def.variables.length > 0 && (
                                                <p>Variablen: {def.variables.map(v => `$(${v})`).join(', ')}</p>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {def.icon}
                                <span className="text-[10px] font-bold uppercase tracking-tight text-center">{def.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex bg-muted p-1 rounded-lg border">
                        <Button variant={jobForm.mode === 'recurring' ? "default" : "ghost"} size="sm" className="flex-1 font-bold text-[10px] h-8" onClick={() => setJobForm({...jobForm, mode: 'recurring'})}>Wiederkehrend</Button>
                        <Button variant={jobForm.mode === 'once' ? "default" : "ghost"} size="sm" className="flex-1 font-bold text-[10px] h-8" onClick={() => setJobForm({...jobForm, mode: 'once'})}>Einmalig</Button>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-4">
                        {jobForm.mode === 'recurring' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel className="text-[10px] font-bold uppercase tracking-wider">Serie</FieldLabel>
                                    <div className="space-y-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={(jobForm.weekdays || ['*']).includes('*') ? "default" : "outline"}
                                            className="w-full h-9 text-[10px] font-bold uppercase tracking-wide"
                                            onClick={() => toggleWeekday('*')}
                                        >
                                            Täglich
                                        </Button>
                                        <div className="grid grid-cols-4 gap-2">
                                            {WEEKDAY_OPTIONS.map((day) => {
                                                const activeDays = jobForm.weekdays || ['*'];
                                                const isActive = !activeDays.includes('*') && activeDays.includes(day.value);
                                                return (
                                                    <Button
                                                        key={day.value}
                                                        type="button"
                                                        size="sm"
                                                        variant={isActive ? "default" : "outline"}
                                                        className="h-8 text-[10px] font-bold"
                                                        onClick={() => toggleWeekday(day.value)}
                                                    >
                                                        {day.label}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Field>
                                <Field>
                                    <FieldLabel className="text-[10px] font-bold uppercase tracking-wider">Uhrzeit</FieldLabel>
                                    <Input 
                                        type="time" 
                                        className="h-10 font-medium bg-background" 
                                        value={`${(jobForm.hour || '10').toString().padStart(2, '0')}:${(jobForm.minute || '00').toString().padStart(2, '0')}`} 
                                        onChange={e => {
                                            const [h, m] = e.target.value.split(':');
                                            setJobForm({...jobForm, hour: h, minute: m});
                                        }} 
                                    />
                                </Field>
                            </div>
                        ) : (
                            <Field className="grid gap-2">
                                <FieldLabel className="text-[10px] font-bold uppercase tracking-wider ml-1">Ausführungszeitpunkt</FieldLabel>
                                <DateTimePicker 
                                    value={jobForm.executionTime}
                                    onChange={val => setJobForm({...jobForm, executionTime: val})}
                                />
                            </Field>
                        )}
                        <div className="pt-4 border-t border-dashed space-y-4">
                            {selectedType.targetField === 'targetJid' && (
                                <TargetSelector
                                    key="target-jid"
                                    label="Ziel"
                                    value={jobForm.params?.targetJid}
                                    onChange={v => handleParamChange('targetJid', v)}
                                    groups={groups}
                                />
                            )}
                            {selectedType.targetField === 'number' && (
                                <TargetSelector
                                    key="target-number"
                                    label="Ziel"
                                    value={jobForm.params?.number}
                                    onChange={v => handleParamChange('number', v)}
                                    groups={groups}
                                />
                            )}
                            {Array.isArray(selectedType.templateFields) && selectedType.templateFields.map((field) => (
                                <Field key={field.key}>
                                    <div className="flex items-center gap-2">
                                        <FieldLabel>{field.label}</FieldLabel>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button type="button" className="text-muted-foreground hover:text-foreground">
                                                        <Info size={12} />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs text-xs">
                                                    Variablen: {(selectedType.variables || []).map(v => `$(${v})`).join(', ') || 'Keine'}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Textarea
                                        placeholder={field.placeholder}
                                        rows={field.rows || 5}
                                        className="font-medium text-sm"
                                        value={jobForm.params?.[field.key] ?? (selectedType.defaults?.[field.key] || '')}
                                        onChange={e => handleParamChange(field.key, e.target.value)}
                                    />
                                </Field>
                            ))}
                            {jobForm.type === 'CHECK_REMINDERS' && (
                                <Field>
                                    <FieldLabel>Kategorien (optional)</FieldLabel>
                                    <ComboboxMultiple
                                        placeholder="Kategorien auswählen..."
                                        selected={Array.isArray(jobForm.params?.categories) ? jobForm.params.categories : []}
                                        onChange={(vals) => handleParamChange('categories', vals)}
                                        options={categoryOptions}
                                    />
                                    {Array.isArray(jobForm.params?.categories) && jobForm.params.categories.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {jobForm.params.categories.map((entry) => (
                                                <Badge key={entry} variant="secondary" className="text-[10px] font-bold">
                                                    {entry}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </Field>
                            )}
                            {jobForm.type === 'RUNSHEET_DISTRIBUTE' && (
                                <>
                                    <Field>
                                        <FieldLabel>Kategorien (optional)</FieldLabel>
                                        <ComboboxMultiple
                                            placeholder="Kategorien auswählen..."
                                            selected={Array.isArray(jobForm.params?.categories) ? jobForm.params.categories : []}
                                            onChange={(vals) => handleParamChange('categories', vals)}
                                            options={categoryOptions}
                                        />
                                        {Array.isArray(jobForm.params?.categories) && jobForm.params.categories.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {jobForm.params.categories.map((entry) => (
                                                    <Badge key={entry} variant="secondary" className="text-[10px] font-bold">
                                                        {entry}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </Field>
                                    <Field>
                                        <FieldLabel>Versandkanäle</FieldLabel>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={jobForm.params?.sendWhatsApp !== false ? "default" : "outline"}
                                                className="h-9 text-xs font-bold"
                                                onClick={() => handleParamChange('sendWhatsApp', !(jobForm.params?.sendWhatsApp !== false))}
                                            >
                                                WhatsApp
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={jobForm.params?.sendEmail !== false ? "default" : "outline"}
                                                className="h-9 text-xs font-bold"
                                                onClick={() => handleParamChange('sendEmail', !(jobForm.params?.sendEmail !== false))}
                                            >
                                                E-Mail
                                            </Button>
                                        </div>
                                    </Field>
                                </>
                            )}
                            {!selectedType.targetField && (
                                <p className="text-xs text-muted-foreground font-medium">
                                    Dieser Job sendet automatisch an eingeteilte Benutzer. Für Debug-Läufe kannst du später ein Testziel pro Job angeben.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
                    <Button className="w-full font-bold" onClick={handleSave}>
                        AUFGABE SICHERN
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BotJobModal;
