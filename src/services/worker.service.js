import sharp from 'sharp';
import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { Post, User, Channel, SystemLog, ScheduledJob, JobLog, MusicPlan, SystemStat, Notification, ActivityLog, ThreatLog } from './db.service.js';
import whatsappService from './whatsapp.service.js';
import emailService from './email.service.js';
import { findUserByName } from './user.service.js';
import { saveImageBuffer } from './media.service.js';
import { generateRunSheetBuffer } from './runsheet.service.js';
import pidusage from 'pidusage';
import os from 'os';
import mongoose from 'mongoose';

let activeCronJobs = [];

const JOB_DEFAULT_TEMPLATES = {
    SIMPLE_MESSAGE: '$(message)',
    PLAN_UPDATE: '*Dienstplan Update: $(service_date)*\n$(service_topic_line)\n\n*Gesuchte Dienste:*\n$(open_roles)\n\n*Eintragen & Details:*\n$(event_link)\n$(filled_roles_block)',
    PROBE_ANNOUNCE: '*Erinnerung: Probe am $(probe_date)*\n\nUhrzeit: $(probe_time) Uhr\nTyp: $(service_type)\nThema: $(service_topic)',
    CHECK_REMINDERS_TITLE: 'Diensterinnerung',
    CHECK_REMINDERS_MESSAGE: '$(timing_phrase) bist du zur Aufgabe "$(role_name)" eingeteilt.',
    RUNSHEET_SUBJECT: 'Ablaufplan $(service_date) ($(service_type))',
    RUNSHEET_MESSAGE: 'Hallo $(first_name), anbei der Ablaufplan für den Dienst am $(service_date).'
};

const renderTemplate = (template, variables = {}) => {
    if (!template || typeof template !== 'string') return '';
    return template.replace(/\$\(([a-zA-Z0-9_]+)\)/g, (_, key) => {
        const value = variables[key];
        return value === undefined || value === null ? '' : String(value);
    });
};

const normalizeTemplateText = (value) => {
    if (!value) return '';
    return String(value)
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const toMidnight = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const parseYmdLocal = (ymd) => {
    if (!ymd || typeof ymd !== 'string') return toMidnight(new Date());
    const [year, month, day] = ymd.split('-').map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) return toMidnight(new Date(ymd));
    return new Date(year, month - 1, day);
};

const formatYmdLocal = (dateValue) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const cleanStringArray = (value) =>
    Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean)
        : [];

const stripHtml = (value) =>
    String(value || '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const resolveEmailRecipients = async (filters = {}) => {
    const sendToAll = Boolean(filters?.sendToAll);
    const userIds = cleanStringArray(filters?.userIds);
    const teamIds = new Set(cleanStringArray(filters?.teamIds));
    const positionKeys = new Set(cleanStringArray(filters?.positionKeys).map((entry) => entry.toLowerCase()));

    if (!sendToAll && userIds.length === 0 && teamIds.size === 0 && positionKeys.size === 0) {
        return [];
    }

    const candidates = await User.find({
        email: { $exists: true, $ne: '' },
        status: { $ne: 'HIDDEN' }
    }).select('username email teamPositions');

    const explicitUsers = new Set(userIds);
    return candidates.filter((user) => {
        if (sendToAll) return true;
        if (explicitUsers.has(String(user._id))) return true;
        const positions = Array.isArray(user.teamPositions) ? user.teamPositions : [];
        if (positions.some((tp) => teamIds.has(String(tp?.TeamId || '')))) return true;
        if (positions.some((tp) => {
            const key = `${String(tp?.TeamId || '')}::${String(tp?.position || '').trim().toLowerCase()}`;
            return positionKeys.has(key);
        })) return true;
        return false;
    });
};

const buildReminderTimingPhrase = (daysUntil, serviceDate) => {
    if (daysUntil <= 0) return `Heute (${serviceDate})`;
    if (daysUntil === 1) return `Morgen (${serviceDate})`;
    return `Am ${serviceDate}`;
};

const PLAN_ROLE_KEYS = [
    'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
    'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
];

const toServiceDatePretty = (ymd) => {
    const parsed = parseYmdLocal(ymd);
    if (Number.isNaN(parsed.getTime())) return String(ymd || '');
    return parsed.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const resolveAssignedUsersForPlan = async (plan) => {
    const usernames = Array.from(new Set(
        PLAN_ROLE_KEYS
            .map((key) => String(plan?.[key] || '').trim())
            .filter((value) => value && value !== '/' && value !== '?' && value !== '-')
    ));
    if (usernames.length === 0) return [];
    return User.find({ username: { $in: usernames } }).select('username firstName lastName email phone');
};

/**
 * Initialisiert den Scheduler und lädt alle aktiven Jobs aus der Datenbank.
 */
export const initScheduler = async () => {
    // Vorherige Jobs stoppen
    activeCronJobs.forEach(job => {
        if (job && typeof job.stop === 'function') job.stop();
    });
    activeCronJobs = [];

    try {
        const jobs = await ScheduledJob.find({ active: true });
        console.log(`⏰ Initialisiere Scheduler: ${jobs.length} aktive Aufgaben gefunden.`);

        for (const job of jobs) {
            try {
                if (job.cronExpression) {
                    // Wiederkehrender Job
                    const cronJob = cron.schedule(job.cronExpression, () => runJob(job));
                    activeCronJobs.push(cronJob);
                    
                    // Nächsten Lauf berechnen und speichern
                    const interval = CronExpressionParser.parse(job.cronExpression);
                    job.nextRun = interval.next().toDate();
                    await job.save();
                } else if (job.executionTime) {
                    const execTime = new Date(job.executionTime);
                    // Check if time is in the past (within a small margin of 1 minute)
                    if (execTime > new Date(Date.now() - 60000)) {
                        // Einmaliger Job
                        const delay = Math.max(0, execTime.getTime() - Date.now());
                        const timeoutJob = setTimeout(() => runJob(job), delay);
                        activeCronJobs.push({ stop: () => clearTimeout(timeoutJob) });
                        job.nextRun = execTime;
                        await job.save();
                    }
                }
            } catch (jobErr) {
                console.error(`Fehler beim Einplanen von Job ${job.name}:`, jobErr);
            }
        }
    } catch (err) {
        console.error('Fehler beim Initialisieren des Schedulers:', err);
    }
};

const runJob = async (job, isManual = false, options = {}) => {
    // Refresh job from DB to check if still active
    const dbJob = await ScheduledJob.findById(job._id);
    if (!dbJob || (!dbJob.active && !isManual)) return;
    const debugTargetJid = options?.overrideTargetJid || null;

    console.log(`🚀 Führe Aufgabe aus: ${dbJob.name} (${dbJob.type})${isManual ? ' [MANUELL]' : ''}`);
    
    try {
        let message = '';
        if (dbJob.type === 'SIMPLE_MESSAGE') {
            const { number, message: text } = dbJob.params || {};
            const target = debugTargetJid || number;
            if (!target) throw new Error("Keine Zielnummer/Zielgruppe konfiguriert.");
            const rendered = normalizeTemplateText(renderTemplate(text || JOB_DEFAULT_TEMPLATES.SIMPLE_MESSAGE, { message: text || '' }));
            await whatsappService.sendMessage(target, rendered);
            message = `Nachricht an ${target} gesendet.${debugTargetJid ? ' (Debug-Ziel)' : ''}`;
        } else if (dbJob.type === 'PLAN_UPDATE') {
            const { targetJid, template } = dbJob.params || {};
            const target = debugTargetJid || targetJid;
            if (!target) {
                throw new Error("Keine Ziel-JID (Gruppe/Nummer) für Plan-Update konfiguriert.");
            }
            const todayStr = new Date().toISOString().split('T')[0];
            
            console.log(`[PLAN_UPDATE] Starting job for ${target}, today: ${todayStr}`);

            // Finde die nächsten Termine
            const upcomingPlans = await MusicPlan.find({ 
                Datum: { $gte: todayStr }
            }).sort({ Datum: 1 }).limit(10);

            console.log(`[PLAN_UPDATE] Found ${upcomingPlans.length} upcoming entries in total.`);

            const musicRoles = ['Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Gesang1', 'Gesang2'];
            const allRoles = [
                { k: 'Leitung', l: '👤 Leitung' },
                { k: 'Anbetungsstunde', l: '🙏 Anbetung' },
                { k: 'Organisator', l: '📋 Musik-Orga' },
                { k: 'TechnikPC', l: '💻 Technik' },
                { k: 'TechnikSound', l: '🔊 Sound' },
                { k: 'Klavier', l: '🎹 Klavier' },
                { k: 'Gitarre', l: '🎸 Gitarre' },
                { k: 'Bass', l: '🎸 Bass' },
                { k: 'Schlagzeug', l: '🥁 Drums' },
                { k: 'Gesang1', l: '🎤 Gesang 1' },
                { k: 'Gesang2', l: '🎤 Gesang 2' }
            ];

            let selectedPlan = null;
            let openRoles = [];
            let filledRoles = [];

            // Suche den ersten Termin, der:
            // 1. Einen Organisator hat (Musik-Orga eingetragen)
            // 2. Mindestens eine Musik-Rolle offen hat
            for (const plan of upcomingPlans) {
                const typ = (plan.Typ || '').trim();
                if (typ === 'Text' || typ === 'Wall') continue; 

                // Check criteria 1: Organisator assigned?
                const hasOrga = plan.Organisator && plan.Organisator !== '' && plan.Organisator !== '?' && plan.Organisator !== '/' && plan.Organisator !== '-';
                if (!hasOrga) continue;

                const tempOpen = [];
                const tempFilled = [];
                let hasOpenMusicRole = false;

                for (const role of allRoles) {
                    const val = plan[role.k];
                    const isEmpty = !val || val === '' || val === '?' || val === '-' || val.trim() === '';
                    
                    if (isEmpty) {
                        tempOpen.push(role);
                        if (musicRoles.includes(role.k)) hasOpenMusicRole = true;
                    } else if (val !== '/') {
                        tempFilled.push({ label: role.l, val });
                    }
                }

                // Check criteria 2: At least one music role open?
                if (hasOpenMusicRole) {
                    selectedPlan = plan;
                    openRoles = tempOpen;
                    filledRoles = tempFilled;
                    break;
                }
            }

            if (selectedPlan && openRoles.length > 0) {
                const dateStr = selectedPlan.Datum.split('-').reverse().join('.');
                const baseUrlRaw = String(process.env.BASE_URL || '').trim();
                const baseUrl = baseUrlRaw && baseUrlRaw !== '/'
                    ? baseUrlRaw.replace(/\/+$/, '')
                    : 'http://localhost:5173';
                const openRoleLines = openRoles.map((role) => role.l);
                const eventLink = `${baseUrl}/dienstplaner/detail/${selectedPlan._id}`;

                const filledRoleLines = [];
                if (filledRoles.length > 0) {
                    for (const r of filledRoles) {
                        const user = await User.findOne({ username: r.val });
                        const name = user ? `${user.firstName} ${user.lastName}`.trim() : r.val;
                        filledRoleLines.push(`${r.label}: ${name}`);
                    }
                }

                const templateVars = {
                    service_date: dateStr,
                    service_topic: selectedPlan.Thema || '',
                    service_topic_line: selectedPlan.Thema ? `📝 ${selectedPlan.Thema}` : '',
                    open_roles: openRoleLines.join('\n'),
                    event_link: eventLink,
                    filled_roles: filledRoleLines.join('\n'),
                    filled_roles_block: filledRoleLines.length > 0 ? `*Bereits eingeteilt:*\n${filledRoleLines.join('\n')}` : ''
                };

                let renderedTemplate = renderTemplate(template || JOB_DEFAULT_TEMPLATES.PLAN_UPDATE, templateVars);
                if (!renderedTemplate.includes(eventLink)) {
                    renderedTemplate = `${renderedTemplate}\n\n*Eintragen & Details:*\n${eventLink}`;
                }
                const finalText = normalizeTemplateText(renderedTemplate);
                await whatsappService.sendMessage(target, finalText);
                message = `Plan-Update für ${dateStr} an ${target} gesendet (Musik-Orga: ${selectedPlan.Organisator}).${debugTargetJid ? ' (Debug-Ziel)' : ''}`;
                console.log(`[PLAN_UPDATE] Success: ${message}`);
            } else {
                message = "Keine Termine mit Musik-Orga UND offenen Musik-Diensten gefunden.";
                console.log(`[PLAN_UPDATE] ${message}`);
            }
        } else if (dbJob.type === 'PROBE_ANNOUNCE') {
            const { targetJid, template } = dbJob.params || {};
            const target = debugTargetJid || targetJid;
            if (!target) throw new Error("Keine Zielnummer/Zielgruppe konfiguriert.");
            const nextGD = await MusicPlan.findOne({ Datum: { $gte: new Date().toISOString().split('T')[0] } }).sort({ Datum: 1 });
            if (nextGD && nextGD.Probe) {
                const probeDate = new Date(nextGD.Probe);
                const templateVars = {
                    probe_date: probeDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }),
                    probe_time: probeDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                    service_type: nextGD.Typ || '?',
                    service_topic: nextGD.Thema || '?'
                };
                const rendered = normalizeTemplateText(renderTemplate(template || JOB_DEFAULT_TEMPLATES.PROBE_ANNOUNCE, templateVars));
                await whatsappService.sendMessage(target, rendered);
                message = `Probe-Ankündigung an ${target} gesendet.${debugTargetJid ? ' (Debug-Ziel)' : ''}`;
            } else {
                message = "Keine Probe gefunden.";
            }
        } else if (dbJob.type === 'CHECK_REMINDERS') {
            const now = new Date();
            const today = toMidnight(now);
            const minDaysBefore = Number.isFinite(Number(dbJob.params?.daysBeforeMin)) ? Math.max(0, Number(dbJob.params?.daysBeforeMin)) : 1;
            const maxDaysBefore = Number.isFinite(Number(dbJob.params?.daysBeforeMax)) ? Math.max(minDaysBefore, Number(dbJob.params?.daysBeforeMax)) : minDaysBefore;
            const cooldownHours = Number.isFinite(Number(dbJob.params?.cooldownHours)) ? Math.max(1, Number(dbJob.params?.cooldownHours)) : 12;
            const categoryFilter = cleanStringArray(dbJob.params?.categories).map((value) => value.toLowerCase());
            const hasCategoryFilter = categoryFilter.length > 0;
            const categorySet = new Set(categoryFilter);

            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() + minDaysBefore);
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + maxDaysBefore);

            const startDateStr = formatYmdLocal(startDate);
            const endDateStr = formatYmdLocal(endDate);

            const searchFrom = new Date(today);
            searchFrom.setDate(searchFrom.getDate() - 1);
            const searchTo = new Date(endDate);
            searchTo.setDate(searchTo.getDate() + 1);
            const entries = await MusicPlan.find({ Datum: { $gte: formatYmdLocal(searchFrom), $lte: formatYmdLocal(searchTo) } }).sort({ Datum: 1 });
            let remindersCount = 0;
            if (entries.length > 0) {
                const notifyService = (await import('./notify.service.js')).default;
                const reminderLines = [];
                const titleTemplate = dbJob.params?.appTitleTemplate || JOB_DEFAULT_TEMPLATES.CHECK_REMINDERS_TITLE;
                const messageTemplate = dbJob.params?.appMessageTemplate || JOB_DEFAULT_TEMPLATES.CHECK_REMINDERS_MESSAGE;
                
                const relevantKeys = [
                    'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
                    'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
                ];

                for (const entry of entries) {
                    const entryType = String(entry?.Typ || '').trim().toLowerCase();
                    if (hasCategoryFilter && !categorySet.has(entryType)) continue;

                    const serviceDay = toMidnight(parseYmdLocal(entry.Datum));
                    const daysUntil = Math.round((serviceDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                    if (daysUntil < minDaysBefore || daysUntil > maxDaysBefore) continue;

                    for (const key of relevantKeys) {
                        const name = entry[key];
                        if (!name || name === '/' || name === '?' || name === '-') continue;
                        
                        // Strict username lookup instead of fuzzy matching
                        const user = await User.findOne({ username: name });
                        
                        if (user) {
                            // Check if already notified in the last 20 hours to prevent spam if job runs multiple times
                            const alreadyNotified = await Notification.findOne({
                                UserId: user._id,
                                type: 'plan_reminder',
                                createdAt: { $gt: new Date(Date.now() - cooldownHours * 60 * 60 * 1000) },
                                message: { $regex: new RegExp(key) }
                            });

                            if (!alreadyNotified) {
                                const serviceDatePretty = serviceDay.toLocaleDateString('de-DE');
                                const templateVars = {
                                    role_name: key,
                                    service_date: serviceDatePretty,
                                    service_date_iso: entry.Datum,
                                    days_until: daysUntil,
                                    timing_phrase: buildReminderTimingPhrase(daysUntil, serviceDatePretty),
                                    username: user.username,
                                    first_name: user.firstName || '',
                                    last_name: user.lastName || ''
                                };
                                const title = normalizeTemplateText(renderTemplate(titleTemplate, templateVars));
                                const textMessage = normalizeTemplateText(renderTemplate(messageTemplate, templateVars));

                                if (debugTargetJid) {
                                    reminderLines.push(`@${user.username}: ${title} - ${textMessage}`);
                                } else {
                                    await notifyService.notifyUser(user._id, 'plan_reminder', {
                                        title,
                                        message: textMessage,
                                        link: '/dienstplaner'
                                    });
                                }
                                remindersCount++;
                            }
                        }
                    }
                }
                if (debugTargetJid) {
                    const preview = reminderLines.length > 0
                        ? reminderLines.slice(0, 20).join('\n')
                        : 'Keine fälligen Erinnerungen gefunden.';
                    const debugText = normalizeTemplateText(`*Debug CHECK_REMINDERS (${startDateStr} bis ${endDateStr})*\n\n${preview}`);
                    await whatsappService.sendMessage(debugTargetJid, debugText);
                    message = `${entries.length} Termine geprüft, Debug-Vorschau an ${debugTargetJid} gesendet (${remindersCount} fällige Erinnerungen).`;
                } else {
                    message = `${entries.length} Termine geprüft, ${remindersCount} Erinnerungen gesendet.`;
                }
            } else {
                message = `Keine Termine im Fenster ${startDateStr} bis ${endDateStr} gefunden.`;
            }
        } else if (dbJob.type === 'EMAIL_BROADCAST') {
            if (!emailService.isReady()) throw new Error('SMTP ist nicht konfiguriert.');
            const subject = String(dbJob.params?.subject || '').trim();
            const html = String(dbJob.params?.html || '').trim();
            const textFromParams = String(dbJob.params?.text || '').trim();
            const filters = dbJob.params?.filters || {};
            if (!subject) throw new Error('Betreff fehlt.');
            if (!html && !textFromParams) throw new Error('E-Mail Inhalt fehlt.');

            const recipients = await resolveEmailRecipients(filters);
            if (recipients.length === 0) {
                message = 'Keine passenden Empfänger gefunden.';
            } else {
                const text = textFromParams || stripHtml(html);
                const htmlBody = html || `<p style="white-space: pre-line;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
                let successCount = 0;
                let failedCount = 0;
                for (const recipient of recipients) {
                    const result = await emailService.send({
                        to: recipient.email,
                        subject,
                        text,
                        html: htmlBody
                    });
                    if (result?.success) successCount += 1;
                    else failedCount += 1;
                }
                message = `Email Broadcast gesendet: ${successCount}/${recipients.length} erfolgreich, ${failedCount} fehlgeschlagen.`;
            }
        } else if (dbJob.type === 'RUNSHEET_DISTRIBUTE') {
            const now = new Date();
            const today = toMidnight(now);
            const daysBefore = Number.isFinite(Number(dbJob.params?.daysBefore))
                ? Math.max(0, Number(dbJob.params?.daysBefore))
                : 2;
            const sendEmail = dbJob.params?.sendEmail !== false;
            const sendWhatsApp = dbJob.params?.sendWhatsApp !== false;
            const categoryFilter = cleanStringArray(dbJob.params?.categories).map((value) => value.toLowerCase());
            const hasCategoryFilter = categoryFilter.length > 0;
            const categorySet = new Set(categoryFilter);

            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + daysBefore);
            const targetDateStr = formatYmdLocal(targetDate);
            const entries = await MusicPlan.find({ Datum: targetDateStr }).sort({ Datum: 1 });
            if (entries.length === 0) {
                message = `Keine Dienste für ${targetDateStr} gefunden.`;
            } else {
                let sentEmail = 0;
                let sentWa = 0;
                let touchedUsers = 0;
                for (const entry of entries) {
                    const entryType = String(entry?.Typ || '').trim().toLowerCase();
                    if (hasCategoryFilter && !categorySet.has(entryType)) continue;

                    const assignedUsers = await resolveAssignedUsersForPlan(entry);
                    if (assignedUsers.length === 0) continue;

                    const usersByUsername = new Map(assignedUsers.map((u) => [String(u.username || ''), u]));
                    const { buffer, fileName } = await generateRunSheetBuffer({ plan: entry, usersByUsername });
                    const serviceDate = toServiceDatePretty(entry.Datum);

                    for (const user of assignedUsers) {
                        touchedUsers += 1;
                        const templateVars = {
                            service_date: serviceDate,
                            service_type: String(entry?.Typ || '').trim(),
                            first_name: user.firstName || user.username || '',
                            last_name: user.lastName || ''
                        };
                        const subject = normalizeTemplateText(renderTemplate(dbJob.params?.subjectTemplate || JOB_DEFAULT_TEMPLATES.RUNSHEET_SUBJECT, templateVars));
                        const body = normalizeTemplateText(renderTemplate(dbJob.params?.messageTemplate || JOB_DEFAULT_TEMPLATES.RUNSHEET_MESSAGE, templateVars));

                        if (sendEmail && user.email) {
                            const result = await emailService.send({
                                to: user.email,
                                subject,
                                text: body,
                                html: `<p style="white-space: pre-line;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
                                attachments: [{
                                    filename: fileName,
                                    content: buffer,
                                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                }]
                            });
                            if (result?.success) sentEmail += 1;
                        }

                        if (sendWhatsApp && user.phone) {
                            try {
                                await whatsappService.sendDocument(user.phone, {
                                    buffer,
                                    fileName,
                                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                    caption: body
                                });
                                sentWa += 1;
                            } catch (_waErr) {}
                        }
                    }
                }
                message = `Ablaufpläne verarbeitet (Zieldatum ${targetDateStr}): Empfänger ${touchedUsers}, Email ${sentEmail}, WhatsApp ${sentWa}.`;
            }
        } else if (dbJob.type === 'SYSTEM_STATS') {
            const stats = await pidusage(process.pid);
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

            const [traffic, attackCount, activeUsers, dbStats, previousStat] = await Promise.all([
                ActivityLog.countDocuments({ createdAt: { $gte: oneMinuteAgo } }),
                ThreatLog.countDocuments({ createdAt: { $gte: oneMinuteAgo } }),
                User.countDocuments({ isOnline: true }),
                mongoose.connection.db.stats().catch(() => ({ objects: 0, dataSize: 0 })),
                SystemStat.findOne().sort({ timestamp: -1 }).lean()
            ]);

            let dbReads = 0;
            let dbWrites = 0;
            try {
                const serverStatus = await mongoose.connection.db.admin().serverStatus();
                const opcounters = serverStatus?.opcounters || {};
                const totalReads = Number(opcounters.query || 0) + Number(opcounters.getmore || 0);
                const totalWrites = Number(opcounters.insert || 0) + Number(opcounters.update || 0) + Number(opcounters.delete || 0);
                const prevReads = Number(previousStat?.dbReadsTotal || 0);
                const prevWrites = Number(previousStat?.dbWritesTotal || 0);
                dbReads = prevReads > 0 ? Math.max(0, totalReads - prevReads) : 0;
                dbWrites = prevWrites > 0 ? Math.max(0, totalWrites - prevWrites) : 0;

                await SystemStat.create({
                    timestamp: now,
                    cpu: stats.cpu,
                    memory: stats.memory,
                    uptime: process.uptime(),
                    traffic,
                    dbReads,
                    dbWrites,
                    attackCount,
                    activeUsers,
                    dbSize: Number(dbStats?.dataSize || 0),
                    dbObjects: Number(dbStats?.objects || 0),
                    dbReadsTotal: totalReads,
                    dbWritesTotal: totalWrites,
                    // legacy compatibility fields
                    cpuUsage: stats.cpu,
                    memoryUsage: stats.memory,
                    requestsPerMinute: traffic
                });
            } catch (_dbErr) {
                await SystemStat.create({
                    timestamp: now,
                    cpu: stats.cpu,
                    memory: stats.memory,
                    uptime: process.uptime(),
                    traffic,
                    dbReads: 0,
                    dbWrites: 0,
                    attackCount,
                    activeUsers,
                    dbSize: Number(dbStats?.dataSize || 0),
                    dbObjects: Number(dbStats?.objects || 0),
                    cpuUsage: stats.cpu,
                    memoryUsage: stats.memory,
                    requestsPerMinute: traffic
                });
            }
            message = `System-Stats erfasst: CPU ${stats.cpu.toFixed(1)}%, RAM ${(stats.memory / 1024 / 1024).toFixed(1)}MB, Traffic ${traffic}/min, DB I/O R${dbReads}/W${dbWrites}, Attacken ${attackCount}/min`;
        }

        await JobLog.create({ JobId: dbJob._id, status: 'SUCCESS', message });
        
        dbJob.lastRun = new Date();
        if (dbJob.cronExpression) {
            try {
                const interval = CronExpressionParser.parse(dbJob.cronExpression);
                dbJob.nextRun = interval.next().toDate();
            } catch (ce) { console.error('Cron parse error on run:', ce); }
        } else if (!isManual) {
            dbJob.active = false;
            dbJob.nextRun = null;
        }
        await dbJob.save();
        
        // Refresh Scheduler to reflect the new nextRun
        if (dbJob.cronExpression) {
            initScheduler();
        }

    } catch (err) {
        console.error(`❌ Fehler bei Aufgabe ${dbJob.name}:`, err);
        await JobLog.create({ JobId: dbJob._id, status: 'ERROR', message: err.message });
    }
};

export const triggerJobManually = async (jobId, options = {}) => {
    const job = await ScheduledJob.findById(jobId);
    if (job) await runJob(job, true, options);
};

/**
 * Optimiert ein Bild asynchron und speichert die Thumbnail-Version.
 */
export const processImageAsync = async (targetType, id, buffer, index = 0) => {
    try {
        const thumbnailBuffer = await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        if (targetType === 'POST') {
            const post = await Post.findById(id);
            if (post) {
                if (!post.optimizedAttachments) post.optimizedAttachments = [];
                const optimizedPath = await saveImageBuffer({
                    buffer: thumbnailBuffer,
                    mimeType: 'image/webp',
                    scope: 'wall',
                    ownerId: id,
                    variant: `optimized-${index}`,
                    extension: 'webp'
                });
                post.optimizedAttachments[index] = optimizedPath;
                post.markModified('optimizedAttachments');
                await post.save();
            }
        } else if (targetType === 'USER') {
            const optimizedPath = await saveImageBuffer({
                buffer: thumbnailBuffer,
                mimeType: 'image/webp',
                scope: 'profiles',
                ownerId: id,
                variant: 'optimized',
                extension: 'webp'
            });
            await User.findByIdAndUpdate(id, { optimizedProfileImage: optimizedPath });
        } else if (targetType === 'USER_COVER') {
            const optimizedPath = await saveImageBuffer({
                buffer: thumbnailBuffer,
                mimeType: 'image/webp',
                scope: 'profiles',
                ownerId: id,
                variant: 'cover-optimized',
                extension: 'webp'
            });
            await User.findByIdAndUpdate(id, { optimizedCoverImage: optimizedPath });
        } else if (targetType === 'CHANNEL') {
            const optimizedPath = await saveImageBuffer({
                buffer: thumbnailBuffer,
                mimeType: 'image/webp',
                scope: 'channels',
                ownerId: id,
                variant: `optimized-${index}`,
                extension: 'webp'
            });
            await Channel.findByIdAndUpdate(id, { optimizedImage: optimizedPath });
        }
    } catch (err) {
        console.error('Error processing image:', err);
    }
};
