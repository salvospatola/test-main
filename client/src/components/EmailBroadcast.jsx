import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    Loader2,
    Mail,
    Send,
    Users,
    WandSparkles,
    Eye,
    ImagePlus,
    Link2,
    Undo2,
    Redo2,
    Bold,
    Italic,
    Underline,
    Heading2,
    Pilcrow,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Type,
    Palette
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ComboboxMultiple } from "@/components/ui/combobox-multiple";

const api = axios.create({ baseURL: '', withCredentials: true });

const defaultTemplate = `<h2>Hallo zusammen,</h2>
<p>hier kommt ein kurzes Update aus dem EFG NSU Portal.</p>
<p>Viele Grüße<br/>Euer Team</p>`;

const EmailBroadcast = ({ showToast }) => {
    const editorRef = useRef(null);
    const imageInputRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sendToAll, setSendToAll] = useState(false);
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [selectedPositionKeys, setSelectedPositionKeys] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [subject, setSubject] = useState('EFG NSU Portal');
    const [html, setHtml] = useState(defaultTemplate);
    const [textFallback, setTextFallback] = useState('');
    const [showPreview, setShowPreview] = useState(true);
    const [dispatchMode, setDispatchMode] = useState('now');
    const [scheduleName, setScheduleName] = useState('');
    const [scheduleAt, setScheduleAt] = useState('');
    const [scheduleHour, setScheduleHour] = useState('09');
    const [scheduleMinute, setScheduleMinute] = useState('00');
    const [scheduleWeekdays, setScheduleWeekdays] = useState(['*']);
    const [recurrenceType, setRecurrenceType] = useState('weekly');
    const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
    const [scheduleMonth, setScheduleMonth] = useState('1');
    const [scheduleNth, setScheduleNth] = useState('1');
    const [scheduleNthWeekday, setScheduleNthWeekday] = useState('1');
    const [scheduleCronExpression, setScheduleCronExpression] = useState('');
    const [fontSize, setFontSize] = useState('3');
    const [fontColor, setFontColor] = useState('#1f2937');

    const loadAudience = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/email/audience');
            setTeams(Array.isArray(res.data?.teams) ? res.data.teams : []);
            setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
        } catch (e) {
            if (showToast) showToast(e?.response?.data?.error || 'Empfängerdaten konnten nicht geladen werden.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAudience();
    }, []);

    const teamOptions = useMemo(
        () => teams.map((team) => ({ value: String(team._id), label: team.name })),
        [teams]
    );

    const positionOptions = useMemo(() => {
        const options = [];
        teams.forEach((team) => {
            (team.positions || []).forEach((position) => {
                const normalized = String(position || '').trim();
                if (!normalized) return;
                options.push({
                    value: `${String(team._id)}::${normalized.toLowerCase()}`,
                    label: `${team.name} - ${normalized}`
                });
            });
        });
        return options;
    }, [teams]);

    const userOptions = useMemo(
        () => users.map((user) => ({
            value: String(user._id),
            label: `${(user.firstName || user.lastName) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username} (${user.email})`
        })),
        [users]
    );

    const recipientPreview = useMemo(() => {
        if (sendToAll) return users;

        const userIdSet = new Set(selectedUserIds);
        const teamIdSet = new Set(selectedTeamIds);
        const positionSet = new Set(selectedPositionKeys.map((entry) => String(entry || '').toLowerCase()));

        return users.filter((user) => {
            if (userIdSet.has(String(user._id))) return true;
            const teamPositions = Array.isArray(user.teamPositions) ? user.teamPositions : [];
            if (teamPositions.some((tp) => teamIdSet.has(String(tp.teamId || '')))) return true;
            if (teamPositions.some((tp) => {
                const key = `${String(tp.teamId || '')}::${String(tp.position || '').trim().toLowerCase()}`;
                return positionSet.has(key);
            })) return true;
            return false;
        });
    }, [users, sendToAll, selectedUserIds, selectedTeamIds, selectedPositionKeys]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        if (!editor.innerHTML.trim()) editor.innerHTML = html;
    }, []);

    const syncEditorHtml = () => {
        const editor = editorRef.current;
        if (!editor) return;
        setHtml(editor.innerHTML || '');
    };

    const runEditorCommand = (command, value = null) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        document.execCommand(command, false, value);
        syncEditorHtml();
    };

    const applyFontSize = (size) => {
        setFontSize(size);
        runEditorCommand('fontSize', size);
    };

    const applyFontColor = (color) => {
        setFontColor(color);
        runEditorCommand('styleWithCSS', true);
        runEditorCommand('foreColor', color);
    };

    const insertLink = () => {
        const url = window.prompt('URL eingeben (https://...)');
        if (!url) return;
        runEditorCommand('createLink', url);
    };

    const insertImageByUrl = () => {
        const url = window.prompt('Bild-URL eingeben (https://...)');
        if (!url) return;
        runEditorCommand('insertImage', url);
    };

    const triggerImageUpload = () => {
        imageInputRef.current?.click();
    };

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            if (!result) return;
            runEditorCommand('insertImage', result);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const buildRecurringPayload = () => {
        const hour = Number.parseInt(scheduleHour, 10);
        const minute = Number.parseInt(scheduleMinute, 10);

        if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
            throw new Error('Bitte gültige Uhrzeit setzen.');
        }

        return {
            mode: 'recurring',
            name: scheduleName.trim(),
            recurrenceType,
            hour,
            minute,
            weekdays: scheduleWeekdays,
            dayOfMonth: Number.parseInt(scheduleDayOfMonth, 10),
            month: Number.parseInt(scheduleMonth, 10),
            nth: Number.parseInt(scheduleNth, 10),
            nthWeekday: Number.parseInt(scheduleNthWeekday, 10),
            cronExpression: scheduleCronExpression.trim()
        };
    };

    const sendBroadcast = async () => {
        if (!subject.trim()) {
            if (showToast) showToast('Bitte Betreff eintragen.', 'error');
            return;
        }
        if (!(html || '').trim() && !textFallback.trim()) {
            if (showToast) showToast('Bitte einen E-Mail-Inhalt eintragen.', 'error');
            return;
        }
        if (!sendToAll && recipientPreview.length === 0) {
            if (showToast) showToast('Bitte mindestens einen Empfängerkreis auswählen.', 'error');
            return;
        }

        setSending(true);
        try {
            const payload = {
                subject: subject.trim(),
                html,
                text: textFallback.trim(),
                filters: {
                    sendToAll,
                    teamIds: selectedTeamIds,
                    positionKeys: selectedPositionKeys,
                    userIds: selectedUserIds
                }
            };

            if (dispatchMode === 'now') {
                const res = await api.post('/api/admin/email/send', payload);
                if (showToast) {
                    showToast(
                        `Versand abgeschlossen: ${res.data?.successCount || 0}/${res.data?.totalRecipients || 0} erfolgreich.`,
                        res.data?.failedCount > 0 ? 'warning' : 'success'
                    );
                }
            } else if (dispatchMode === 'once') {
                if (!scheduleAt) {
                    if (showToast) showToast('Bitte Zeitpunkt für die Queue-Ausführung wählen.', 'error');
                    setSending(false);
                    return;
                }
                const res = await api.post('/api/admin/email/schedule', {
                    mode: 'once',
                    name: scheduleName.trim(),
                    runAt: new Date(scheduleAt).toISOString(),
                    ...payload
                });
                if (showToast) showToast(`In Queue geplant: ${res.data?.job?.name || 'Email Versand'}`, 'success');
            } else {
                let recurringPayload;
                try {
                    recurringPayload = buildRecurringPayload();
                } catch (buildErr) {
                    if (showToast) showToast(buildErr.message || 'Ungültige Serien-Planung.', 'error');
                    setSending(false);
                    return;
                }
                const res = await api.post('/api/admin/email/schedule', {
                    ...recurringPayload,
                    ...payload
                });
                if (showToast) showToast(`Serienjob erstellt: ${res.data?.job?.name || 'Email Versand'}`, 'success');
            }
        } catch (e) {
            if (showToast) showToast(e?.response?.data?.error || 'E-Mail Versand fehlgeschlagen.', 'error');
        } finally {
            setSending(false);
        }
    };

    const toggleWeekday = (dayValue) => {
        if (dayValue === '*') {
            setScheduleWeekdays(['*']);
            return;
        }
        const current = Array.isArray(scheduleWeekdays) ? scheduleWeekdays : ['*'];
        const withoutAll = current.filter((day) => day !== '*');
        const exists = withoutAll.includes(dayValue);
        let next = exists ? withoutAll.filter((day) => day !== dayValue) : [...withoutAll, dayValue];
        if (next.length === 0) next = ['*'];
        setScheduleWeekdays(next.sort((a, b) => Number(a) - Number(b)));
    };

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3 text-primary">
                        <Mail size={30} /> Email Versand
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium uppercase tracking-normal mt-1">
                        Kampagnen an alle, Teams, Positionen oder einzelne Nutzer senden.
                    </p>
                </div>
                <Button variant="outline" className="gap-2" onClick={loadAudience}>
                    <Users size={16} /> Empfänger neu laden
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wide">Empfänger</CardTitle>
                        <CardDescription>Die Zielgruppe wird als Vereinigung aller Auswahlfelder ermittelt.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            variant={sendToAll ? "default" : "outline"}
                            className="w-full"
                            onClick={() => setSendToAll((prev) => !prev)}
                        >
                            {sendToAll ? 'An alle mit E-Mail' : 'Nur ausgewählte Empfänger'}
                        </Button>

                        {!sendToAll && (
                            <>
                                <Field className="space-y-2">
                                    <FieldLabel>Teams</FieldLabel>
                                    <ComboboxMultiple
                                        options={teamOptions}
                                        selected={selectedTeamIds}
                                        onChange={setSelectedTeamIds}
                                        placeholder="Teams auswählen..."
                                    />
                                </Field>

                                <Field className="space-y-2">
                                    <FieldLabel>Positionen</FieldLabel>
                                    <ComboboxMultiple
                                        options={positionOptions}
                                        selected={selectedPositionKeys}
                                        onChange={setSelectedPositionKeys}
                                        placeholder="Positionen auswählen..."
                                    />
                                </Field>

                                <Field className="space-y-2">
                                    <FieldLabel>Einzelne Personen</FieldLabel>
                                    <ComboboxMultiple
                                        options={userOptions}
                                        selected={selectedUserIds}
                                        onChange={setSelectedUserIds}
                                        placeholder="Nutzer auswählen..."
                                    />
                                </Field>
                            </>
                        )}

                        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empfänger Vorschau</p>
                            <Badge variant="secondary">{recipientPreview.length} Empfänger</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="xl:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wide">Nachricht</CardTitle>
                        <CardDescription>HTML-Inhalt für den Versand. Vorschau zeigt die gerenderte E-Mail.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Field className="space-y-2">
                            <FieldLabel>Betreff</FieldLabel>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff" />
                        </Field>

                        <div className="space-y-3 rounded-lg border p-3 bg-muted/10">
                            <Field className="space-y-2">
                                <FieldLabel>Versandmodus</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant={dispatchMode === 'now' ? "default" : "outline"} onClick={() => setDispatchMode('now')}>Sofort senden</Button>
                                    <Button type="button" size="sm" variant={dispatchMode === 'once' ? "default" : "outline"} onClick={() => setDispatchMode('once')}>In Queue planen</Button>
                                    <Button type="button" size="sm" variant={dispatchMode === 'recurring' ? "default" : "outline"} onClick={() => setDispatchMode('recurring')}>Serie (Automatisierung)</Button>
                                </div>
                            </Field>

                            {dispatchMode !== 'now' && (
                                <Field className="space-y-2">
                                    <FieldLabel>Job-Name (optional)</FieldLabel>
                                    <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="z.B. Monatsnewsletter" />
                                </Field>
                            )}

                            {dispatchMode === 'once' && (
                                <Field className="space-y-2">
                                    <FieldLabel>Ausführen am</FieldLabel>
                                    <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                                </Field>
                            )}

                            {dispatchMode === 'recurring' && (
                                <div className="space-y-3">
                                    <Field className="space-y-2">
                                        <FieldLabel>Serien-Typ</FieldLabel>
                                        <select
                                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                            value={recurrenceType}
                                            onChange={(e) => setRecurrenceType(e.target.value)}
                                        >
                                            <option value="daily">Täglich</option>
                                            <option value="weekly">Wöchentlich</option>
                                            <option value="monthly_day">Monatlich (Tag)</option>
                                            <option value="monthly_weekday">Monatlich (x. Wochentag)</option>
                                            <option value="yearly">Jährlich</option>
                                            <option value="cron">Cron (Erweitert)</option>
                                        </select>
                                    </Field>

                                    {recurrenceType !== 'cron' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input type="number" min={0} max={23} value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)} placeholder="Stunde" />
                                            <Input type="number" min={0} max={59} value={scheduleMinute} onChange={(e) => setScheduleMinute(e.target.value)} placeholder="Minute" />
                                        </div>
                                    )}

                                    {recurrenceType === 'weekly' && (
                                        <div className="space-y-2">
                                            <FieldLabel>Wochentage</FieldLabel>
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" size="sm" variant={scheduleWeekdays.includes('*') ? "default" : "outline"} onClick={() => toggleWeekday('*')}>Täglich</Button>
                                                {[
                                                    ['1', 'Mo'],
                                                    ['2', 'Di'],
                                                    ['3', 'Mi'],
                                                    ['4', 'Do'],
                                                    ['5', 'Fr'],
                                                    ['6', 'Sa'],
                                                    ['0', 'So']
                                                ].map(([value, label]) => (
                                                    <Button
                                                        key={value}
                                                        type="button"
                                                        size="sm"
                                                        variant={!scheduleWeekdays.includes('*') && scheduleWeekdays.includes(value) ? "default" : "outline"}
                                                        onClick={() => toggleWeekday(value)}
                                                    >
                                                        {label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {recurrenceType === 'monthly_day' && (
                                        <Field className="space-y-2">
                                            <FieldLabel>Tag im Monat (1-31)</FieldLabel>
                                            <Input type="number" min={1} max={31} value={scheduleDayOfMonth} onChange={(e) => setScheduleDayOfMonth(e.target.value)} />
                                        </Field>
                                    )}

                                    {recurrenceType === 'monthly_weekday' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field className="space-y-2">
                                                <FieldLabel>Woche im Monat</FieldLabel>
                                                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scheduleNth} onChange={(e) => setScheduleNth(e.target.value)}>
                                                    <option value="1">1.</option>
                                                    <option value="2">2.</option>
                                                    <option value="3">3.</option>
                                                    <option value="4">4.</option>
                                                    <option value="5">5.</option>
                                                </select>
                                            </Field>
                                            <Field className="space-y-2">
                                                <FieldLabel>Wochentag</FieldLabel>
                                                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scheduleNthWeekday} onChange={(e) => setScheduleNthWeekday(e.target.value)}>
                                                    <option value="1">Montag</option>
                                                    <option value="2">Dienstag</option>
                                                    <option value="3">Mittwoch</option>
                                                    <option value="4">Donnerstag</option>
                                                    <option value="5">Freitag</option>
                                                    <option value="6">Samstag</option>
                                                    <option value="0">Sonntag</option>
                                                </select>
                                            </Field>
                                        </div>
                                    )}

                                    {recurrenceType === 'yearly' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field className="space-y-2">
                                                <FieldLabel>Tag</FieldLabel>
                                                <Input type="number" min={1} max={31} value={scheduleDayOfMonth} onChange={(e) => setScheduleDayOfMonth(e.target.value)} />
                                            </Field>
                                            <Field className="space-y-2">
                                                <FieldLabel>Monat</FieldLabel>
                                                <Input type="number" min={1} max={12} value={scheduleMonth} onChange={(e) => setScheduleMonth(e.target.value)} />
                                            </Field>
                                        </div>
                                    )}

                                    {recurrenceType === 'cron' && (
                                        <Field className="space-y-2">
                                            <FieldLabel>Cron Expression</FieldLabel>
                                            <Input
                                                value={scheduleCronExpression}
                                                onChange={(e) => setScheduleCronExpression(e.target.value)}
                                                placeholder="z.B. 0 9 * * 1#1"
                                            />
                                            <FieldDescription>Voller Cron-Mode (5 Felder). Beispiel: 0 9 * * 1#1 = erster Montag im Monat, 09:00.</FieldDescription>
                                        </Field>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 rounded-md border bg-background p-2">
                            <div className="flex flex-wrap items-center gap-1">
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('bold')} title="Fett">
                                    <Bold size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('italic')} title="Kursiv">
                                    <Italic size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('underline')} title="Unterstreichen">
                                    <Underline size={14} />
                                </Button>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('formatBlock', 'H2')} title="Überschrift">
                                    <Heading2 size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('formatBlock', 'P')} title="Absatz">
                                    <Pilcrow size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('insertUnorderedList')} title="Liste">
                                    <List size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('insertOrderedList')} title="Nummerierte Liste">
                                    <ListOrdered size={14} />
                                </Button>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('justifyLeft')} title="Linksbündig">
                                    <AlignLeft size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('justifyCenter')} title="Zentriert">
                                    <AlignCenter size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('justifyRight')} title="Rechtsbündig">
                                    <AlignRight size={14} />
                                </Button>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <Button size="icon" variant="outline" onClick={insertLink} title="Link einfügen">
                                    <Link2 size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={insertImageByUrl} title="Bild per URL">
                                    <ImagePlus size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={triggerImageUpload} title="Bild hochladen">
                                    <ImagePlus size={14} />
                                </Button>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('undo')} title="Undo">
                                    <Undo2 size={14} />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => runEditorCommand('redo')} title="Redo">
                                    <Redo2 size={14} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant={showPreview ? "secondary" : "outline"}
                                    onClick={() => setShowPreview((prev) => !prev)}
                                    title="Vorschau"
                                >
                                    <Eye size={14} />
                                </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Type size={13} />
                                    Größe
                                </label>
                                <select
                                    className="h-8 rounded-md border bg-background px-2 text-sm"
                                    value={fontSize}
                                    onChange={(e) => applyFontSize(e.target.value)}
                                >
                                    <option value="1">Sehr klein</option>
                                    <option value="2">Klein</option>
                                    <option value="3">Normal</option>
                                    <option value="4">Gross</option>
                                    <option value="5">Sehr groß</option>
                                    <option value="6">XL</option>
                                    <option value="7">XXL</option>
                                </select>
                                <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
                                    <Palette size={13} />
                                    Farbe
                                </label>
                                <input
                                    type="color"
                                    value={fontColor}
                                    onChange={(e) => applyFontColor(e.target.value)}
                                    className="h-8 w-10 cursor-pointer rounded border bg-background p-1"
                                    title="Schriftfarbe"
                                />
                            </div>
                        </div>

                        <Field className="space-y-2">
                            <FieldLabel>WYSIWYG Editor</FieldLabel>
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={syncEditorHtml}
                                className="min-h-[280px] w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </Field>

                        <Field className="space-y-2">
                            <FieldLabel>Text Fallback (optional)</FieldLabel>
                            <textarea
                                value={textFallback}
                                onChange={(e) => setTextFallback(e.target.value)}
                                className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder="Optionaler Klartext-Fallback"
                            />
                            <FieldDescription>Wird genutzt, falls E-Mail-Clients HTML nicht anzeigen.</FieldDescription>
                        </Field>

                        {showPreview && (
                            <div className="rounded-lg border bg-background p-4 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                                    <WandSparkles size={14} /> Vorschau
                                </p>
                                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html || '' }} />
                            </div>
                        )}

                        <Button className="w-full gap-2 h-11" onClick={sendBroadcast} disabled={sending}>
                            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                            {dispatchMode === 'now' ? 'Jetzt senden' : dispatchMode === 'once' ? 'In Queue speichern' : 'Serienjob erstellen'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default EmailBroadcast;


