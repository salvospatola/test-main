import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import 'dotenv/config';
import { body, validationResult } from 'express-validator';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { getLinkPreview } from 'link-preview-js';

import whatsappService, { initializeWhatsApp } from './services/whatsapp.service.js';
import notifyService from './services/notify.service.js';
import { processImageAsync, initScheduler, triggerJobManually } from './services/worker.service.js';
import { connectDB, initDatabase, JobLog, ScheduledJob, User, Role, Tool, ActivityLog, SystemLog, MusicPlan, Post, QuickAssignToken, OTP, ThreatLog, SystemStat, IPBan, GlobalSetting, Notification, Invite, WhatsAppLog, Team, GlobalTag, SubstituteRequest, TeamMembershipRequest, ChatConversation, ChatMessage, Channel, PlanSlotConfig } from './services/db.service.js';
import { getPlan, addEntry, updateEntry, generateExcel, importExcel } from './services/sheet.service.js';
import { searchSongs, upsertSongsToCatalog } from './services/song-catalog.service.js';
import { generateRunSheetBuffer } from './services/runsheet.service.js';
import { authMiddleware, checkPermission, isAdmin, ipBanMiddleware, requirePermission, issueAuthSession, logoutCurrentSession } from './services/auth.service.js';
import { PERMISSION_CATALOG, hasPermission, canManageTeamScope, canRequestSubstituteScope, mapToolPermissionToPermissionKey, buildLegacyToolMatrixFromPermissionKeys } from './services/authorization.service.js';
import { logActivity, logSystem, activityMiddleware, cleanupLogs, getLiveStats } from './services/log.service.js';
import { normalizePhone } from './services/utils.service.js';
import { deleteByPublicPath, getUploadsRoot, saveImageBuffer } from './services/media.service.js';
import searchService from './services/search.service.js';
import emailService from './services/email.service.js';
import { runWithAuditContext } from './services/audit-context.service.js';
import parser from 'cron-parser';
import svgCaptcha from 'svg-captcha';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import pidusage from 'pidusage';
import os from 'os';

// Globaler Event-Emitter für Real-Time Benachrichtigungen
export const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(500);

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

import whatsappRoutes from './routes/whatsapp.routes.js';
import jobRoutes from './routes/job.routes.js';
import swaggerDocument from './swagger.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_STARTED_AT = new Date().toISOString();
const APP_VERSION = (() => {
    const envVersion = String(process.env.APP_VERSION || '').trim();
    if (envVersion) return envVersion;
    try {
        const pkgPath = path.join(__dirname, '../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return String(pkg?.version || '0.0.0').trim() || '0.0.0';
    } catch (_e) {
        return '0.0.0';
    }
})();
// Build-ID muss über Neustarts stabil bleiben, sonst meldet der Client fälschlich
// "Neue Version verfügbar", obwohl nur der Prozess neu gestartet wurde.
const APP_BUILD_ID = String(process.env.APP_BUILD_ID || APP_VERSION).trim();

export const app = express();

// --- RATE LIMIT LOGGING ---
// Automatisches Logging von Rate-Limit Verstößen
const logRateLimit = (req, type) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const parser = new UAParser(ua);
    const client = {
        os: parser.getOS().name,
        browser: parser.getBrowser().name,
        device: parser.getDevice().type || 'desktop'
    };
    const geo = geoip.lookup(ip);

    ThreatLog.create({
        ip,
        action: `RATE_LIMIT_EXCEEDED (${type})`,
        severity: 'MEDIUM',
        path: req.originalUrl,
        method: req.method,
        userAgent: ua,
        client,
        geo: geo ? {
            country: geo.country,
            city: geo.city,
            region: geo.region,
            ll: geo.ll
        } : null,
        details: {
            headers: req.headers,
            query: req.query,
            body: type === 'AUTH' ? { phone: req.body?.phone } : req.body
        }
    }).catch(err => console.error('Error logging rate limit:', err));

    logSystem('security', `Rate Limit exceeded by ${ip} on ${req.originalUrl} (${type})`, { ip, path: req.originalUrl });
};

// Vertraue dem Proxy (Nginx), um korrekte IP-Adressen für Rate-Limiting zu erhalten
app.set('trust proxy', 1);

// --- SECURITY MIDDLEWARE ---
app.use(ipBanMiddleware); // Erster Schutz: Gebannte IPs sofort abweisen
app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Allgemeines Limit: Erhöht auf 1000 Anfragen pro 15 Min
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 5000 : 1000,
    message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
    skip: (req) => process.env.NODE_ENV !== 'production' && /^\/api\/dev(\/|$)/i.test(req.path || req.originalUrl || ''),
    handler: (req, res, next, options) => {
        logRateLimit(req, 'GENERAL');
        res.status(options.statusCode).send(options.message);
    }
});

// Spezielles Limit für Monitoring (Stats/Intelligence), da diese alle 3s pollen
const monitoringLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: { error: 'Monitoring-Limit erreicht.' },
    skip: (req) => req.user?.RoleIds?.some(r => r.name === 'ADMIN') // Admins vom Limit ausnehmen
});

// Strenges Limit für Auth (Login/OTP): 10 Versuche pro 15 Min
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100 : 10,
    message: { error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.' },
    skip: () => process.env.NODE_ENV === 'development',
    handler: (req, res, next, options) => {
        logRateLimit(req, 'AUTH');
        res.status(options.statusCode).send(options.message);
    }
});

app.use('/api/', generalLimiter);
app.use('/api/monitoring/', monitoringLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/otp/request', authLimiter);
app.use('/api/auth/otp/verify', authLimiter);

// Die Nummernprüfung ist ein automatischer Prozess und bekommt ein eigenes, 
// sehr lockeres Limit, um Fehlalarme beim Tippen zu verhindern.
app.use('/api/auth/check-phone', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 Checks pro 15 Min sind sicher genug für normales Tippen
    message: { error: 'Zu viele Prüfungen.' },
    handler: (req, res, next, options) => {
        logRateLimit(req, 'PHONE_CHECK');
        res.status(options.statusCode).send(options.message);
    }
}));
app.use('/api/auth/check-email', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Zu viele Prüfungen.' },
    handler: (req, res, next, options) => {
        logRateLimit(req, 'EMAIL_CHECK');
        res.status(options.statusCode).send(options.message);
    }
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

const isMutatingMethod = (method) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
const isLocalIp = (ip) => {
    const normalized = Array.isArray(ip) ? ip[0] : String(ip || '').split(',')[0].trim();
    return normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1';
};
const getRequestOriginHost = (req) => {
    const origin = String(req.headers.origin || '').trim();
    if (origin) {
        try { return new URL(origin).host; } catch (_e) {}
    }
    const referer = String(req.headers.referer || '').trim();
    if (referer) {
        try { return new URL(referer).host; } catch (_e) {}
    }
    return '';
};
app.use((req, res, next) => {
    if (!String(req.path || '').startsWith('/api/')) return next();
    if (!isMutatingMethod(req.method)) return next();
    const hasSessionCookie = Boolean(req.cookies?.auth_token || req.cookies?.refresh_token);
    if (!hasSessionCookie) return next();
    const requestHost = getRequestOriginHost(req);
    if (!requestHost) return res.status(403).json({ error: 'CSRF Schutz: Origin fehlt.' });
    const targetHost = String(req.headers.host || '').trim();
    if (requestHost !== targetHost) return res.status(403).json({ error: 'CSRF Schutz: Origin nicht erlaubt.' });
    return next();
});

const upload = multer({
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB pro Datei
        fieldSize: 50 * 1024 * 1024 // 50MB für Text-Felder (Backup)
    },
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Nur Bilder sind erlaubt!'), false);
        }
    }
});

// ID Sanitizer Middleware: Verhindert NoSQL Injection in IDs
app.use((req, res, next) => {
    if (req.params.id) req.params.id = String(req.params.id);
    next();
});

const PLAN_SLOT_DEFINITIONS = [
    { roleKey: 'Predigt', label: 'Predigt' },
    { roleKey: 'Leitung', label: 'Leitung' },
    { roleKey: 'Anbetungsstunde', label: 'Anbetung' },
    { roleKey: 'Organisator', label: 'Musik-Orga' },
    { roleKey: 'TechnikPC', label: 'Technik PC' },
    { roleKey: 'TechnikSound', label: 'Technik Sound' },
    { roleKey: 'Klavier', label: 'Klavier' },
    { roleKey: 'Gitarre', label: 'Gitarre' },
    { roleKey: 'Bass', label: 'Bass' },
    { roleKey: 'Schlagzeug', label: 'Schlagzeug' },
    { roleKey: 'Blockflöte', label: 'Blockflöte' },
    { roleKey: 'Gesang1', label: 'Gesang 1' },
    { roleKey: 'Gesang2', label: 'Gesang 2' }
];
const CALENDAR_EVENT_SOURCES = [
    { key: 'PLAN_ASSIGNMENTS', label: 'Meine Einsätze' },
    { key: 'PLAN_PROBES', label: 'Meine Proben' }
];
const CALENDAR_EVENT_SOURCE_KEYS = new Set(CALENDAR_EVENT_SOURCES.map((item) => item.key));
const PLAN_SLOT_ROLE_KEYS = PLAN_SLOT_DEFINITIONS.map((slot) => slot.roleKey);
const PLAN_VIEWER_TTL_MS = 45 * 1000;
const planViewers = new Map();

const isPlanSlotOpen = (value) => {
    const v = String(value || '').trim();
    return v === '' || v === '?' || v === '-';
};

const cleanupPlanViewers = (planId) => {
    const key = String(planId);
    const viewers = planViewers.get(key);
    if (!viewers) return [];
    const now = Date.now();
    for (const [viewerId, entry] of viewers.entries()) {
        if (!entry?.seenAt || now - entry.seenAt > PLAN_VIEWER_TTL_MS) viewers.delete(viewerId);
    }
    if (viewers.size === 0) {
        planViewers.delete(key);
        return [];
    }
    return Array.from(viewers.values()).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
};

const upsertPlanViewer = (planId, user) => {
    const key = String(planId);
    if (!planViewers.has(key)) planViewers.set(key, new Map());
    const viewers = planViewers.get(key);
    viewers.set(String(user._id), {
        userId: String(user._id),
        username: user.username,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profileImage: user.profileImage || '',
        seenAt: Date.now()
    });
    return cleanupPlanViewers(planId);
};

const hasAdminRole = (user) => Boolean(user?.RoleIds?.some((role) => role.name === 'ADMIN'));

const userHasAnyToolPermission = async (user, toolKey, type = 'view') => {
    if (!user) return false;
    if (hasAdminRole(user)) return true;
    const permissionKey = mapToolPermissionToPermissionKey(toolKey, type);
    if (!permissionKey) return false;
    return hasPermission(user, permissionKey);
};
const userHasPermission = (user, permissionKey) => hasPermission(user, permissionKey);
const PERMISSION_CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((entry) => String(entry.key || '').trim()).filter(Boolean));

const normalizeValue = (value) => String(value || '').trim().toLowerCase();
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toCleanStringArray = (value) =>
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
const resolveEmailRecipientsFromFilters = async (filters = {}) => {
    const sendToAll = Boolean(filters?.sendToAll);
    const userIds = toCleanStringArray(filters?.userIds);
    const teamIds = new Set(toCleanStringArray(filters?.teamIds));
    const positionKeys = new Set(
        toCleanStringArray(filters?.positionKeys).map((entry) => entry.toLowerCase())
    );

    if (!sendToAll && userIds.length === 0 && teamIds.size === 0 && positionKeys.size === 0) {
        return { error: 'Bitte mindestens einen Empfängerkreis auswählen.', recipients: [] };
    }

    const candidates = await User.find({
        email: { $exists: true, $ne: '' },
        status: { $ne: 'HIDDEN' }
    })
        .select('username firstName lastName email teamPositions')
        .lean();

    const explicitUsers = new Set(userIds);
    const recipients = candidates.filter((user) => {
        if (sendToAll) return true;
        if (explicitUsers.has(String(user._id))) return true;

        const positions = Array.isArray(user.teamPositions) ? user.teamPositions : [];
        if (positions.some((tp) => teamIds.has(String(tp?.TeamId || '')))) return true;
        if (positions.some((tp) => {
            const teamId = String(tp?.TeamId || '');
            const position = String(tp?.position || '').trim().toLowerCase();
            return positionKeys.has(`${teamId}::${position}`);
        })) return true;
        return false;
    });

    if (recipients.length === 0) {
        return { error: 'Keine Empfänger mit gültiger E-Mail-Adresse gefunden.', recipients: [] };
    }
    return { recipients, error: '' };
};
const parsePlanTimeValue = (value) => {
    const raw = String(value || '');
    const match = raw.match(/(\d{1,2})[:.](\d{2})/);
    if (!match) return { hour: 10, minute: 30 };
    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour, minute };
};
const formatIcsDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
};
const escapeIcsText = (value) =>
    String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
const parsePlanDateValue = (value) => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};
const formatDateYmdLocal = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const isLastSundayOfMonth = (date) => {
    if (!(date instanceof Date)) return false;
    if (date.getDay() !== 0) return false;
    const nextSunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
    return nextSunday.getMonth() !== date.getMonth();
};
const createCalendarFeedToken = () => crypto.randomBytes(24).toString('hex');
const normalizeCalendarSources = (value, { useDefault = true } = {}) => {
    const normalized = toCleanStringArray(value).map((entry) => entry.toUpperCase());
    const unique = Array.from(new Set(normalized)).filter((entry) => CALENDAR_EVENT_SOURCE_KEYS.has(entry));
    if (unique.length > 0) return unique;
    return useDefault ? ['PLAN_ASSIGNMENTS', 'PLAN_PROBES'] : [];
};
const ensureUserCalendarFeed = async (userDoc) => {
    if (!userDoc.calendarFeed) userDoc.calendarFeed = {};
    let changed = false;

    if (!String(userDoc.calendarFeed.token || '').trim()) {
        userDoc.calendarFeed.token = createCalendarFeedToken();
        changed = true;
    }

    const hasConfiguredSources = Array.isArray(userDoc.calendarFeed.enabledSources);
    const nextSources = hasConfiguredSources
        ? normalizeCalendarSources(userDoc.calendarFeed.enabledSources, { useDefault: false })
        : normalizeCalendarSources(userDoc.calendarFeed.enabledSources, { useDefault: true });
    const currentSources = Array.isArray(userDoc.calendarFeed.enabledSources) ? userDoc.calendarFeed.enabledSources : [];
    if (nextSources.join('|') !== currentSources.join('|')) {
        userDoc.calendarFeed.enabledSources = nextSources;
        changed = true;
    }

    if (changed) {
        userDoc.markModified('calendarFeed');
        await userDoc.save();
    }

    return {
        token: userDoc.calendarFeed.token,
        enabledSources: userDoc.calendarFeed.enabledSources,
        availableSources: CALENDAR_EVENT_SOURCES
    };
};
const sortByIdOrder = (items, orderedIds) => {
    const position = new Map(orderedIds.map((id, idx) => [String(id), idx]));
    return [...items].sort((a, b) => {
        const aPos = position.get(String(a._id)) ?? 99999;
        const bPos = position.get(String(b._id)) ?? 99999;
        return aPos - bPos;
    });
};
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const matchesRule = (user, rule) => {
    if (!rule) return false;
    const teamId = rule.TeamId?._id ? String(rule.TeamId._id) : (rule.TeamId ? String(rule.TeamId) : null);
    const expectedPositions = Array.isArray(rule.positions)
        ? rule.positions.map(normalizeValue).filter(Boolean)
        : [];
    return (user.teamPositions || []).some((tp) => {
        const userTeamId = tp.TeamId?._id ? String(tp.TeamId._id) : (tp.TeamId ? String(tp.TeamId) : null);
        if (teamId && userTeamId !== teamId) return false;
        if (expectedPositions.length === 0) return true;
        return expectedPositions.includes(normalizeValue(tp.position));
    });
};

const resolveUsersForSlotConfig = async (roleKey, { excludeUserId = null } = {}) => {
    const config = await PlanSlotConfig.findOne({ roleKey }).populate('targetRules.TeamId');
    if (!config) return [];
    const includeRules = (config.targetRules || []).filter((rule) => rule.mode !== 'EXCLUDE');
    const excludeRules = (config.targetRules || []).filter((rule) => rule.mode === 'EXCLUDE');
    if (includeRules.length === 0) return [];

    const users = await User.find({})
        .select('username firstName lastName teamPositions notifications')
        .populate('teamPositions.TeamId', 'name');
    const filtered = users.filter((user) => {
        const includeMatch = includeRules.some((rule) => matchesRule(user, rule));
        if (!includeMatch) return false;
        const excluded = excludeRules.some((rule) => matchesRule(user, rule));
        if (excluded) return false;
        if (excludeUserId && String(user._id) === String(excludeUserId)) return false;
        return true;
    });
    return filtered;
};

const mapSlotConfigForClient = (config) => ({
    _id: config._id,
    roleKey: config.roleKey,
    label: config.label,
    allowOnlyAssignedRequester: config.allowOnlyAssignedRequester !== false,
    editableFields: Array.isArray(config.editableFields) ? config.editableFields : [],
    targetRules: (config.targetRules || []).map((rule) => ({
        _id: rule._id,
        mode: rule.mode || 'INCLUDE',
        TeamId: rule.TeamId?._id || rule.TeamId || null,
        teamName: rule.TeamId?.name || null,
        positions: Array.isArray(rule.positions) ? rule.positions : []
    }))
});

// --- PUBLIC HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const isHealthy = dbState === 1;
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'UP' : 'DOWN',
        database: dbState === 1 ? 'connected' : 'disconnected'
    });
});
app.get('/api/version', (_req, res) => {
    res.json({
        version: APP_VERSION,
        buildId: APP_BUILD_ID,
        startedAt: APP_STARTED_AT
    });
});

// --- AUTH & PERMISSION MIDDLEWARE ---
app.use(authMiddleware);
app.use((req, _res, next) => {
    runWithAuditContext(
        { userId: req.user?._id ? String(req.user._id) : '' },
        () => next()
    );
});

const isPublicApiRoute = (req) => {
    const path = String(req.path || '');
    if (!path.startsWith('/api/')) return true;
    if (path === '/api/health') return true;
    if (path === '/api/version') return true;
    if (path === '/api/pulse') return true;
    if (path === '/api/auth/check-phone') return true;
    if (path === '/api/auth/check-email') return true;
    if (path === '/api/auth/otp/request') return true;
    if (path === '/api/auth/otp/verify') return true;
    if (path.startsWith('/api/calendar/my/')) return true;
    if (process.env.NODE_ENV !== 'production' && path.startsWith('/api/dev/')) return true;
    return false;
};

app.use((req, res, next) => {
    if (isPublicApiRoute(req)) return next();
    if (!String(req.path || '').startsWith('/api/')) return next();
    if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
    return next();
});

app.use(activityMiddleware);

// --- PROTECTED WHATSAPP ROUTES (Admin only) ---
app.use('/api/whatsapp', isAdmin, whatsappRoutes);

// --- DEV/TEST MOCK LOGIN (Local/non-production only) ---
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/dev/mock-login', async (req, res) => {
        try {
            const requestedUser = String(req.query.user || '').trim().toLowerCase();
            const requestedRole = String(req.query.role || '').trim().toUpperCase();

            const allowList = {
                e2e_admin: { firstName: 'E2E', lastName: 'Admin', role: 'ADMIN' },
                ux_admin: { firstName: 'UX', lastName: 'Admin', role: 'ADMIN' },
                ux_member: { firstName: 'UX', lastName: 'Member', role: 'MEMBER' }
            };

            let selected = allowList.e2e_admin;
            let username = 'e2e_admin';

            if (requestedUser && allowList[requestedUser]) {
                username = requestedUser;
                selected = allowList[requestedUser];
            } else if (requestedRole === 'MEMBER') {
                username = 'ux_member';
                selected = allowList.ux_member;
            } else if (requestedRole === 'ADMIN') {
                username = 'ux_admin';
                selected = allowList.ux_admin;
            }

            let selectedRole = await Role.findOne({ name: selected.role });
            if (!selectedRole) selectedRole = await Role.create({ name: selected.role });

            let user = await User.findOne({ username }).populate('RoleIds');
            if (!user) {
                user = await User.create({
                    username,
                    firstName: selected.firstName,
                    lastName: selected.lastName,
                    onboardingCompleted: true,
                    onboardingSkipped: false,
                    RoleIds: [selectedRole._id]
                });
                searchService.upsertUserById(user._id).catch(() => { });
            } else {
                user.firstName = selected.firstName;
                user.lastName = selected.lastName;
                user.onboardingCompleted = true;
                user.onboardingSkipped = false;
                user.RoleIds = [selectedRole._id];
                await user.save();
                searchService.upsertUserById(user._id).catch(() => { });
            }

            user = await User.findById(user._id).populate('RoleIds');
            const { accessToken } = await issueAuthSession(req, res, user, { rotateFromRequest: true });
            res.json({ success: true, token: accessToken, user });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/dev/otp/latest', async (req, res) => {
        try {
            if (process.env.NODE_ENV !== 'development' || !isLocalIp(req.ip)) {
                return res.status(403).json({ error: 'Nur lokal in Development erlaubt.' });
            }
            let { phone, username } = req.query;
            if (!phone && !username) {
                return res.status(400).json({ error: 'Bitte phone oder username angeben.' });
            }

            if (!phone && username) {
                const user = await User.findOne({ username: String(username).trim() });
                if (!user?.phone) return res.status(404).json({ error: 'Kein Benutzer mit hinterlegter Nummer gefunden.' });
                phone = user.phone;
            }

            phone = normalizePhone(String(phone));
            const otp = await OTP.findOne({ phone }).sort({ expiresAt: -1 });
            if (!otp) return res.status(404).json({ error: 'Kein aktiver OTP gefunden.' });

            res.json({
                success: true,
                phone,
                code: otp.code,
                expiresAt: otp.expiresAt,
                firstName: otp.firstName,
                lastName: otp.lastName
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}

// --- AUTH API (Passwordless OTP Flow) ---

app.get('/api/auth/check-phone', async (req, res) => {
    let { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Nummer fehlt' });

    phone = normalizePhone(phone);

    try {
        const user = await User.findOne({ phone });
        res.json({ exists: !!user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/check-email', async (req, res) => {
    let { email } = req.query;
    if (!email) return res.status(400).json({ error: 'E-Mail fehlt' });
    email = normalizeEmail(email);
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail' });

    try {
        const user = await User.findOne({ email });
        res.json({ exists: !!user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/otp/request', async (req, res) => {
    let { phone, firstName, lastName, registerKey, method, email } = req.body;
    const deliveryMethod = String(method || 'whatsapp').trim().toLowerCase();
    if (!['whatsapp', 'email'].includes(deliveryMethod)) {
        return res.status(400).json({ error: 'Ungültige Zustellmethode.' });
    }

    firstName = String(firstName || '').trim();
    lastName = String(lastName || '').trim();
    email = normalizeEmail(email);
    phone = phone ? normalizePhone(phone) : '';

    try {
        if (deliveryMethod === 'email') {
            if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' });
            if (!emailService.isReady()) {
                return res.status(503).json({ error: 'E-Mail-System ist zurzeit nicht verfügbar. Bitte nutze WhatsApp oder kontaktiere einen Administrator.' });
            }

            const user = await User.findOne({ email }).populate('RoleIds');
            if (!user) return res.status(404).json({ error: 'Konto nicht gefunden.' });

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const otpKey = `email:${email}`;
            const roleName = user?.RoleIds?.some((r) => r?.name === 'ADMIN') ? 'ADMIN' : 'MEMBER';

            await OTP.findOneAndUpdate(
                { phone: otpKey },
                { code, firstName: user.firstName || '', lastName: user.lastName || '', roleName, expiresAt },
                { upsert: true }
            );

            const sendResult = await emailService.send({
                to: email,
                subject: 'EFG NSU Portal: Dein Login-Code',
                text: `Dein Sicherheitscode lautet: ${code}\n\nDer Code ist 10 Minuten gültig.`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #1f2937;">
                        <h2 style="margin: 0 0 12px 0;">EFG NSU Portal</h2>
                        <p style="margin: 0 0 10px 0;">Dein Sicherheitscode lautet:</p>
                        <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 0 0 10px 0;">${code}</p>
                        <p style="margin: 0; color: #6b7280;">Der Code ist 10 Minuten gültig.</p>
                    </div>
                `
            });
            if (sendResult?.success === false || sendResult?.skipped) {
                return res.status(503).json({ error: 'Code konnte nicht per E-Mail gesendet werden.' });
            }
            return res.json({ success: true, message: 'Code per E-Mail gesendet' });
        }

        if (!phone) return res.status(400).json({ error: 'Handynummer erforderlich' });

        let inviteRoleName = '';
        let user = await User.findOne({ phone });

        if (!user && firstName && lastName) {
            user = await User.findOne({
                firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
                lastName: { $regex: new RegExp(`^${lastName}$`, 'i') }
            });
        }

        if (registerKey && (!firstName || !lastName)) {
            return res.status(400).json({ error: 'Vor- und Nachname sind erforderlich.' });
        }

        if (!user || !user.phone) {
            const secretSetting = await GlobalSetting.findOne({ key: 'registration_secret' });
            const requiresAccessKey = Boolean(secretSetting && secretSetting.hashedValue);
            let hasValidAccess = false;

            if (registerKey) {
                const validInvite = await Invite.findOne({
                    token: registerKey,
                    expiresAt: { $gt: new Date() }
                });
                if (validInvite) {
                    hasValidAccess = true;
                    inviteRoleName = String(validInvite.roleName || 'MEMBER').toUpperCase();
                }
            }

            if (!hasValidAccess && secretSetting && secretSetting.hashedValue && registerKey) {
                hasValidAccess = await bcrypt.compare(registerKey, secretSetting.hashedValue);
            }

            if (requiresAccessKey) {
                if (!registerKey) {
                    return res.status(403).json({
                        error: 'Einladung erforderlich',
                        inviteOnly: true,
                        message: 'Dieser Zugang ist exklusiv. Bitte nutze den Link aus deiner Einladung.'
                    });
                }
                if (!hasValidAccess) {
                    return res.status(403).json({ error: 'Ungültiger Einladungs-Link.' });
                }
            } else if (registerKey && !hasValidAccess) {
                return res.status(403).json({ error: 'Ungültiger oder abgelaufener Einladungs-Link.' });
            }
        }

        if (!user && (!firstName || !lastName)) {
            return res.status(200).json({
                needsRegistration: true,
                message: 'Bitte gib deinen Vor- und Nachnamen für die Erstanmeldung ein.'
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OTP.findOneAndUpdate(
            { phone },
            { code, firstName, lastName, roleName: inviteRoleName || 'MEMBER', expiresAt },
            { upsert: true }
        );

        const wsStatus = await whatsappService.getStatus();
        if (!wsStatus.connected) {
            if (process.env.NODE_ENV !== 'test') {
                return res.status(503).json({ error: 'WhatsApp System ist zurzeit offline. Bitte kontaktiere einen Administrator.' });
            }
        }

        const msg = `*EFG Code: ${code}*`;
        if (process.env.NODE_ENV !== 'test') {
            await whatsappService.sendMessage(phone, msg);
        }

        return res.json({ success: true, message: 'Code gesendet' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN SETTINGS API ---

app.get('/api/admin/settings/register-secret', isAdmin, async (req, res) => {
    try {
        const setting = await GlobalSetting.findOne({ key: 'registration_secret' });
        res.json({
            exists: !!setting?.hashedValue,
            updatedAt: setting?.updatedAt
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/settings/register-secret', isAdmin, async (req, res) => {
    const { secret } = req.body;
    if (!secret) return res.status(400).json({ error: 'Secret erforderlich' });
    try {
        const hashedValue = await bcrypt.hash(secret, 10);
        await GlobalSetting.findOneAndUpdate(
            { key: 'registration_secret' },
            { hashedValue },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/otp/verify', async (req, res) => {
    let { phone, code, method, email } = req.body;
    const deliveryMethod = String(method || 'whatsapp').trim().toLowerCase();
    if (!['whatsapp', 'email'].includes(deliveryMethod)) {
        return res.status(400).json({ error: 'Ungültige Zustellmethode.' });
    }

    const normalizedEmail = normalizeEmail(email);
    phone = phone ? normalizePhone(phone) : '';
    const otpLookupKey = deliveryMethod === 'email' ? `email:${normalizedEmail}` : phone;

    try {
        const otpEntry = await OTP.findOne({ phone: otpLookupKey, code });
        if (!otpEntry || otpEntry.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Ungültiger oder abgelaufener Code' });
        }

        let user = null;
        if (deliveryMethod === 'email') {
            if (!normalizedEmail) return res.status(400).json({ error: 'E-Mail erforderlich' });
            user = await User.findOne({ email: normalizedEmail });
            if (!user) return res.status(404).json({ error: 'Benutzer konnte nicht zugeordnet werden.' });
        } else {
            user = await User.findOne({ phone });
        }

        if (deliveryMethod === 'whatsapp' && !user && otpEntry.firstName && otpEntry.lastName) {
            user = await User.findOne({
                firstName: { $regex: new RegExp(`^${otpEntry.firstName}$`, 'i') },
                lastName: { $regex: new RegExp(`^${otpEntry.lastName}$`, 'i') }
            });

            if (user) {
                user.phone = phone;
                await user.save();
                searchService.upsertUserById(user._id).catch(() => { });
            } else {
                const requestedRoleName = String(otpEntry.roleName || 'MEMBER').toUpperCase();
                const userRole = await Role.findOne({ name: requestedRoleName })
                    || await Role.findOne({ name: 'MEMBER' })
                    || await Role.findOne({ name: 'GUEST' });
                user = new User({
                    username: phone,
                    firstName: otpEntry.firstName,
                    lastName: otpEntry.lastName,
                    phone: phone,
                    onboardingCompleted: false,
                    onboardingSkipped: false,
                    RoleIds: userRole ? [userRole._id] : []
                });
                await user.save();
                searchService.upsertUserById(user._id).catch(() => { });
            }
        }

        if (!user) return res.status(404).json({ error: 'Benutzer konnte nicht zugeordnet werden.' });

        const loginUser = await User.findById(user._id).populate('RoleIds');
        await issueAuthSession(req, res, loginUser, { rotateFromRequest: true });
        await OTP.deleteOne({ _id: otpEntry._id });

        res.json({
            success: true,
            user: {
                id: loginUser._id,
                username: loginUser.username,
                role: loginUser.RoleIds.some((r) => r.name === 'ADMIN')
                    ? 'ADMIN'
                    : (loginUser.RoleIds?.[0]?.name || 'MEMBER')
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', async (req, res) => {
    await logoutCurrentSession(req, res);
    res.json({ success: true });
});

app.post('/api/auth/refresh', authMiddleware, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    res.json({ success: true });
});

const canManageRolePreview = (req) => {
    const realRoles = req.user?.__realRoles || req.user?.RoleIds || [];
    const isRealAdmin = Array.isArray(realRoles) && realRoles.some((role) => role.name === 'ADMIN');
    return isRealAdmin || Boolean(req.authClaims?.rolePreviewAdmin);
};

app.post('/api/auth/view-role', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
        if (!canManageRolePreview(req)) return res.status(403).json({ error: 'Nur Administratoren können die Sichtrolle wechseln.' });
        const roleName = String(req.body?.roleName || '').trim().toUpperCase();
        if (!roleName) return res.status(400).json({ error: 'Rollenname fehlt.' });

        const role = await Role.findOne({ name: roleName });
        if (!role) return res.status(404).json({ error: 'Rolle nicht gefunden.' });

        await issueAuthSession(req, res, req.user, {
            extraClaims: { asRole: role.name, rolePreviewAdmin: true },
            rotateFromRequest: true
        });
        res.json({ success: true, activeRole: role.name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/view-role/reset', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
        if (!canManageRolePreview(req)) return res.status(403).json({ error: 'Nur Administratoren können die Sichtrolle zurücksetzen.' });

        await issueAuthSession(req, res, req.user, { rotateFromRequest: true });
        res.json({ success: true, activeRole: 'ADMIN' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Entferne alte Endpunkte: captcha, login, request-otp, verify-otp (alt)
// ...

app.get('/api/auth/me', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    const refreshed = await User.findById(req.user._id).populate('RoleIds').select('RoleIds');
    if (refreshed?.RoleIds) req.user.RoleIds = refreshed.RoleIds;
    const calendarFeed = await ensureUserCalendarFeed(req.user);
    const isSystemAdmin = req.user.RoleIds.some(r => r.name === 'ADMIN');
    const realRoles = req.user.__realRoles || req.user.RoleIds || [];
    const isRealAdmin = realRoles.some((role) => role.name === 'ADMIN');
    const permissionKeys = Array.from(new Set((req.user.RoleIds || []).flatMap((role) => role.permissionKeys || [])));
    const permissions = buildLegacyToolMatrixFromPermissionKeys(permissionKeys);
    const availablePreviewRoles = isRealAdmin
        ? (await Role.find().select('name').sort({ name: 1 })).map((role) => role.name)
        : [];
    const primaryRole = req.user.RoleIds?.find((r) => r?.name)?.name || 'MEMBER';
    res.json({ user: { id: req.user._id, _id: req.user._id, username: req.user.username, firstName: req.user.firstName, lastName: req.user.lastName, email: req.user.email, birthday: req.user.birthday, phone: req.user.phone, profileImage: req.user.profileImage, optimizedProfileImage: req.user.optimizedProfileImage, coverImage: req.user.coverImage, optimizedCoverImage: req.user.optimizedCoverImage, coverColor: req.user.coverColor, role: isSystemAdmin ? 'ADMIN' : primaryRole, roles: req.user.RoleIds.map(r => r.name), permissions, permissionKeys, notifications: req.user.notifications, contactVisibility: req.user.contactVisibility || { emailPublic: false, phonePublic: false }, calendarFeed, theme: req.user.theme, status: req.user.status, onboardingCompleted: req.user.onboardingCompleted === false ? false : true, onboardingSkipped: !!req.user.onboardingSkipped, isOnline: req.user.isOnline, lastSeen: req.user.lastSeen, rolePreviewActive: Boolean(req.user.__isRolePreview), rolePreviewAs: req.user.__actingRole || null, canRolePreview: isRealAdmin || Boolean(req.authClaims?.rolePreviewAdmin), availablePreviewRoles } });
});

app.get('/api/auth/permissions', authMiddleware, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    const roleNames = (req.user.RoleIds || []).map((role) => role.name);
    const permissionKeys = Array.from(new Set((req.user.RoleIds || []).flatMap((role) => role.permissionKeys || [])));
    res.json({
        roles: roleNames,
        permissionKeys,
        catalog: PERMISSION_CATALOG
    });
});

app.put('/api/auth/profile', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const user = await User.findById(req.user._id);
        let {
            firstName,
            lastName,
            email,
            countryCode,
            phone,
            notifications,
            contactVisibility,
            theme,
            birthday,
            onboardingCompleted,
            onboardingSkipped,
            coverColor,
            clearProfileImage
        } = req.body;
        const profileFile = req.files?.image?.[0];
        const coverFile = req.files?.coverImage?.[0];
        const shouldClearProfileImage = clearProfileImage === true || clearProfileImage === 'true' || clearProfileImage === 1 || clearProfileImage === '1';
        if (shouldClearProfileImage) {
            await deleteByPublicPath(user.profileImage);
            await deleteByPublicPath(user.optimizedProfileImage);
            user.profileImage = '';
            user.optimizedProfileImage = '';
        }
        if (profileFile) {
            await deleteByPublicPath(user.profileImage);
            await deleteByPublicPath(user.optimizedProfileImage);
            user.profileImage = await saveImageBuffer({
                buffer: profileFile.buffer,
                mimeType: profileFile.mimetype,
                scope: 'profiles',
                ownerId: user._id,
                variant: 'original'
            });
            processImageAsync('USER', user._id, profileFile.buffer);
        }
        if (coverFile) {
            await deleteByPublicPath(user.coverImage);
            await deleteByPublicPath(user.optimizedCoverImage);
            user.coverImage = await saveImageBuffer({
                buffer: coverFile.buffer,
                mimeType: coverFile.mimetype,
                scope: 'profiles',
                ownerId: user._id,
                variant: 'cover-original'
            });
            processImageAsync('USER_COVER', user._id, coverFile.buffer);
        }
        if (typeof coverColor === 'string') {
            const normalizedColor = coverColor.trim();
            if (!normalizedColor) {
                user.coverColor = '';
            } else if (/^#[0-9A-Fa-f]{6}$/.test(normalizedColor)) {
                user.coverColor = normalizedColor;
            } else {
                return res.status(400).json({ error: 'Ungültige Titelbild-Farbe. Bitte Hex-Farbe wie #A1CED9 verwenden.' });
            }
        }

        // Security Check: Phone Number Change
        if (phone) {
            const normalized = normalizePhone(phone);
            if (normalized !== user.phone) {
                const existing = await User.findOne({ phone: normalized, _id: { $ne: user._id } });
                if (existing) return res.status(400).json({ error: 'Diese Telefonnummer wird bereits von einem anderen Konto verwendet.' });
                user.phone = normalized;
            }
        }

        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.email = email || user.email;
        user.countryCode = countryCode || user.countryCode;
        user.birthday = birthday || user.birthday;
        user.status = '';
        if (theme) user.theme = theme;
        if (notifications) {
            try {
                user.notifications = { ...user.notifications, ...JSON.parse(notifications) };
            } catch (e) { console.error("Error parsing notifications JSON", e); }
        }
        if (contactVisibility) {
            try {
                const parsedVisibility = JSON.parse(contactVisibility);
                user.contactVisibility = {
                    emailPublic: Boolean(parsedVisibility?.emailPublic),
                    phonePublic: Boolean(parsedVisibility?.phonePublic)
                };
            } catch (e) { console.error("Error parsing contactVisibility JSON", e); }
        }
        if (onboardingCompleted !== undefined) {
            user.onboardingCompleted = onboardingCompleted === true || onboardingCompleted === 'true';
        }
        if (onboardingSkipped !== undefined) {
            user.onboardingSkipped = onboardingSkipped === true || onboardingSkipped === 'true';
        }
        await user.save();
        searchService.upsertUserById(user._id).catch(() => { });

        // Broadcast status change to all connected clients
        notificationEvents.emit('user_status_change', {
            userId: user._id,
            status: user.status,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen
        });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/calendar-feed', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const user = await User.findById(req.user._id).select('calendarFeed');
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        const feed = await ensureUserCalendarFeed(user);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({
            ...feed,
            url: `${baseUrl}/api/calendar/my/${feed.token}.ics`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/auth/calendar-feed', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const user = await User.findById(req.user._id).select('calendarFeed');
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        const requestedSources = normalizeCalendarSources(req.body?.enabledSources, { useDefault: false });
        user.calendarFeed = {
            ...(user.calendarFeed || {}),
            enabledSources: requestedSources
        };
        user.markModified('calendarFeed');
        await user.save();
        const feed = await ensureUserCalendarFeed(user);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({
            success: true,
            ...feed,
            url: `${baseUrl}/api/calendar/my/${feed.token}.ics`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/calendar-feed/regenerate', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const user = await User.findById(req.user._id).select('calendarFeed');
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        user.calendarFeed = {
            ...(user.calendarFeed || {}),
            token: createCalendarFeedToken(),
            enabledSources: normalizeCalendarSources(user.calendarFeed?.enabledSources, { useDefault: true })
        };
        user.markModified('calendarFeed');
        await user.save();
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.json({
            success: true,
            token: user.calendarFeed.token,
            enabledSources: user.calendarFeed.enabledSources,
            availableSources: CALENDAR_EVENT_SOURCES,
            url: `${baseUrl}/api/calendar/my/${user.calendarFeed.token}.ics`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/calendar/my/:token.ics', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(404).send('Not found');

        const user = await User.findOne({ 'calendarFeed.token': token }).select('username firstName lastName calendarFeed');
        if (!user) return res.status(404).send('Not found');

        const enabledSources = normalizeCalendarSources(user.calendarFeed?.enabledSources, { useDefault: false });
        const includeAssignments = enabledSources.includes('PLAN_ASSIGNMENTS');
        const includeProbes = enabledSources.includes('PLAN_PROBES');

        const serviceFields = PLAN_SLOT_ROLE_KEYS.reduce((acc, key) => {
            acc[key] = user.username;
            return acc;
        }, {});

        const planQuery = includeAssignments || includeProbes
            ? { $or: Object.keys(serviceFields).map((key) => ({ [key]: serviceFields[key] })) }
            : { _id: null };
        const plans = await MusicPlan.find(planQuery).sort({ Datum: 1 }).lean();

        const now = new Date();
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//EFG NSU Portal//Personal Feed//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${escapeIcsText(`EFG Einsätze - ${user.firstName || user.username}`)}`
        ];

        plans.slice(0, 500).forEach((plan) => {
            const date = parsePlanDateValue(plan?.Datum);
            if (!date) return;
            const assignedRoles = PLAN_SLOT_DEFINITIONS.filter((slot) => String(plan?.[slot.roleKey] || '').trim() === user.username);
            const baseSummary = `${plan?.Typ || 'Gottesdienst'}${plan?.Thema ? ` - ${plan.Thema}` : ''}`;

            if (includeAssignments) {
                const { hour, minute } = parsePlanTimeValue(plan?.Uhrzeit || '10:30 Uhr');
                const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0);
                const end = new Date(start.getTime() + (2 * 60 * 60 * 1000));
                assignedRoles.forEach((slot, roleIndex) => {
                    const uid = `${String(plan._id)}-${slot.roleKey}-service-${roleIndex}@efg-nsu-portal`;
                    const description = [
                        `Rolle: ${slot.label}`,
                        `Datum: ${plan?.Datum || ''}`,
                        `Uhrzeit: ${plan?.Uhrzeit || '10:30 Uhr'}`,
                        plan?.Thema ? `Thema: ${plan.Thema}` : ''
                    ].filter(Boolean).join('\n');
                    lines.push('BEGIN:VEVENT');
                    lines.push(`UID:${escapeIcsText(uid)}`);
                    lines.push(`DTSTAMP:${formatIcsDateTimeLocal(now)}`);
                    lines.push(`DTSTART:${formatIcsDateTimeLocal(start)}`);
                    lines.push(`DTEND:${formatIcsDateTimeLocal(end)}`);
                    lines.push(`SUMMARY:${escapeIcsText(`${slot.label} - ${baseSummary}`)}`);
                    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
                    lines.push('END:VEVENT');
                });
            }

            if (includeProbes && assignedRoles.length > 0 && plan?.Probe) {
                const probeDate = new Date(plan.Probe);
                if (!Number.isNaN(probeDate.getTime())) {
                    const probeEnd = new Date(probeDate.getTime() + (2 * 60 * 60 * 1000));
                    const uid = `${String(plan._id)}-probe@efg-nsu-portal`;
                    const roleList = assignedRoles.map((slot) => slot.label).join(', ');
                    const description = [
                        `Einsatz: ${roleList}`,
                        `Probe: ${probeDate.toLocaleString('de-DE')}`,
                        plan?.Thema ? `Thema: ${plan.Thema}` : ''
                    ].filter(Boolean).join('\n');
                    lines.push('BEGIN:VEVENT');
                    lines.push(`UID:${escapeIcsText(uid)}`);
                    lines.push(`DTSTAMP:${formatIcsDateTimeLocal(now)}`);
                    lines.push(`DTSTART:${formatIcsDateTimeLocal(probeDate)}`);
                    lines.push(`DTEND:${formatIcsDateTimeLocal(probeEnd)}`);
                    lines.push(`SUMMARY:${escapeIcsText(`Probe - ${baseSummary}`)}`);
                    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
                    lines.push('END:VEVENT');
                }
            }
        });

        lines.push('END:VCALENDAR');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="efg-personal-feed.ics"');
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.send(lines.join('\r\n'));
    } catch (e) {
        return res.status(500).send('calendar_error');
    }
});

app.get('/api/notifications/stream', authMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onNotification = (notif) => {
        if (notif.UserId.toString() === req.user._id.toString()) {
            res.write(`data: ${JSON.stringify(notif)}\n\n`);
        }
    };

    notificationEvents.on('notification', onNotification);

    // Keep-alive Herzschlag (alle 30s)
    const keepAlive = setInterval(() => { res.write(':keepalive\n\n'); }, 30000);

    req.on('close', () => {
        notificationEvents.off('notification', onNotification);
        clearInterval(keepAlive);
    });
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ UserId: req.user._id }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany({ UserId: req.user._id, read: false }, { read: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notifications/clear-all', authMiddleware, async (req, res) => {
    try {
        await Notification.deleteMany({ UserId: req.user._id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        await Notification.findOneAndUpdate({ _id: req.params.id, UserId: req.user._id }, { read: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/notifications', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const user = await User.findById(req.user._id).select('notifications');
        res.json(user.notifications || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/auth/notifications', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt' });
    try {
        const { key, channel, value } = req.body;
        const allowedChannels = new Set(['app', 'whatsapp', 'email']);
        if (!key || !allowedChannels.has(String(channel || ''))) {
            return res.status(400).json({ error: 'Ungültiger Benachrichtigungskanal.' });
        }
        const user = await User.findById(req.user._id);
        if (!user.notifications) user.notifications = {};
        if (!user.notifications[key]) user.notifications[key] = { app: true, whatsapp: true, email: false };
        user.notifications[key][channel] = Boolean(value);
        user.markModified('notifications');
        await user.save();
        res.json({ success: true, notifications: user.notifications });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MONITORING API ---
app.get('/api/monitoring/stats', isAdmin, async (req, res) => {
    try {
        const stats = await pidusage(process.pid);

        let dbInfo = { objects: 0, dataSize: 0, reads: 0, writes: 0 };
        try {
            const dbStats = await mongoose.connection.db.stats();
            dbInfo.objects = dbStats.objects;
            dbInfo.dataSize = dbStats.dataSize;

            const adminDb = mongoose.connection.db.admin();
            const serverStatus = await adminDb.serverStatus();
            const opcounters = serverStatus.opcounters;
            dbInfo.reads = opcounters.query + opcounters.getmore;
            dbInfo.writes = opcounters.insert + opcounters.update + opcounters.delete;
        } catch (dbErr) {
            console.warn("DB Stats/Admin access failed:", dbErr.message);
        }

        const oneHourAgo = new Date(Date.now() - 3600000);
        const [failedLogins, suspiciousRequests, lockedUsers] = await Promise.all([
            User.aggregate([{ $match: { failedAttempts: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$failedAttempts" } } }]),
            ActivityLog.countDocuments({ createdAt: { $gt: oneHourAgo }, $or: [{ path: /\.(env|git|php|jsp|yml|sql|bak|db)$/i }, { path: /(\/wp-admin|\/config|\/setup|\/install|\/shell)/i }, { path: /admin/i, UserId: null }, { action: /FAILED_LOGIN/i }] }),
            User.countDocuments({ lockUntil: { $gt: new Date() } })
        ]);
        const trafficRange = parseInt(req.query.trafficRange) || 1; // minutes
        const traffic = await ActivityLog.countDocuments({
            createdAt: { $gt: new Date(Date.now() - trafficRange * 60 * 1000) }
        });

        const recentThreats = await ThreatLog.find().sort({ createdAt: -1 }).limit(10);
        const attacksLastMinute = await ThreatLog.countDocuments({
            createdAt: { $gt: new Date(Date.now() - trafficRange * 60 * 1000) }
        });

        res.json({
            cpu: stats.cpu,
            memory: stats.memory,
            uptime: process.uptime(),
            live: getLiveStats(),
            db: dbInfo,
            security: { alerts: suspiciousRequests, locked: lockedUsers, totalFailed: failedLogins[0]?.total || 0, recent: recentThreats },
            whatsapp: await whatsappService.getStatus(),
            traffic,
            attacks: attacksLastMinute,
            trafficRange
        });
    } catch (e) {
        console.error("Monitoring Stats Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Heartbeat für Präsenz
app.get('/api/pulse', (req, res) => { res.json({ success: true }); });

app.get('/api/monitoring/history', isAdmin, async (req, res) => {
    try {
        const { range = 'week', start, end } = req.query;
        let since;
        let until = end ? new Date(end) : new Date();
        if (end) {
            until.setHours(23, 59, 59, 999);
        }

        if (start) {
            since = new Date(start);
            since.setHours(0, 0, 0, 0);
        } else {
            let days = 7;
            if (range === 'day') days = 1;
            if (range === 'month') days = 30;
            if (range === 'quarter') days = 90;
            if (range === 'year') days = 365;
            if (range === 'all') days = 1825; // 5 years
            since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }

        const query = { timestamp: { $gt: since, $lt: until } };
        const stats = await SystemStat.find(query).sort({ timestamp: 1 });

        // Calculate peaks for the selected range
        const trafficPeak = await ActivityLog.aggregate([
            { $match: { createdAt: { $gt: since, $lt: until } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" },
                        hour: { $hour: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        res.json({
            history: stats,
            peaks: {
                hourlyTraffic: trafficPeak[0]?.count || 0,
                maxRamMb: stats.reduce((max, entry) => Math.max(max, Math.round((Number(entry.memory || entry.memoryUsage || 0) / 1024 / 1024))), 0),
                maxAttacks: stats.reduce((max, entry) => Math.max(max, Number(entry.attackCount || 0)), 0)
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/monitoring/bans', isAdmin, async (req, res) => {
    try {
        const bans = await IPBan.find().sort({ createdAt: -1 });
        res.json(bans);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/monitoring/bans/:id', isAdmin, async (req, res) => {
    try {
        await IPBan.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN API ---
app.get('/api/admin/security/config', isAdmin, async (req, res) => {
    try {
        const setting = await GlobalSetting.findOne({ key: 'registration_open' });
        res.json({ registrationOpen: setting?.value === 'true' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/security/toggle-registration', isAdmin, async (req, res) => {
    try {
        const setting = await GlobalSetting.findOne({ key: 'registration_open' });
        const newValue = setting?.value === 'true' ? 'false' : 'true';
        await GlobalSetting.findOneAndUpdate({ key: 'registration_open' }, { value: newValue }, { upsert: true });
        res.json({ success: true, open: newValue === 'true' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/email/test', isAdmin, async (req, res) => {
    try {
        const to = String(req.body?.to || '').trim();
        const subject = String(req.body?.subject || 'EFG NSU Portal - Test E-Mail').trim();
        const message = String(
            req.body?.message ||
            `Dies ist eine Testnachricht aus dem Admin-Bereich.\n\nZeitpunkt: ${new Date().toISOString()}`
        ).trim();

        if (!to) return res.status(400).json({ error: 'Empfänger-E-Mail ist erforderlich.' });
        if (!emailService.isReady()) {
            return res.status(400).json({ error: 'SMTP ist nicht konfiguriert. Bitte Umgebungsvariablen prüfen.' });
        }

        const result = await emailService.send({
            to,
            subject,
            text: message,
            html: `<p style="white-space: pre-line;">${message}</p>`
        });

        if (result?.success) return res.json({ success: true, to, messageId: result.messageId || '' });
        return res.status(500).json({ error: result?.error || 'E-Mail Versand fehlgeschlagen.' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/email/audience', isAdmin, async (req, res) => {
    try {
        const teams = await Team.find().select('name positions').sort({ name: 1 }).lean();
        const users = await User.find({
            email: { $exists: true, $ne: '' },
            status: { $ne: 'HIDDEN' }
        })
            .select('username firstName lastName email teamPositions')
            .lean();

        const teamNameById = new Map(teams.map((team) => [String(team._id), team.name]));
        const usersPayload = users.map((user) => ({
            _id: user._id,
            username: user.username,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            teamPositions: (user.teamPositions || []).map((tp) => ({
                teamId: tp?.TeamId ? String(tp.TeamId) : '',
                teamName: tp?.TeamId ? (teamNameById.get(String(tp.TeamId)) || '') : '',
                position: tp?.position || ''
            }))
        }));

        res.json({
            teams: teams.map((team) => ({
                _id: team._id,
                name: team.name,
                positions: Array.isArray(team.positions) ? team.positions : []
            })),
            users: usersPayload
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/email/send', isAdmin, async (req, res) => {
    try {
        if (!emailService.isReady()) {
            return res.status(400).json({ error: 'SMTP ist nicht konfiguriert. Bitte Umgebungsvariablen prüfen.' });
        }

        const subject = String(req.body?.subject || '').trim();
        const html = String(req.body?.html || '').trim();
        const textInput = String(req.body?.text || '').trim();
        const filters = req.body?.filters || {};

        if (!subject) return res.status(400).json({ error: 'Betreff ist erforderlich.' });
        if (!html && !textInput) return res.status(400).json({ error: 'E-Mail Inhalt ist erforderlich.' });

        const { recipients, error } = await resolveEmailRecipientsFromFilters(filters);
        if (error) return res.status(400).json({ error });

        const text = textInput || stripHtml(html);
        const htmlBody = html || `<p style="white-space: pre-line;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;

        const results = await Promise.all(
            recipients.map(async (recipient) => {
                const sendResult = await emailService.send({
                    to: recipient.email,
                    subject,
                    text,
                    html: htmlBody
                });
                return {
                    userId: String(recipient._id),
                    username: recipient.username,
                    email: recipient.email,
                    success: Boolean(sendResult?.success),
                    error: sendResult?.success ? '' : (sendResult?.error || 'E-Mail Versand fehlgeschlagen')
                };
            })
        );

        const successCount = results.filter((result) => result.success).length;
        const failed = results.filter((result) => !result.success);

        res.json({
            success: failed.length === 0,
            totalRecipients: recipients.length,
            successCount,
            failedCount: failed.length,
            failed
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/email/schedule', isAdmin, async (req, res) => {
    try {
        const mode = String(req.body?.mode || '').trim().toLowerCase();
        const name = String(req.body?.name || '').trim();
        const subject = String(req.body?.subject || '').trim();
        const html = String(req.body?.html || '').trim();
        const text = String(req.body?.text || '').trim();
        const filters = req.body?.filters || {};

        if (!['once', 'recurring'].includes(mode)) {
            return res.status(400).json({ error: 'Ungültiger Planungsmodus.' });
        }
        if (!subject) return res.status(400).json({ error: 'Betreff ist erforderlich.' });
        if (!html && !text) return res.status(400).json({ error: 'E-Mail Inhalt ist erforderlich.' });

        const { error: recipientError } = await resolveEmailRecipientsFromFilters(filters);
        if (recipientError) return res.status(400).json({ error: recipientError });

        let cronExpression = null;
        let executionTime = null;

        if (mode === 'once') {
            const runAtRaw = String(req.body?.runAt || '').trim();
            const runAt = new Date(runAtRaw);
            if (!runAtRaw || Number.isNaN(runAt.getTime())) {
                return res.status(400).json({ error: 'Ungültiger Ausführungszeitpunkt.' });
            }
            if (runAt.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Ausführungszeitpunkt muss in der Zukunft liegen.' });
            }
            executionTime = runAt;
        } else {
            const customCronExpression = String(req.body?.cronExpression || '').trim();
            if (customCronExpression) {
                cronExpression = customCronExpression;
            } else {
                const recurrenceType = String(req.body?.recurrenceType || 'weekly').trim().toLowerCase();
                const hour = Number.parseInt(req.body?.hour, 10);
                const minute = Number.parseInt(req.body?.minute, 10);

                if (!Number.isInteger(hour) || hour < 0 || hour > 23) return res.status(400).json({ error: 'Ungültige Stunde (0-23).' });
                if (!Number.isInteger(minute) || minute < 0 || minute > 59) return res.status(400).json({ error: 'Ungültige Minute (0-59).' });

                if (recurrenceType === 'daily') {
                    cronExpression = `${minute} ${hour} * * *`;
                } else if (recurrenceType === 'weekly') {
                    const weekdaysRaw = toCleanStringArray(req.body?.weekdays);
                    const weekdays = weekdaysRaw.includes('*')
                        ? ['*']
                        : Array.from(new Set(weekdaysRaw.filter((day) => /^[0-6]$/.test(day)))).sort((a, b) => Number(a) - Number(b));
                    const weekdayCron = weekdays.length === 0 || weekdays.includes('*') ? '*' : weekdays.join(',');
                    cronExpression = `${minute} ${hour} * * ${weekdayCron}`;
                } else if (recurrenceType === 'monthly_day') {
                    const dayOfMonth = Number.parseInt(req.body?.dayOfMonth, 10);
                    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
                        return res.status(400).json({ error: 'Ungültiger Monatstag (1-31).' });
                    }
                    cronExpression = `${minute} ${hour} ${dayOfMonth} * *`;
                } else if (recurrenceType === 'monthly_weekday') {
                    const nth = Number.parseInt(req.body?.nth, 10);
                    const nthWeekday = Number.parseInt(req.body?.nthWeekday, 10);
                    if (!Number.isInteger(nth) || nth < 1 || nth > 5) {
                        return res.status(400).json({ error: 'Ungültige Wochenposition (1-5).' });
                    }
                    if (!Number.isInteger(nthWeekday) || nthWeekday < 0 || nthWeekday > 6) {
                        return res.status(400).json({ error: 'Ungültiger Wochentag (0-6).' });
                    }
                    cronExpression = `${minute} ${hour} * * ${nthWeekday}#${nth}`;
                } else if (recurrenceType === 'yearly') {
                    const dayOfMonth = Number.parseInt(req.body?.dayOfMonth, 10);
                    const month = Number.parseInt(req.body?.month, 10);
                    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
                        return res.status(400).json({ error: 'Ungültiger Tag (1-31).' });
                    }
                    if (!Number.isInteger(month) || month < 1 || month > 12) {
                        return res.status(400).json({ error: 'Ungültiger Monat (1-12).' });
                    }
                    cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;
                } else {
                    return res.status(400).json({ error: 'Ungültiger Serien-Typ.' });
                }
            }

            try {
                parser.CronExpressionParser.parse(cronExpression);
            } catch (_cronError) {
                return res.status(400).json({ error: 'Ungültige Cron-Expression.' });
            }
        }

        const job = await ScheduledJob.create({
            name: name || (mode === 'once' ? `Email Versand (einmalig)` : `Email Versand (Serie)`),
            type: 'EMAIL_BROADCAST',
            cronExpression,
            executionTime,
            active: true,
            params: {
                subject,
                html,
                text,
                filters
            }
        });

        await initScheduler();
        return res.json({ success: true, job });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/invites', isAdmin, async (req, res) => {
    try {
        const invites = await Invite.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
        res.json(invites);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/invites/generate', isAdmin, async (req, res) => {
    try {
        const parsedDays = Number.parseInt(req.body?.validDays, 10);
        const validDays = Number.isInteger(parsedDays) ? parsedDays : 7;
        const clampedDays = Math.min(Math.max(validDays, 1), 7);
        const requestedRoleName = String(req.body?.roleName || 'MEMBER').trim().toUpperCase();
        if (!['ADMIN', 'MEMBER', 'GUEST'].includes(requestedRoleName)) {
            return res.status(400).json({ error: 'Ungültige Zielrolle für Einladung.' });
        }
        const roleExists = await Role.findOne({ name: requestedRoleName }).select('_id');
        if (!roleExists) return res.status(400).json({ error: `Rolle ${requestedRoleName} existiert nicht.` });
        const token = crypto.randomBytes(16).toString('hex');
        const invite = await Invite.create({
            token,
            roleName: requestedRoleName,
            expiresAt: new Date(Date.now() + clampedDays * 24 * 60 * 60 * 1000)
        });
        res.json({ success: true, invite });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/invites/:id', isAdmin, async (req, res) => {
    try {
        await Invite.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/roles', isAdmin, async (req, res) => {
    try {
        const roles = await Role.find().lean();
        const rolesWithPerms = roles.map((role) => ({
            ...role,
            permissionKeys: Array.from(new Set((role.permissionKeys || []).map((key) => String(key || '').trim()).filter(Boolean)))
        }));

        res.json(rolesWithPerms);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/permissions/catalog', isAdmin, async (req, res) => { res.json(PERMISSION_CATALOG); });

app.put('/api/roles/:id', isAdmin, async (req, res) => {
    try {
        const { permissionKeys } = req.body;
        const roleId = req.params.id;
        if (!Array.isArray(permissionKeys)) {
            return res.status(400).json({ error: 'permissionKeys erforderlich.' });
        }
        const normalizedPermissionKeys = Array.from(new Set(
            permissionKeys.map((key) => String(key || '').trim()).filter(Boolean)
        ));
        const invalidKeys = normalizedPermissionKeys.filter((key) => !PERMISSION_CATALOG_KEYS.has(key));
        if (invalidKeys.length > 0) {
            return res.status(400).json({ error: `Unbekannte Berechtigungen: ${invalidKeys.join(', ')}` });
        }
        await Role.findByIdAndUpdate(roleId, { permissionKeys: normalizedPermissionKeys });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/roles', isAdmin, async (req, res) => {
    const name = String(req.body?.name || '').trim().toUpperCase();
    const permissionKeys = Array.isArray(req.body?.permissionKeys)
        ? Array.from(new Set(req.body.permissionKeys.map((key) => String(key || '').trim()).filter(Boolean)))
        : [];
    const invalidKeys = permissionKeys.filter((key) => !PERMISSION_CATALOG_KEYS.has(key));
    if (invalidKeys.length > 0) return res.status(400).json({ error: `Unbekannte Berechtigungen: ${invalidKeys.join(', ')}` });
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });
    if (await Role.findOne({ name })) return res.status(400).json({ error: 'Existiert bereits' });
    const created = await Role.create({ name, permissionKeys });
    res.json(created);
});
app.delete('/api/roles/:id', isAdmin, async (req, res) => { const role = await Role.findById(req.params.id); if (role.name === 'ADMIN' || role.name === 'MEMBER') return res.status(400).json({ error: 'Geschützt' }); await Role.findByIdAndDelete(req.params.id); await User.updateMany({}, { $pull: { RoleIds: req.params.id } }); res.json({ success: true }); });
app.get('/api/tools', isAdmin, async (req, res) => { res.json(await Tool.find()); });

// --- ADMIN TAG MANAGEMENT ---
const normalizePlanCategory = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.toLowerCase() === 'sonntag' ? 'Gottesdienst' : normalized;
};

app.get('/api/admin/tags', isAdmin, async (req, res) => {
    try {
        // Immer aus User- und Dienstplan-Kategorien synchronisieren, damit neue Eintraege sichtbar bleiben.
        const userTags = await User.distinct('tags');
        const planTags = await MusicPlan.distinct('tags');
        const planTypes = await MusicPlan.distinct('Typ');
        const combined = [...new Set([...userTags, ...planTags, ...planTypes])]
            .map((tag) => normalizePlanCategory(tag))
            .filter(Boolean);

        if (combined.length > 0) {
            await GlobalTag.bulkWrite(
                combined.map((name) => ({
                    updateOne: {
                        filter: { name },
                        update: { $setOnInsert: { name } },
                        upsert: true
                    }
                })),
                { ordered: false }
            );
        }
        const tags = await GlobalTag.find().sort({ name: 1 });
        res.json(tags);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/tags', isAdmin, async (req, res) => {
    try {
        const name = normalizePlanCategory(req.body?.name);
        if (!name) return res.status(400).json({ error: 'Name erforderlich' });
        const tag = await GlobalTag.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
        res.json(tag);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/tags/:name', isAdmin, async (req, res) => {
    try {
        const fromName = normalizePlanCategory(req.params.name);
        const toName = normalizePlanCategory(req.body?.newName);
        if (!fromName || !toName) return res.status(400).json({ error: 'Alter und neuer Name sind erforderlich.' });
        if (fromName === toName) return res.json({ success: true });

        const existingTarget = await GlobalTag.findOne({ name: toName });
        if (!existingTarget) {
            await GlobalTag.findOneAndUpdate({ name: toName }, { name: toName }, { upsert: true, new: true });
        }

        const affectedUserIds = await User.distinct('_id', { tags: fromName });
        const affectedPlanIds = await MusicPlan.distinct('_id', { tags: fromName });
        const userPull = affectedUserIds.length > 0
            ? await User.updateMany({ _id: { $in: affectedUserIds } }, { $pull: { tags: fromName } })
            : { modifiedCount: 0 };
        const userAdd = affectedUserIds.length > 0
            ? await User.updateMany({ _id: { $in: affectedUserIds } }, { $addToSet: { tags: toName } })
            : { modifiedCount: 0 };
        const planPull = affectedPlanIds.length > 0
            ? await MusicPlan.updateMany({ _id: { $in: affectedPlanIds } }, { $pull: { tags: fromName } })
            : { modifiedCount: 0 };
        const planAdd = affectedPlanIds.length > 0
            ? await MusicPlan.updateMany({ _id: { $in: affectedPlanIds } }, { $addToSet: { tags: toName } })
            : { modifiedCount: 0 };
        const typeUpdate = await MusicPlan.updateMany({ Typ: fromName }, { $set: { Typ: toName } });
        await GlobalTag.findOneAndDelete({ name: fromName });

        res.json({
            success: true,
            from: fromName,
            to: toName,
            stats: {
                usersTagUpdated: Number(userPull.modifiedCount || 0),
                usersTagAdded: Number(userAdd.modifiedCount || 0),
                plansTagUpdated: Number(planPull.modifiedCount || 0),
                plansTagAdded: Number(planAdd.modifiedCount || 0),
                plansTypeUpdated: Number(typeUpdate.modifiedCount || 0)
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/tags/:name', isAdmin, async (req, res) => {
    try {
        const name = normalizePlanCategory(req.params.name);
        const replaceWith = normalizePlanCategory(req.body?.replaceWith);
        if (!name) return res.status(400).json({ error: 'Kategorie-Name fehlt.' });

        if (replaceWith && replaceWith !== name) {
            await GlobalTag.findOneAndUpdate({ name: replaceWith }, { name: replaceWith }, { upsert: true, new: true });
            const affectedUserIds = await User.distinct('_id', { tags: name });
            const affectedPlanIds = await MusicPlan.distinct('_id', { tags: name });
            const userPull = affectedUserIds.length > 0
                ? await User.updateMany({ _id: { $in: affectedUserIds } }, { $pull: { tags: name } })
                : { modifiedCount: 0 };
            const userAdd = affectedUserIds.length > 0
                ? await User.updateMany({ _id: { $in: affectedUserIds } }, { $addToSet: { tags: replaceWith } })
                : { modifiedCount: 0 };
            const planPull = affectedPlanIds.length > 0
                ? await MusicPlan.updateMany({ _id: { $in: affectedPlanIds } }, { $pull: { tags: name } })
                : { modifiedCount: 0 };
            const planAdd = affectedPlanIds.length > 0
                ? await MusicPlan.updateMany({ _id: { $in: affectedPlanIds } }, { $addToSet: { tags: replaceWith } })
                : { modifiedCount: 0 };
            const typeUpdate = await MusicPlan.updateMany({ Typ: name }, { $set: { Typ: replaceWith } });
            await GlobalTag.findOneAndDelete({ name });
            return res.json({
                success: true,
                removed: name,
                replaceWith,
                stats: {
                    usersTagUpdated: Number(userPull.modifiedCount || 0),
                    usersTagAdded: Number(userAdd.modifiedCount || 0),
                    plansTagUpdated: Number(planPull.modifiedCount || 0),
                    plansTagAdded: Number(planAdd.modifiedCount || 0),
                    plansTypeUpdated: Number(typeUpdate.modifiedCount || 0)
                }
            });
        } else {
            await User.updateMany({ tags: name }, { $pull: { tags: name } });
            await MusicPlan.updateMany({ tags: name }, { $pull: { tags: name } });
            await MusicPlan.updateMany({ Typ: name }, { $set: { Typ: '' } });
        }

        await GlobalTag.findOneAndDelete({ name });
        res.json({ success: true, removed: name, replaceWith: replaceWith || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/search/reindex', isAdmin, async (req, res) => {
    try {
        if (!searchService.isMeiliEnabled()) {
            return res.status(400).json({ error: 'Meilisearch ist nicht aktiviert.' });
        }
        await searchService.reindexAll();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- TEAM MANAGEMENT ---

app.get('/api/plan/categories', checkPermission('MUSIC_PLANER', 'view'), async (_req, res) => {
    try {
        const planTags = await MusicPlan.distinct('tags');
        const planTypes = await MusicPlan.distinct('Typ');
        const globalTags = await GlobalTag.distinct('name');
        const categories = [...new Set([...globalTags, ...planTags, ...planTypes])]
            .map((entry) => normalizePlanCategory(entry))
            .filter(Boolean);
        const dedupedSorted = Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b, 'de'));
        res.json({ categories: dedupedSorted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/songs/search', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        const query = String(req.query?.q || '').trim();
        const limit = Number.parseInt(String(req.query?.limit || '20'), 10);
        if (query.length < 2) {
            return res.json({ songs: [] });
        }
        const songs = await searchSongs(query, limit);
        return res.json({ songs });
    } catch (e) {
        return res.status(500).json({ error: 'Liedsuche fehlgeschlagen.' });
    }
});

const isTeamModerator = (team, userId) =>
    Array.isArray(team?.moderators) && team.moderators.some((id) => String(id?._id || id) === String(userId || ''));

const canModerateTeam = (team, user) =>
    userHasPermission(user, 'moderate_team') && canManageTeamScope(user, team);

const normalizeRequestedTeamPositions = (team, rawPositions) => {
    const allowedPositions = new Set(
        (Array.isArray(team?.positions) ? team.positions : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    );
    const normalized = toCleanStringArray(rawPositions).filter((value) => allowedPositions.has(value));
    return Array.from(new Set(normalized));
};

const buildTeamMembersForClient = async (team) => {
    const directMemberIds = new Set([
        ...(Array.isArray(team.members) ? team.members.map((id) => String(id?._id || id)) : []),
        ...(Array.isArray(team.moderators) ? team.moderators.map((id) => String(id?._id || id)) : [])
    ]);
    const users = await User.find({
        $or: [
            { _id: { $in: Array.from(directMemberIds) } },
            { 'teamPositions.TeamId': team._id }
        ]
    }).select('username firstName lastName profileImage teamPositions');

    return users.map((user) => {
        const userTeamPositions = (user.teamPositions || [])
            .filter((tp) => String(tp?.TeamId?._id || tp?.TeamId || '') === String(team._id))
            .map((tp) => String(tp.position || '').trim())
            .filter(Boolean);
        const role = isTeamModerator(team, user._id) ? 'MODERATOR' : 'MEMBER';
        return {
            _id: user._id,
            username: user.username,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            profileImage: user.profileImage || '',
            role,
            positions: Array.from(new Set(userTeamPositions))
        };
    }).sort((a, b) => {
        if (a.role !== b.role) return a.role === 'MODERATOR' ? -1 : 1;
        return `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim(), 'de');
    });
};

app.get('/api/teams', authMiddleware, async (req, res) => {
    try {
        res.json(await Team.find().sort({ name: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/teams/my', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const teams = await Team.find().sort({ name: 1 }).lean();
        const selfWithPositions = await User.findById(req.user._id).select('teamPositions');
        const selfTeamIds = new Set(
            (selfWithPositions?.teamPositions || [])
                .map((tp) => String(tp?.TeamId?._id || tp?.TeamId || ''))
                .filter(Boolean)
        );
        const myRequests = await TeamMembershipRequest.find({
            UserId: req.user._id,
            status: 'PENDING'
        }).select('TeamId requestedPositions createdAt');
        const myRequestByTeam = new Map(myRequests.map((item) => [String(item.TeamId), item]));

        const result = await Promise.all(teams.map(async (team) => {
            const memberIds = new Set((team.members || []).map((id) => String(id)));
            const moderatorIds = new Set((team.moderators || []).map((id) => String(id)));
            const membershipRole = moderatorIds.has(String(req.user._id))
                ? 'MODERATOR'
                : (memberIds.has(String(req.user._id)) || selfTeamIds.has(String(team._id)) ? 'MEMBER' : null);
            const members = await buildTeamMembersForClient(team);
            const pendingRequest = myRequestByTeam.get(String(team._id));
            return {
                _id: team._id,
                name: team.name,
                description: team.description || '',
                positions: Array.isArray(team.positions) ? team.positions : [],
                positionMeta: Array.isArray(team.positionMeta) ? team.positionMeta : [],
                membershipRole,
                pendingRequest: pendingRequest ? {
                    _id: pendingRequest._id,
                    requestedPositions: pendingRequest.requestedPositions || [],
                    createdAt: pendingRequest.createdAt
                } : null,
                canModerate: canModerateTeam(team, req.user),
                members
            };
        }));

        res.json({ teams: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams', isAdmin, async (req, res) => {
    try {
        const payload = {
            ...req.body,
            members: [],
            moderators: []
        };
        const team = await Team.create(payload);
        res.json(team);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/teams/:id', isAdmin, async (req, res) => {
    try {
        const normalizedPositions = Array.isArray(req.body?.positions)
            ? req.body.positions.map((value) => String(value || '').trim()).filter(Boolean)
            : null;
        const normalizedMembers = Array.isArray(req.body?.members)
            ? req.body.members.map((value) => String(value || '').trim()).filter(Boolean)
            : null;
        const normalizedModerators = Array.isArray(req.body?.moderators)
            ? req.body.moderators.map((value) => String(value || '').trim()).filter(Boolean)
            : null;
        const payload = {
            ...req.body,
            ...(normalizedPositions ? { positions: normalizedPositions } : {}),
            ...(normalizedMembers ? { members: normalizedMembers } : {}),
            ...(normalizedModerators ? { moderators: normalizedModerators } : {})
        };

        const team = await Team.findByIdAndUpdate(req.params.id, payload, { new: true });
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });

        if (normalizedPositions) {
            await User.updateMany(
                { 'teamPositions.TeamId': team._id },
                { $pull: { teamPositions: { TeamId: team._id, position: { $nin: normalizedPositions } } } }
            );
        }

        res.json(team);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/teams/:id', isAdmin, async (req, res) => {
    try {
        await Team.findByIdAndDelete(req.params.id);
        await TeamMembershipRequest.deleteMany({ TeamId: req.params.id });
        // User-Verknüpfungen lösen
        await User.updateMany({}, { $pull: { teamPositions: { TeamId: req.params.id } } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams/:id/requests', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });

        const requestedPositions = normalizeRequestedTeamPositions(team, req.body?.positions);
        if (requestedPositions.length === 0) {
            return res.status(400).json({ error: 'Bitte mindestens eine gültige Position auswählen.' });
        }

        const userId = String(req.user._id);
        const isMember = (team.members || []).some((id) => String(id) === userId);
        const isModerator = (team.moderators || []).some((id) => String(id) === userId);
        if (isMember || isModerator) {
            return res.status(400).json({ error: 'Du bist bereits Teil dieses Teams.' });
        }

        const message = String(req.body?.message || '').trim().slice(0, 500);
        let request = await TeamMembershipRequest.findOne({
            TeamId: team._id,
            UserId: req.user._id,
            status: 'PENDING'
        });
        if (request) {
            request.requestedPositions = requestedPositions;
            request.message = message;
            await request.save();
        } else {
            request = await TeamMembershipRequest.create({
                TeamId: team._id,
                UserId: req.user._id,
                requestedPositions,
                message,
                status: 'PENDING'
            });
        }

        let moderatorIds = (team.moderators || []).map((id) => String(id));
        if (moderatorIds.length === 0) {
            const adminRole = await Role.findOne({ name: 'ADMIN' }).select('_id');
            if (adminRole?._id) {
                const admins = await User.find({ RoleIds: adminRole._id }).select('_id');
                moderatorIds = admins.map((admin) => String(admin._id));
            }
        }

        for (const targetId of moderatorIds) {
            if (String(targetId) === userId) continue;
            notifyService.notifyUser(targetId, 'system_update', {
                title: 'Neue Team-Anfrage',
                message: `${req.user.firstName || req.user.username} möchte dem Team "${team.name}" beitreten.`,
                link: '/teams'
            });
        }

        res.json({
            success: true,
            request: {
                _id: request._id,
                TeamId: request.TeamId,
                requestedPositions: request.requestedPositions,
                status: request.status,
                createdAt: request.createdAt
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/teams/:id/requests', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
        if (!canModerateTeam(team, req.user)) {
            return res.status(403).json({ error: 'Keine Berechtigung für Team-Anfragen.' });
        }
        const requests = await TeamMembershipRequest.find({ TeamId: team._id, status: 'PENDING' })
            .populate('UserId', 'username firstName lastName profileImage')
            .sort({ createdAt: -1 });
        res.json({
            requests: requests.map((request) => ({
                _id: request._id,
                user: request.UserId ? {
                    _id: request.UserId._id,
                    username: request.UserId.username,
                    firstName: request.UserId.firstName || '',
                    lastName: request.UserId.lastName || '',
                    profileImage: request.UserId.profileImage || ''
                } : null,
                requestedPositions: request.requestedPositions || [],
                message: request.message || '',
                createdAt: request.createdAt
            }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams/:id/requests/:requestId', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
        if (!canModerateTeam(team, req.user)) {
            return res.status(403).json({ error: 'Keine Berechtigung für Team-Anfragen.' });
        }

        const request = await TeamMembershipRequest.findOne({ _id: req.params.requestId, TeamId: team._id })
            .populate('UserId', 'username firstName lastName');
        if (!request || request.status !== 'PENDING') {
            return res.status(404).json({ error: 'Anfrage nicht gefunden oder bereits bearbeitet.' });
        }

        const action = String(req.body?.action || '').trim().toLowerCase();
        if (action !== 'approve' && action !== 'reject') {
            return res.status(400).json({ error: 'Ungültige Aktion.' });
        }

        if (action === 'approve') {
            team.members = Array.from(new Set([...(team.members || []).map((id) => String(id)), String(request.UserId._id)]));
            await team.save();

            const validPositions = normalizeRequestedTeamPositions(team, request.requestedPositions);
            const user = await User.findById(request.UserId._id);
            if (user) {
                const existing = Array.isArray(user.teamPositions) ? user.teamPositions : [];
                const withoutCurrentTeam = existing.filter((tp) => String(tp?.TeamId?._id || tp?.TeamId || '') !== String(team._id));
                const nextTeamPositions = [...withoutCurrentTeam];
                validPositions.forEach((position) => {
                    nextTeamPositions.push({ TeamId: team._id, position });
                });
                user.teamPositions = nextTeamPositions;
                await user.save();
            }
            request.status = 'APPROVED';
        } else {
            request.status = 'REJECTED';
        }

        request.handledBy = req.user._id;
        request.handledAt = new Date();
        await request.save();

        notifyService.notifyUser(request.UserId._id, 'system_update', {
            title: action === 'approve' ? 'Team-Anfrage angenommen' : 'Team-Anfrage abgelehnt',
            message: action === 'approve'
                ? `Deine Anfrage für "${team.name}" wurde angenommen.`
                : `Deine Anfrage für "${team.name}" wurde abgelehnt.`,
            link: '/teams'
        });

        res.json({ success: true, status: request.status });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams/:id/members/upsert', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
        if (!canModerateTeam(team, req.user)) {
            return res.status(403).json({ error: 'Keine Berechtigung für Team-Mitglieder.' });
        }

        const userId = String(req.body?.userId || '').trim();
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Ungültiger Benutzer.' });
        }
        const role = String(req.body?.role || 'MEMBER').trim().toUpperCase() === 'MODERATOR' ? 'MODERATOR' : 'MEMBER';
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

        const normalizedPositions = normalizeRequestedTeamPositions(team, req.body?.positions || []);
        if (normalizedPositions.length === 0) {
            return res.status(400).json({ error: 'Bitte mindestens eine gültige Position wählen.' });
        }

        const memberSet = new Set((team.members || []).map((id) => String(id)));
        const moderatorSet = new Set((team.moderators || []).map((id) => String(id)));
        memberSet.add(userId);
        if (role === 'MODERATOR') moderatorSet.add(userId);
        else moderatorSet.delete(userId);
        team.members = Array.from(memberSet);
        team.moderators = Array.from(moderatorSet);
        await team.save();

        const existing = Array.isArray(user.teamPositions) ? user.teamPositions : [];
        const withoutCurrentTeam = existing.filter((tp) => String(tp?.TeamId?._id || tp?.TeamId || '') !== String(team._id));
        user.teamPositions = [
            ...withoutCurrentTeam,
            ...normalizedPositions.map((position) => ({ TeamId: team._id, position }))
        ];
        await user.save();

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/teams/:id/members/:userId', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
        if (!canModerateTeam(team, req.user)) {
            return res.status(403).json({ error: 'Keine Berechtigung für Team-Mitglieder.' });
        }

        const userId = String(req.params.userId || '').trim();
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Ungültiger Benutzer.' });
        }
        team.members = (team.members || []).filter((id) => String(id) !== userId);
        team.moderators = (team.moderators || []).filter((id) => String(id) !== userId);
        await team.save();

        await User.updateOne(
            { _id: userId },
            { $pull: { teamPositions: { TeamId: team._id } } }
        );
        await TeamMembershipRequest.updateMany(
            { TeamId: team._id, UserId: userId, status: 'PENDING' },
            { $set: { status: 'REJECTED', handledBy: req.user._id, handledAt: new Date() } }
        );

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/plan-slots', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const slots = await PlanSlotConfig.find().populate('targetRules.TeamId', 'name').sort({ roleKey: 1 });
        res.json({
            roleDefinitions: PLAN_SLOT_DEFINITIONS,
            slots: slots.map(mapSlotConfigForClient)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/plan-slots/:roleKey', isAdmin, async (req, res) => {
    try {
        const roleKey = String(req.params.roleKey);
        if (!PLAN_SLOT_ROLE_KEYS.includes(roleKey)) {
            return res.status(400).json({ error: 'Unbekannter Dienst-Slot.' });
        }

        const definition = PLAN_SLOT_DEFINITIONS.find((slot) => slot.roleKey === roleKey);
        const payload = req.body || {};
        const editableFields = Array.isArray(payload.editableFields)
            ? payload.editableFields.map(String).map((v) => v.trim()).filter(Boolean)
            : [];
        const allowOnlyAssignedRequester = payload.allowOnlyAssignedRequester !== false;
        const targetRules = Array.isArray(payload.targetRules)
            ? payload.targetRules
                .map((rule) => ({
                    mode: String(rule.mode || 'INCLUDE').toUpperCase() === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE',
                    TeamId: rule.TeamId || null,
                    positions: Array.isArray(rule.positions)
                        ? rule.positions.map(String).map((v) => v.trim()).filter(Boolean)
                        : []
                }))
                .filter((rule) => Boolean(rule.TeamId))
                .map((rule) => ({
                    ...rule,
                    positions: rule.TeamId ? rule.positions : []
                }))
            : [];

        const saved = await PlanSlotConfig.findOneAndUpdate(
            { roleKey },
            {
                roleKey,
                label: payload.label || definition?.label || roleKey,
                allowOnlyAssignedRequester,
                editableFields,
                targetRules
            },
            { upsert: true, new: true }
        ).populate('targetRules.TeamId', 'name');

        res.json({ success: true, slot: mapSlotConfigForClient(saved) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/plan/:id/substitute/candidates', authMiddleware, async (req, res) => {
    try {
        const roleKey = String(req.query.roleKey || '');
        if (!roleKey) return res.status(400).json({ error: 'roleKey erforderlich.' });
        const plan = await MusicPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });

        const config = await PlanSlotConfig.findOne({ roleKey }).populate('targetRules.TeamId', 'name');
        const allowRequester = config?.allowOnlyAssignedRequester !== false || !config;
        if (!canRequestSubstituteScope({
            user: req.user,
            plan,
            roleKey,
            allowOnlyAssignedRequester: allowRequester
        })) {
            return res.status(403).json({ error: 'Nur die eingeteilte Person kann eine Vertretung anfordern.' });
        }

        let users = await resolveUsersForSlotConfig(roleKey, { excludeUserId: req.user._id });
        if (users.length === 0) {
            users = await User.find({ username: { $nin: [req.user.username] } })
                .select('firstName lastName username');
        }

        res.json({
            roleKey,
            config: config ? mapSlotConfigForClient(config) : null,
            users: users.map((u) => ({
                _id: u._id,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName
            }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUBSTITUTE REQUESTS (VERTRETUNG) ---
app.get('/api/substitutes', authMiddleware, async (req, res) => {
    try {
        const requests = await SubstituteRequest.find({ status: 'OPEN' })
            .populate('RequesterId', 'username firstName lastName')
            .populate('PlanId')
            .populate('TeamId')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/plan/:id/substitute', authMiddleware, async (req, res) => {
    try {
        const { roleKey, teamId, message, userIds } = req.body;
        const planId = req.params.id;
        if (!roleKey || !PLAN_SLOT_ROLE_KEYS.includes(String(roleKey))) {
            return res.status(400).json({ error: 'Ungültiger Dienst-Slot.' });
        }
        const plan = await MusicPlan.findById(planId);
        if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

        const slotConfig = await PlanSlotConfig.findOne({ roleKey: String(roleKey) });
        const allowOnlyAssignedRequester = slotConfig?.allowOnlyAssignedRequester !== false || !slotConfig;
        if (!canRequestSubstituteScope({
            user: req.user,
            plan,
            roleKey: String(roleKey),
            allowOnlyAssignedRequester
        })) {
            return res.status(403).json({ error: 'Nur die eingeteilte Person kann eine Vertretung anfordern.' });
        }

        const request = await SubstituteRequest.create({
            PlanId: planId,
            roleKey,
            RequesterId: req.user._id,
            TeamId: teamId || null,
            message,
            status: 'OPEN'
        });

        // Benachrichtigungen versenden
        let targetUserIds = [];
        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
            targetUserIds = userIds;
        } else {
            const autoTargets = await resolveUsersForSlotConfig(String(roleKey), { excludeUserId: req.user._id });
            targetUserIds = autoTargets.map((u) => u._id);
        }
        if (targetUserIds.length === 0 && teamId) {
            const teamMembers = await User.find({ 'teamPositions.TeamId': teamId });
            targetUserIds = teamMembers.map(u => u._id);
        } else if (teamId) {
            targetUserIds = [...new Set(targetUserIds.map((id) => String(id)))];
        }

        const dateStr = plan.Datum.split('-').reverse().join('.');
        for (const targetId of targetUserIds) {
            if (targetId.toString() === req.user._id.toString()) continue;
            notifyService.notifyUser(targetId, 'substitute_request', {
                title: 'Vertretung gesucht!',
                message: `${req.user.firstName} sucht Vertretung für "${roleKey}" am ${dateStr}.`,
                link: '/dienstplaner'
            });
        }

        res.json({ success: true, request, recipientCount: targetUserIds.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/substitutes/:id/accept', authMiddleware, requirePermission('accept_substitute'), async (req, res) => {
    try {
        const request = await SubstituteRequest.findById(req.params.id);
        if (!request || request.status !== 'OPEN') return res.status(404).json({ error: 'Anfrage nicht mehr verfügbar.' });

        const plan = await MusicPlan.findById(request.PlanId);
        if (!plan) return res.status(404).json({ error: 'Termin existiert nicht mehr.' });

        // Plan aktualisieren
        plan[request.roleKey] = req.user.username;
        await plan.save();

        // Request abschließen
        request.status = 'FILLED';
        request.filledBy = req.user._id;
        await request.save();

        // Requester benachrichtigen
        notifyService.notifyUser(request.RequesterId, 'plan_assigned', {
            title: 'Vertretung gefunden!',
            message: `${req.user.firstName} hat deinen Dienst "${request.roleKey}" übernommen.`,
            link: `/dienstplaner?entry=${plan._id}`
        });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/tags', isAdmin, async (req, res) => {
    try {
        const tags = await User.distinct('tags');
        res.json(tags.filter(Boolean).sort());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Öffentliches Mitgliederverzeichnis (für alle Angemeldeten)
app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        const isAdm = req.user.RoleIds.some(r => r.name === 'ADMIN');
        if (isAdm) {
            // Admins sehen alles
            return res.json(await User.find().populate('RoleIds'));
        } else {
            // Normale User sehen nur öffentliche Profile
            return res.json(await User.find({ status: { $ne: 'HIDDEN' } }).select('username firstName lastName profileImage status isOnline lastSeen'));
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', isAdmin, async (req, res) => {
    try {
        const { username, firstName, lastName, email, countryCode, phone, roleIds, birthday, tags, teamPositions } = req.body;
        const user = await User.create({ username, firstName, lastName, email, countryCode, phone, RoleIds: roleIds, birthday, tags, teamPositions });
        searchService.upsertUserById(user._id).catch(() => { });
        res.json({ success: true, user: { id: user._id, username: user.username } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/users/:id', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
        const { firstName, lastName, email, countryCode, phone, roleIds, birthday, tags, teamPositions } = req.body;
        if (roleIds) user.RoleIds = roleIds;
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email;
        user.countryCode = countryCode;
        user.phone = phone;
        user.birthday = birthday;
        user.tags = tags;
        user.teamPositions = teamPositions;
        await user.save();
        searchService.upsertUserById(user._id).catch(() => { });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/users/:id', isAdmin, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    searchService.upsertUserById(req.params.id).catch(() => { });
    res.json({ success: true });
});
app.post('/api/users/:id/unlock', isAdmin, async (req, res) => { await User.findByIdAndUpdate(req.params.id, { failedAttempts: 0, lockUntil: null }); res.json({ success: true }); });
app.post('/api/users/:id/onboarding-debug', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
        user.onboardingCompleted = false;
        user.onboardingSkipped = false;
        await user.save();
        searchService.upsertUserById(user._id).catch(() => { });
        res.json({ success: true, userId: user._id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/broadcast-update', isAdmin, async (req, res) => {
    try {
        const { title, message, link } = req.body;
        if (!title || !message) return res.status(400).json({ error: 'Titel und Nachricht erforderlich' });

        await notifyService.notifyMany({}, 'system_update', {
            title,
            message,
            link: link || '/'
        });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CHAT API ---
app.get('/api/chat/conversations', authMiddleware, async (req, res) => {
    try {
        const convs = await ChatConversation.find({ participants: req.user._id })
            .populate('participants', 'username firstName lastName profileImage')
            .populate({
                path: 'lastMessage',
                populate: { path: 'SenderId', select: 'username firstName lastName' }
            })
            .sort({ updatedAt: -1 });
        res.json(convs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat/messages/:conversationId', authMiddleware, async (req, res) => {
    try {
        const conv = await ChatConversation.findOne({
            _id: req.params.conversationId,
            participants: req.user._id
        });
        if (!conv) return res.status(403).json({ error: 'Kein Zugriff' });

        const messages = await ChatMessage.find({ ConversationId: conv._id })
            .populate('SenderId', 'username firstName lastName profileImage')
            .sort({ createdAt: 1 })
            .limit(100);
        res.json(messages);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat/unread-count', authMiddleware, async (req, res) => {
    try {
        const convs = await ChatConversation.find({ participants: req.user._id });
        const convIds = convs.map(c => c._id);
        const count = await ChatMessage.countDocuments({
            ConversationId: { $in: convIds },
            SenderId: { $ne: req.user._id },
            readBy: { $ne: req.user._id }
        });
        res.json({ count });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chat/read/:conversationId', authMiddleware, async (req, res) => {
    try {
        await ChatMessage.updateMany(
            {
                ConversationId: req.params.conversationId,
                SenderId: { $ne: req.user._id },
                readBy: { $ne: req.user._id }
            },
            { $addToSet: { readBy: req.user._id } }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PROFILE & AUTH ---
app.put('/api/auth/bio', authMiddleware, async (req, res) => {
    try {
        const { bio } = req.body;
        if (bio && bio.length > 500) return res.status(400).json({ error: 'Bio zu lang' });
        req.user.bio = bio;
        await req.user.save();
        res.json({ success: true, bio });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/profile/:username', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .populate('RoleIds')
            .populate('teamPositions.TeamId', 'name positions positionMeta');
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        const isAdminUser = req.user.RoleIds?.some((role) => role.name === 'ADMIN');
        const canViewHome = await userHasAnyToolPermission(req.user, 'HOME', 'view');
        const viewerId = req.user._id;
        const isSelf = viewerId.toString() === user._id.toString();

        let posts = [];
        if (canViewHome || isAdminUser || isSelf) {
            let channelConstraint = {};
            if (!isAdminUser) {
                const subscribedChannelIds = (await Channel.find({
                    $or: [{ createdBy: viewerId }, { moderators: viewerId }, { subscribers: viewerId }]
                }).select('_id')).map((channel) => channel._id);
                channelConstraint = {
                    $or: [
                        { channel: { $exists: false } },
                        { channel: null },
                        { channel: { $in: subscribedChannelIds } }
                    ]
                };
            }

            posts = await Post.find({
                author: user._id,
                ...channelConstraint
            })
                .sort({ createdAt: -1 })
                .limit(25)
                .populate('channel', 'title isPrivate')
                .select('content attachments optimizedAttachments likes comments createdAt');
        }

        const emailVisible = isSelf || isAdminUser || Boolean(user.contactVisibility?.emailPublic);
        const phoneVisible = isSelf || isAdminUser || Boolean(user.contactVisibility?.phonePublic);

        const safeUser = {
            _id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: emailVisible ? user.email : null,
            phone: phoneVisible ? user.phone : null,
            birthday: user.birthday,
            createdAt: user.createdAt,
            profileImage: user.profileImage,
            optimizedProfileImage: user.optimizedProfileImage,
            coverImage: user.coverImage,
            optimizedCoverImage: user.optimizedCoverImage,
            coverColor: user.coverColor,
            bio: user.bio,
            status: user.status,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            contactVisibility: user.contactVisibility || { emailPublic: false, phonePublic: false },
            RoleIds: user.RoleIds,
            teamPositions: user.teamPositions || [],
            tags: user.tags || []
        };

        res.json({
            user: safeUser,
            posts: posts.map((post) => ({
                _id: post._id,
                content: post.content || '',
                image: post.optimizedAttachments?.[0] || post.attachments?.[0] || null,
                likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
                commentsCount: Array.isArray(post.comments) ? post.comments.length : 0,
                channelTitle: post.channel?.title || 'Schwarzes Brett',
                createdAt: post.createdAt
            }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/messenger', authMiddleware, async (req, res) => {
    try {
        const users = await User.find()
            .select('username firstName lastName profileImage isOnline lastSeen status')
            .sort({ isOnline: -1, lastName: 1 });
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- WALL API ---
const isChannelAccessibleForUser = (channel, user, { includePublic = true } = {}) => {
    if (!channel || !user) return false;
    const userId = user._id.toString();
    const isAdminUser = user.RoleIds?.some((role) => role.name === 'ADMIN');
    if (isAdminUser) return true;
    if (channel.createdBy?.toString() === userId) return true;
    if (channel.moderators?.some((id) => id.toString() === userId)) return true;
    if (channel.subscribers?.some((id) => id.toString() === userId)) return true;
    if (includePublic && !channel.isPrivate) return true;
    return false;
};

const isChannelModeratorForUser = (channel, user) => {
    if (!channel || !user) return false;
    const userId = user._id.toString();
    if (channel.createdBy?.toString() === userId) return true;
    if (channel.moderators?.some((id) => id.toString() === userId)) return true;
    return false;
};

const toChannelPayload = (channel, user) => {
    const userId = user?._id?.toString();
    const isCreator = String(channel.createdBy?._id || channel.createdBy || '') === String(userId || '');
    const isModerator = isCreator || (channel.moderators?.some((id) => String(id?._id || id) === String(userId || '')) || false);
    const isSubscriber = isModerator || (channel.subscribers?.some((id) => String(id?._id || id) === String(userId || '')) || false);
    return {
        _id: channel._id,
        title: channel.title,
        description: channel.description || '',
        image: channel.optimizedImage || channel.image || '',
        isPrivate: Boolean(channel.isPrivate),
        isPassive: Boolean(channel.isPassive),
        coverColor: channel.coverColor || '',
        createdAt: channel.createdAt,
        createdBy: channel.createdBy,
        moderators: channel.moderators || [],
        subscribers: channel.subscribers || [],
        isSubscriber,
        isModerator,
        pendingRequest: channel.joinRequests?.some((request) => request.user.toString() === userId && request.status === 'PENDING') || false,
        subscriberCount: channel.subscribers?.length || 0
    };
};

app.get('/api/channels', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const channels = await Channel.find({})
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username firstName lastName optimizedProfileImage')
            .populate('moderators', 'username firstName lastName optimizedProfileImage');

        const visible = channels.filter((channel) => isChannelAccessibleForUser(channel, req.user));
        const compact = visible.map((channel) => toChannelPayload(channel, req.user));
        res.json(compact);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/channels/mine', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const channels = await Channel.find({
            $or: [
                { createdBy: req.user._id },
                { moderators: req.user._id },
                { subscribers: req.user._id }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username firstName lastName optimizedProfileImage')
            .populate('moderators', 'username firstName lastName optimizedProfileImage');
        res.json(channels.map((channel) => toChannelPayload(channel, req.user)));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/channels/directory', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const parsedOffset = Number.parseInt(req.query.offset, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const offset = Math.max(Number.isInteger(parsedOffset) ? parsedOffset : 0, 0);
        const limit = Math.min(Math.max(Number.isInteger(parsedLimit) ? parsedLimit : 12, 1), 40);
        const search = String(req.query.search || '').trim();

        const match = {};
        if (search) {
            match.$or = [
                { title: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        const [items, total] = await Promise.all([
            Channel.find(match)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .populate('createdBy', 'username firstName lastName optimizedProfileImage')
                .populate('moderators', 'username firstName lastName optimizedProfileImage'),
            Channel.countDocuments(match)
        ]);

        const payload = items.map((channel) => toChannelPayload(channel, req.user));
        const nextOffset = offset + payload.length;
        res.json({
            items: payload,
            total,
            hasMore: nextOffset < total,
            nextOffset
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/channels/:id', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id)
            .populate('createdBy', 'username firstName lastName optimizedProfileImage')
            .populate('moderators', 'username firstName lastName optimizedProfileImage');
        if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });
        if (!isChannelAccessibleForUser(channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }
        res.json(toChannelPayload(channel, req.user));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/search', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });

        const rawQuery = String(req.query.q || '').trim();
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 20);
        if (rawQuery.length < 2) {
            return res.json({ query: rawQuery, users: [], channels: [], posts: [], plans: [], tools: [], total: 0 });
        }

        const userId = req.user._id;
        const isAdminUser = req.user.RoleIds?.some((role) => role.name === 'ADMIN');
        const canViewHome = await userHasAnyToolPermission(req.user, 'HOME', 'view');
        const canViewPlan = await userHasAnyToolPermission(req.user, 'MUSIC_PLANER', 'view');
        const canViewUserMgmt = await userHasAnyToolPermission(req.user, 'USER_MGMT', 'view');
        const canViewRoles = await userHasAnyToolPermission(req.user, 'ROLES', 'view');
        const canViewBot = await userHasAnyToolPermission(req.user, 'BOT_CONTROL', 'view');
        const canViewActivity = await userHasAnyToolPermission(req.user, 'ACTIVITY_LOGS', 'view');
        const rx = new RegExp(escapeRegExp(rawQuery), 'i');
        const tools = [
            { id: 'tool-wall', allow: canViewHome, title: 'Schwarzes Brett', subtitle: 'Beiträge und Updates', href: '/', keywords: ['home', 'wall', 'beiträge', 'brett', 'startseite'] },
            { id: 'tool-channels', allow: canViewHome, title: 'Meine Kanäle', subtitle: 'Kanäle und Gruppen', href: '/channels', keywords: ['kanäle', 'gruppen', 'channels'] },
            { id: 'tool-my-teams', allow: canViewHome, title: 'Meine Teams', subtitle: 'Mitgliedschaften und Rollen', href: '/teams', keywords: ['teams', 'mitgliedschaft', 'moderator', 'positionen'] },
            { id: 'tool-planer', allow: canViewPlan, title: 'Dienstplaner', subtitle: 'Dienstplan und Einteilungen', href: '/dienstplaner', keywords: ['dienst', 'plan', 'musik', 'dienstplan'] },
            { id: 'tool-messenger', allow: true, title: 'Messenger', subtitle: 'Chats und Direktnachrichten', href: '/messenger', keywords: ['chat', 'nachrichten', 'dm'] },
            { id: 'tool-admin-dashboard', allow: isAdminUser, title: 'Admin Dashboard', subtitle: 'Systemübersicht', href: '/admin', keywords: ['admin', 'dashboard', 'steuerung'] },
            { id: 'tool-admin-users', allow: canViewUserMgmt, title: 'Admin Benutzer', subtitle: 'Benutzerverwaltung', href: '/admin/users', keywords: ['admin', 'user', 'benutzer', 'verwaltung'] },
            { id: 'tool-admin-roles', allow: canViewRoles, title: 'Admin Rollen', subtitle: 'Rollen und Berechtigungen', href: '/admin/roles', keywords: ['admin', 'rollen', 'rechte', 'permissions'] },
            { id: 'tool-admin-teams', allow: canViewUserMgmt, title: 'Admin Teams', subtitle: 'Teams verwalten', href: '/admin/teams', keywords: ['admin', 'teams', 'gruppen'] },
            { id: 'tool-admin-tags', allow: canViewUserMgmt, title: 'Admin Kategorien', subtitle: 'Globale Kategorien', href: '/admin/tags', keywords: ['admin', 'kategorien', 'tags'] },
            { id: 'tool-admin-plan-slots', allow: canViewUserMgmt, title: 'Admin Dienst-Slots', subtitle: 'Plan-Slots konfigurieren', href: '/admin/plan-slots', keywords: ['admin', 'dienst', 'slots', 'planer'] },
            { id: 'tool-admin-security', allow: canViewUserMgmt, title: 'Admin Sicherheit', subtitle: 'Sicherheits- und Systemeinstellungen', href: '/admin/security', keywords: ['admin', 'security', 'sicherheit', 'settings'] },
            { id: 'tool-admin-email', allow: canViewUserMgmt, title: 'Admin Email Versand', subtitle: 'E-Mail Kampagnen und Verteiler', href: '/admin/email', keywords: ['admin', 'email', 'mail', 'newsletter', 'versand'] },
            { id: 'tool-admin-bot', allow: canViewBot, title: 'Admin Bot', subtitle: 'WhatsApp und Bot-Steuerung', href: '/admin/bot', keywords: ['admin', 'bot', 'whatsapp', 'steuerung'] },
            { id: 'tool-admin-jobs', allow: canViewBot, title: 'Admin Jobs', subtitle: 'Geplante Jobs und Ausführung', href: '/admin/jobs', keywords: ['admin', 'jobs', 'scheduler', 'cron'] },
            { id: 'tool-admin-activity', allow: canViewActivity, title: 'Admin Aktivität', subtitle: 'Aktivitäts- und System-Logs', href: '/admin/activity', keywords: ['admin', 'logs', 'aktivität', 'system'] },
            { id: 'tool-admin-monitor', allow: canViewActivity, title: 'Admin Monitor', subtitle: 'Systemmonitoring', href: '/admin/monitor', keywords: ['admin', 'monitor', 'health', 'status'] },
            { id: 'tool-admin-stats', allow: canViewActivity, title: 'Admin Statistiken', subtitle: 'Systemstatistiken', href: '/admin/stats', keywords: ['admin', 'stats', 'statistik', 'metriken'] }
        ]
            .filter((item) => item.allow)
            .filter((item) => {
                const haystack = [item.title, item.subtitle, ...(item.keywords || [])].filter(Boolean);
                return haystack.some((value) => rx.test(String(value)));
            })
            .slice(0, limit)
            .map(({ id, title, subtitle, href }) => ({ type: 'tool', id, title, subtitle, href }));

        if (searchService.isMeiliEnabled()) {
            try {
                const ids = await searchService.searchIds({ query: rawQuery, limit });
                if (ids) {
                    const subscribedChannelIds = !isAdminUser && canViewHome
                        ? (await Channel.find({
                            $or: [{ createdBy: userId }, { moderators: userId }, { subscribers: userId }]
                        }).select('_id')).map((channel) => channel._id)
                        : [];

                    const [userDocs, channelDocs, postDocs, planDocs] = await Promise.all([
                        ids.users?.length > 0
                            ? User.find(
                                isAdminUser
                                    ? { _id: { $in: ids.users } }
                                    : { _id: { $in: ids.users }, status: { $ne: 'HIDDEN' } }
                            ).select('username firstName lastName optimizedProfileImage profileImage')
                            : Promise.resolve([]),
                        canViewHome && ids.channels?.length > 0
                            ? Channel.find({
                                _id: { $in: ids.channels },
                                ...(isAdminUser ? {} : {
                                    $or: [
                                        { isPrivate: false },
                                        { createdBy: userId },
                                        { moderators: userId },
                                        { subscribers: userId }
                                    ]
                                })
                            })
                            : Promise.resolve([]),
                        canViewHome && ids.posts?.length > 0
                            ? Post.find({
                                _id: { $in: ids.posts },
                                ...(isAdminUser ? {} : {
                                    $or: [
                                        { channel: { $exists: false } },
                                        { channel: null },
                                        { channel: { $in: subscribedChannelIds } }
                                    ]
                                })
                            })
                                .populate('author', 'username firstName lastName')
                                .populate('channel', 'title isPrivate')
                            : Promise.resolve([]),
                        canViewPlan && ids.plans?.length > 0
                            ? MusicPlan.find({ _id: { $in: ids.plans } })
                            : Promise.resolve([])
                    ]);

                    const users = sortByIdOrder(userDocs, ids.users || []);
                    const channels = sortByIdOrder(channelDocs, ids.channels || []);
                    const posts = sortByIdOrder(postDocs, ids.posts || []);
                    const plans = sortByIdOrder(planDocs, ids.plans || []);

                    const payload = {
                        query: rawQuery,
                        users: users.map((user) => ({
                            type: 'user',
                            id: user._id,
                            title: user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username,
                            subtitle: `@${user.username}`,
                            image: user.optimizedProfileImage || user.profileImage || '',
                            href: `/profile/${user.username}`
                        })),
                        channels: channels.map((channel) => ({
                            type: 'channel',
                            id: channel._id,
                            title: channel.title,
                            subtitle: channel.description || (channel.isPrivate ? 'Privater Kanal' : 'Öffentlicher Kanal'),
                            image: channel.optimizedImage || channel.image || '',
                            href: `/channels/${channel._id}`
                        })),
                        posts: posts.map((post) => ({
                            type: 'post',
                            id: post._id,
                            title: post.content ? String(post.content).slice(0, 100) : 'Beitrag',
                            subtitle: post.channel?.title || (post.author?.firstName ? `${post.author.firstName} ${post.author.lastName || ''}` : `@${post.author?.username || ''}`),
                            pinned: Boolean(post.pinned),
                            href: `/wall/post/${post._id}`
                        })),
                        plans: plans.map((plan) => ({
                            type: 'plan',
                            id: plan._id,
                            title: `${plan.Datum} ${plan.Thema ? `• ${plan.Thema}` : ''}`.trim(),
                            subtitle: `Predigt: ${plan.Predigt || '-'} • Leitung: ${plan.Leitung || '-'}`,
                            href: `/dienstplaner?entry=${plan._id}`
                        }))
                    };
                    payload.tools = tools;
                    payload.total = payload.users.length + payload.channels.length + payload.posts.length + payload.plans.length + payload.tools.length;
                    return res.json(payload);
                }
            } catch (_searchError) {
                // Fallback to Mongo search below
            }
        }

        const [users, channels, posts, plans] = await Promise.all([
            User.find(
                isAdminUser
                    ? { $or: [{ username: rx }, { firstName: rx }, { lastName: rx }, { email: rx }] }
                    : { status: { $ne: 'HIDDEN' }, $or: [{ username: rx }, { firstName: rx }, { lastName: rx }] }
            )
                .select('username firstName lastName optimizedProfileImage profileImage')
                .sort({ firstName: 1, lastName: 1 })
                .limit(limit),
            canViewHome
                ? Channel.find({
                    $and: [
                        { $or: [{ title: rx }, { description: rx }] },
                        isAdminUser ? {} : {
                            $or: [
                                { isPrivate: false },
                                { createdBy: userId },
                                { moderators: userId },
                                { subscribers: userId }
                            ]
                        }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .limit(limit)
                : Promise.resolve([]),
            canViewHome
                ? Post.find({
                    $and: [
                        {
                            $or: [
                                { content: rx },
                                { 'linkData.title': rx },
                                { 'linkData.description': rx },
                                { 'poll.question': rx },
                                { 'poll.options.label': rx }
                            ]
                        },
                        isAdminUser
                            ? {}
                            : {
                                $or: [
                                    { channel: { $exists: false } },
                                    { channel: null },
                                    {
                                        channel: {
                                            $in: (await Channel.find({
                                                $or: [{ createdBy: userId }, { moderators: userId }, { subscribers: userId }]
                                            }).select('_id')).map((channel) => channel._id)
                                        }
                                    }
                                ]
                            }
                    ]
                })
                    .populate('author', 'username firstName lastName')
                    .populate('channel', 'title isPrivate')
                    .sort({ pinned: -1, pinnedAt: -1, createdAt: -1 })
                    .limit(limit)
                : Promise.resolve([]),
            canViewPlan
                ? MusicPlan.find({
                    $or: [
                        { Datum: rx },
                        { Thema: rx },
                        { Predigt: rx },
                        { Leitung: rx },
                        { TechnikPC: rx },
                        { TechnikSound: rx },
                        { Organisator: rx },
                        { Anbetungsstunde: rx },
                        { Klavier: rx },
                        { Gitarre: rx },
                        { Bass: rx },
                        { Schlagzeug: rx },
                        { Gesang1: rx },
                        { Gesang2: rx }
                    ]
                })
                    .sort({ Datum: -1 })
                    .limit(limit)
                : Promise.resolve([])
        ]);

        const payload = {
            query: rawQuery,
            users: users.map((user) => ({
                type: 'user',
                id: user._id,
                title: user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username,
                subtitle: `@${user.username}`,
                image: user.optimizedProfileImage || user.profileImage || '',
                href: `/profile/${user.username}`
            })),
            channels: channels.map((channel) => ({
                type: 'channel',
                id: channel._id,
                title: channel.title,
                subtitle: channel.description || (channel.isPrivate ? 'Privater Kanal' : 'Öffentlicher Kanal'),
                image: channel.optimizedImage || channel.image || '',
                href: `/channels/${channel._id}`
            })),
            posts: posts.map((post) => ({
                type: 'post',
                id: post._id,
                title: post.content ? String(post.content).slice(0, 100) : 'Beitrag',
                subtitle: post.channel?.title || (post.author?.firstName ? `${post.author.firstName} ${post.author.lastName || ''}` : `@${post.author?.username || ''}`),
                pinned: Boolean(post.pinned),
                href: `/wall/post/${post._id}`
            })),
            plans: plans.map((plan) => ({
                type: 'plan',
                id: plan._id,
                title: `${plan.Datum} ${plan.Thema ? `• ${plan.Thema}` : ''}`.trim(),
                subtitle: `Predigt: ${plan.Predigt || '-'} • Leitung: ${plan.Leitung || '-'}`,
                href: `/dienstplaner?entry=${plan._id}`
            }))
        };
        payload.tools = tools;
        payload.total = payload.users.length + payload.channels.length + payload.posts.length + payload.plans.length + payload.tools.length;
        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/channels', checkPermission('HOME', 'view'), upload.single('image'), async (req, res) => {
    try {
        const { title, description = '', isPrivate = 'false', isPassive = 'false', coverColor = '' } = req.body;
        if (!title?.trim()) return res.status(400).json({ error: 'Titel ist erforderlich.' });
        const normalizedCoverColor = String(coverColor || '').trim();
        if (normalizedCoverColor && !/^#[0-9A-Fa-f]{6}$/.test(normalizedCoverColor)) {
            return res.status(400).json({ error: 'Ungültige Titelfarbe. Bitte Hex wie #A1CED9 verwenden.' });
        }
        const channel = new Channel({
            title: title.trim(),
            description: description.trim(),
            isPrivate: String(isPrivate) === 'true',
            isPassive: String(isPassive) === 'true',
            coverColor: normalizedCoverColor,
            createdBy: req.user._id,
            moderators: [req.user._id],
            subscribers: [req.user._id]
        });
        await channel.save();

        if (req.file) {
            channel.image = await saveImageBuffer({
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                scope: 'channels',
                ownerId: channel._id,
                variant: 'original'
            });
            processImageAsync('CHANNEL', channel._id, req.file.buffer, 0);
            await channel.save();
        }

        const saved = await Channel.findById(channel._id)
            .populate('createdBy', 'username firstName lastName optimizedProfileImage')
            .populate('moderators', 'username firstName lastName optimizedProfileImage');
        searchService.upsertChannelById(channel._id).catch(() => { });
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/channels/:id', checkPermission('HOME', 'view'), upload.single('image'), async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });

        const isModerator = channel.moderators.some((id) => id.toString() === req.user._id.toString()) || channel.createdBy.toString() === req.user._id.toString();
        if (!isModerator) return res.status(403).json({ error: 'Nicht autorisiert.' });

        const { title, description, isPrivate, isPassive, moderatorIds, memberIds, coverColor } = req.body;
        if (typeof title === 'string' && title.trim()) channel.title = title.trim();
        if (typeof description === 'string') channel.description = description.trim();
        if (typeof isPrivate !== 'undefined') channel.isPrivate = String(isPrivate) === 'true';
        if (typeof isPassive !== 'undefined') channel.isPassive = String(isPassive) === 'true';
        if (typeof coverColor !== 'undefined') {
            const normalizedCoverColor = String(coverColor || '').trim();
            if (normalizedCoverColor && !/^#[0-9A-Fa-f]{6}$/.test(normalizedCoverColor)) {
                return res.status(400).json({ error: 'Ungültige Titelfarbe. Bitte Hex wie #A1CED9 verwenden.' });
            }
            channel.coverColor = normalizedCoverColor;
        }

        if (moderatorIds) {
            const incoming = Array.isArray(moderatorIds) ? moderatorIds : JSON.parse(moderatorIds);
            const unique = [...new Set([channel.createdBy.toString(), ...incoming.map((id) => String(id))])];
            channel.moderators = unique;
        }
        if (memberIds) {
            const incomingMembers = Array.isArray(memberIds) ? memberIds : JSON.parse(memberIds);
            const withCreatorAndMods = new Set([
                channel.createdBy.toString(),
                ...(channel.moderators || []).map((id) => String(id)),
                ...incomingMembers.map((id) => String(id))
            ]);
            channel.subscribers = [...withCreatorAndMods];
        }

        if (req.file) {
            await Promise.all([channel.image, channel.optimizedImage].filter(Boolean).map((path) => deleteByPublicPath(path)));
            channel.image = await saveImageBuffer({
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                scope: 'channels',
                ownerId: channel._id,
                variant: 'original'
            });
            processImageAsync('CHANNEL', channel._id, req.file.buffer, 0);
        }

        await channel.save();
        const saved = await Channel.findById(channel._id)
            .populate('createdBy', 'username firstName lastName optimizedProfileImage')
            .populate('moderators', 'username firstName lastName optimizedProfileImage');
        searchService.upsertChannelById(channel._id).catch(() => { });
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/channels/:id/subscribe', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });

        const userId = req.user._id.toString();
        const isAdminUser = req.user.RoleIds.some((role) => role.name === 'ADMIN');
        const isMember = channel.subscribers.some((id) => id.toString() === userId)
            || channel.moderators.some((id) => id.toString() === userId)
            || channel.createdBy.toString() === userId;

        if (isMember) {
            channel.subscribers = channel.subscribers.filter((id) => id.toString() !== userId);
            channel.joinRequests = (channel.joinRequests || []).filter((request) => !(request.user.toString() === userId && request.status === 'PENDING'));
            await channel.save();
            return res.json({ success: true, subscribed: false, requested: false });
        }

        if (channel.isPrivate && !isAdminUser) {
            return res.status(403).json({ error: 'Privater Kanal: Nur Moderatoren können Mitglieder hinzufügen.' });
        }

        channel.subscribers.push(req.user._id);
        await channel.save();
        res.json({ success: true, subscribed: true, requested: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/channels/:id/requests', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id).populate('joinRequests.user', 'username firstName lastName optimizedProfileImage');
        if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });

        const isModerator = channel.moderators.some((id) => id.toString() === req.user._id.toString()) || channel.createdBy.toString() === req.user._id.toString();
        if (!isModerator) return res.status(403).json({ error: 'Nicht autorisiert.' });

        res.json((channel.joinRequests || []).filter((request) => request.status === 'PENDING'));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/channels/:id/requests/:requestId', checkPermission('HOME', 'edit'), async (req, res) => {
    try {
        const { action } = req.body;
        if (!['approve', 'reject', 'ignore'].includes(action)) return res.status(400).json({ error: 'Ungültige Aktion.' });
        const channel = await Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });

        const isModerator = channel.moderators.some((id) => id.toString() === req.user._id.toString()) || channel.createdBy.toString() === req.user._id.toString();
        if (!isModerator) return res.status(403).json({ error: 'Nicht autorisiert.' });

        const requestItem = channel.joinRequests.id(req.params.requestId);
        if (!requestItem) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });

        if (action === 'approve') {
            requestItem.status = 'APPROVED';
            if (!channel.subscribers.some((id) => id.toString() === requestItem.user.toString())) {
                channel.subscribers.push(requestItem.user);
            }
        } else if (action === 'reject') {
            requestItem.status = 'REJECTED';
        } else {
            requestItem.status = 'PENDING';
        }

        requestItem.handledAt = new Date();
        requestItem.handledBy = req.user._id;
        await channel.save();

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/wall', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const parsedOffset = Number.parseInt(req.query.offset, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const { channelId } = req.query;
        const isPaginated = Number.isInteger(parsedOffset) || Number.isInteger(parsedLimit);
        const offset = Math.max(Number.isInteger(parsedOffset) ? parsedOffset : 0, 0);
        const limit = Math.min(Math.max(Number.isInteger(parsedLimit) ? parsedLimit : 10, 1), 30);
        const isAdminUser = req.user.RoleIds.some((role) => role.name === 'ADMIN');

        let matchStage = {};
        if (channelId) {
            const channel = await Channel.findById(channelId);
            if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });
            if (!isChannelAccessibleForUser(channel, req.user)) {
                return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
            }
            matchStage = { channel: channel._id };
        } else if (!isAdminUser) {
            const subscribedChannels = await Channel.find({
                $or: [
                    { createdBy: req.user._id },
                    { moderators: req.user._id },
                    { subscribers: req.user._id }
                ]
            }).select('_id');
            const channelIds = subscribedChannels.map((channel) => channel._id);
            matchStage = {
                $or: [
                    { channel: { $exists: false } },
                    { channel: null },
                    { channel: { $in: channelIds } }
                ]
            };
        }

        const pipeline = [
            ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
            { $sort: { pinned: -1, pinnedAt: -1, createdAt: -1 } },
            ...(isPaginated ? [{ $skip: offset }, { $limit: limit }] : [{ $limit: 20 }]),
            {
                $project: {
                    author: 1,
                    channel: 1,
                    content: 1,
                    attachments: 1,
                    optimizedAttachments: 1,
                    likes: 1,
                    isModerated: 1,
                    linkData: 1,
                    poll: 1,
                    pinned: 1,
                    pinnedAt: 1,
                    createdAt: 1,
                    commentsCount: { $size: { $ifNull: ['$comments', []] } }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'authorDoc'
                }
            },
            { $unwind: { path: '$authorDoc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'channels',
                    localField: 'channel',
                    foreignField: '_id',
                    as: 'channelDoc'
                }
            },
            { $unwind: { path: '$channelDoc', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    content: 1,
                    channel: {
                        _id: '$channelDoc._id',
                        title: '$channelDoc.title',
                        image: { $ifNull: ['$channelDoc.optimizedImage', '$channelDoc.image'] },
                        isPrivate: '$channelDoc.isPrivate',
                        createdBy: '$channelDoc.createdBy',
                        moderators: '$channelDoc.moderators'
                    },
                    attachments: 1,
                    optimizedAttachments: 1,
                    likes: 1,
                    isModerated: 1,
                    linkData: 1,
                    poll: 1,
                    pinned: 1,
                    pinnedAt: 1,
                    createdAt: 1,
                    commentsCount: 1,
                    author: {
                        _id: '$authorDoc._id',
                        username: '$authorDoc.username',
                        firstName: '$authorDoc.firstName',
                        lastName: '$authorDoc.lastName',
                        optimizedProfileImage: '$authorDoc.optimizedProfileImage'
                    }
                }
            }
        ];

        const posts = await Post.aggregate(pipeline);

        // Prefer optimized image payloads in feed responses to reduce transfer size.
        const compactPosts = posts.map((post) => {
            if (Array.isArray(post.optimizedAttachments) && post.optimizedAttachments.length > 0) {
                return { ...post, attachments: post.optimizedAttachments, optimizedAttachments: [] };
            }
            return post;
        });

        if (!isPaginated) {
            return res.json(compactPosts);
        }

        const total = await Post.countDocuments(matchStage);
        const nextOffset = offset + compactPosts.length;
        return res.json({
            items: compactPosts,
            total,
            hasMore: nextOffset < total,
            nextOffset
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/wall/:id', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'username firstName lastName optimizedProfileImage bio')
            .populate('channel', 'title image optimizedImage isPrivate createdBy moderators subscribers')
            .populate('comments.author', 'username firstName lastName optimizedProfileImage');
        if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
        if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }
        res.json(post);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/wall/:id/comments', checkPermission('HOME', 'view'), async (req, res) => {
    try {
        const parsedOffset = Number.parseInt(req.query.offset, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const offset = Math.max(Number.isInteger(parsedOffset) ? parsedOffset : 0, 0);
        const limit = Math.min(Math.max(Number.isInteger(parsedLimit) ? parsedLimit : 8, 1), 30);

        const post = await Post.findById(req.params.id).select('comments channel').populate('channel', 'title isPrivate createdBy moderators subscribers');
        if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
        if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }

        const total = Array.isArray(post.comments) ? post.comments.length : 0;
        const comments = post.comments.slice(offset, offset + limit).map((comment) => comment.toObject());
        const populatedComments = await Post.populate(comments, {
            path: 'author',
            select: 'username firstName lastName optimizedProfileImage'
        });

        const nextOffset = offset + populatedComments.length;
        res.json({
            comments: populatedComments,
            total,
            hasMore: nextOffset < total,
            nextOffset
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wall/:id/like', checkPermission('HOME', 'edit'), async (req, res) => {
    const post = await Post.findById(req.params.id).populate('channel', 'title isPrivate createdBy moderators subscribers');
    if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
    if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
        return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
    }
    const idx = post.likes.indexOf(req.user._id);
    if (idx === -1) {
        post.likes.push(req.user._id);
        // Notify author if it's not themselves
        if (post.author.toString() !== req.user._id.toString()) {
            notifyService.notifyUser(post.author, 'wall_like', {
                title: 'Neuer Like',
                message: `${req.user.firstName} gefällt dein Beitrag.`,
                link: `/wall/post/${post._id}`
            });
        }
    } else {
        post.likes.splice(idx, 1);
    }
    await post.save();
    searchService.upsertPostById(post._id).catch(() => { });
    res.json({ success: true, likes: post.likes });
});

app.post('/api/wall/:postId/comments/:commentId/like', checkPermission('HOME', 'edit'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId).populate('channel', 'title isPrivate createdBy moderators subscribers');
        if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
        if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }
        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Kommentar nicht gefunden' });
        if (!comment.likes) comment.likes = [];
        const idx = comment.likes.indexOf(req.user._id);
        if (idx === -1) comment.likes.push(req.user._id);
        else comment.likes.splice(idx, 1);
        await post.save();
        searchService.upsertPostById(post._id).catch(() => { });
        res.json({ success: true, likes: comment.likes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wall/:id/comment', checkPermission('HOME', 'edit'), async (req, res) => {
    const post = await Post.findById(req.params.id).populate('channel', 'title isPrivate createdBy moderators subscribers');
    if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
    if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
        return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
    }
    const { content } = req.body;
    post.comments.push({ content, author: req.user._id });
    await post.save();
    searchService.upsertPostById(post._id).catch(() => { });

    // Notify author if it's not themselves
    if (post.author.toString() !== req.user._id.toString()) {
        notifyService.notifyUser(post.author, 'wall_comment', {
            title: 'Neuer Kommentar',
            message: `${req.user.firstName} hat deinen Beitrag kommentiert.`,
            link: `/wall/post/${post._id}`
        });
    }

    // Mentions (@username)
    const mentions = content.match(/@(\w+)/g);
    if (mentions) {
        const usernames = mentions.map(m => m.substring(1));
        const mentionedUsers = await User.find({ username: { $in: usernames } });
        for (const mu of mentionedUsers) {
            if (mu._id.toString() !== req.user._id.toString()) {
                notifyService.notifyUser(mu._id, 'wall_mention', {
                    title: 'Du wurdest erwähnt',
                    message: `${req.user.firstName} hat dich erwähnt.`,
                    link: `/wall/post/${post._id}`
                });
            }
        }
    }

    res.json(await Post.findById(post._id).populate('author', 'username firstName lastName optimizedProfileImage').populate('channel', 'title image optimizedImage isPrivate').populate('comments.author', 'username firstName lastName optimizedProfileImage'));
});

app.post('/api/wall', checkPermission('HOME', 'edit'), upload.array('images', 4), async (req, res) => {
    try {
        const { content, channelId } = req.body;
        let poll = null;
        if (req.body.poll) {
            poll = typeof req.body.poll === 'string' ? JSON.parse(req.body.poll) : req.body.poll;
            if (!poll?.question?.trim()) return res.status(400).json({ error: 'Umfragefrage fehlt.' });
            const options = Array.isArray(poll.options) ? poll.options.map((option) => ({ label: String(option.label || option).trim() })).filter((option) => option.label) : [];
            if (options.length < 2) return res.status(400).json({ error: 'Umfrage braucht mindestens 2 Optionen.' });
            poll = { question: poll.question.trim(), multiple: Boolean(poll.multiple), options, votes: [] };
        }
        if (!content && (!req.files || req.files.length === 0) && !poll) return res.status(400).json({ error: 'Leer' });
        let channel = null;
        if (channelId) {
            channel = await Channel.findById(channelId);
            if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden.' });
            if (!isChannelAccessibleForUser(channel, req.user)) {
                return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
            }
            if (channel.isPassive && !isChannelModeratorForUser(channel, req.user)) {
                return res.status(403).json({ error: 'Dieser Kanal ist passiv: Nur Moderatoren dürfen posten.' });
            }
        }

        const post = new Post({ content, author: req.user._id, channel: channel?._id, attachments: [], optimizedAttachments: [], poll });
        await post.save();
        searchService.upsertPostById(post._id).catch(() => { });
        if (req.files && req.files.length > 0) {
            post.attachments = await Promise.all(req.files.map((file, index) => saveImageBuffer({
                buffer: file.buffer,
                mimeType: file.mimetype,
                scope: 'wall',
                ownerId: post._id,
                variant: `original-${index}`
            })));
            req.files.forEach((file, index) => processImageAsync('POST', post._id, file.buffer, index));
        }
        const urlMatch = content.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            try {
                const preview = await getLinkPreview(urlMatch[0], { timeout: 3000 });
                if (preview && (preview.title || preview.description)) {
                    post.linkData = { url: urlMatch[0], title: preview.title || '', description: preview.description || '', image: preview.images?.[0] || null };
                    const yt = urlMatch[0].match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                    if (yt) { post.linkData.isYouTube = true; post.linkData.videoId = yt[1]; }
                }
            } catch (e) { }
        }
        await post.save();

        // Notify all users about new post (including the author for immediate feedback)
        notifyService.notifyMany({}, 'wall_new_post', {
            title: 'Neuer Beitrag auf der Wall',
            message: `${req.user.firstName} hat etwas gepostet: "${content ? (content.substring(0, 50) + (content.length > 50 ? '...' : '')) : 'Bild'}"`,
            link: '/'
        });

        res.json(await Post.findById(post._id).populate('author', 'username firstName lastName optimizedProfileImage').populate('channel', 'title image optimizedImage isPrivate'));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wall/:id/poll/vote', checkPermission('HOME', 'edit'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('channel', 'title isPrivate createdBy moderators subscribers');
        if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
        if (!post.poll?.options?.length) return res.status(400).json({ error: 'Keine Umfrage vorhanden.' });
        if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }

        const incomingOptionIds = Array.isArray(req.body.optionIds) ? req.body.optionIds.map((id) => String(id)) : [];
        if (incomingOptionIds.length === 0) return res.status(400).json({ error: 'Bitte mindestens eine Antwort wählen.' });
        if (!post.poll.multiple && incomingOptionIds.length > 1) return res.status(400).json({ error: 'Nur eine Antwort erlaubt.' });

        const validOptionIds = post.poll.options.map((option) => option._id.toString());
        const filteredOptionIds = [...new Set(incomingOptionIds)].filter((id) => validOptionIds.includes(id));
        if (filteredOptionIds.length === 0) return res.status(400).json({ error: 'Ungültige Antwortauswahl.' });

        const userId = req.user._id.toString();
        post.poll.votes = (post.poll.votes || []).filter((vote) => vote.user.toString() !== userId);
        filteredOptionIds.forEach((optionId) => {
            post.poll.votes.push({ optionId, user: req.user._id, createdAt: new Date() });
        });
        post.markModified('poll.votes');
        await post.save();
        searchService.upsertPostById(post._id).catch(() => { });
        res.json({ success: true, poll: post.poll });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/wall/:id/pin', checkPermission('HOME', 'edit'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('channel', 'title isPrivate createdBy moderators subscribers');
        if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
        if (!post.channel) return res.status(400).json({ error: 'Nur Kanal-Beiträge können angepinnt werden.' });
        if (!isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }
        if (!isChannelModeratorForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Nur Moderatoren können Beiträge anpinnen.' });
        }

        const shouldPin = req.body?.pinned !== false;
        post.pinned = shouldPin;
        post.pinnedAt = shouldPin ? new Date() : null;
        await post.save();
        searchService.upsertPostById(post._id).catch(() => { });
        res.json({ success: true, pinned: post.pinned, pinnedAt: post.pinnedAt });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/wall/:id', checkPermission('HOME', 'edit'), async (req, res) => {
    const post = await Post.findById(req.params.id).populate('channel', 'title isPrivate createdBy moderators subscribers');
    if (!post) return res.status(404).json({ error: 'Nicht gefunden' });
    if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
        return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
    }

    const isAdm = req.user.RoleIds.some(r => r.name === 'ADMIN');
    const isChannelModerator = post.channel ? isChannelModeratorForUser(post.channel, req.user) : false;
    const isAuthor = post.author.toString() === req.user._id.toString();

    if (!isAdm && !isAuthor && !isChannelModerator) return res.status(403).json({ error: 'Nicht autorisiert' });

    if (isAdm) {
        // Admin can fully remove any post.
        await Promise.all([...(post.attachments || []), ...(post.optimizedAttachments || [])].map((filePath) => deleteByPublicPath(filePath)));
        await Post.findByIdAndDelete(req.params.id);
        searchService.upsertPostById(req.params.id).catch(() => { });
        res.json({ success: true, deleted: true });
    } else if (isChannelModerator && !isAuthor) {
        // Channel moderators moderate foreign posts.
        await Promise.all([...(post.attachments || []), ...(post.optimizedAttachments || [])].map((filePath) => deleteByPublicPath(filePath)));
        post.content = 'Wurde von einem Moderator entfernt, da es gegen die Richtlinien verstößt.';
        post.attachments = [];
        post.optimizedAttachments = [];
        post.linkData = undefined;
        post.likes = [];
        post.comments = [];
        post.isModerated = true;
        await post.save();
        searchService.upsertPostById(post._id).catch(() => { });
        res.json({ success: true, moderated: true });
    } else {
        // Author deletes own post.
        await Promise.all([...(post.attachments || []), ...(post.optimizedAttachments || [])].map((filePath) => deleteByPublicPath(filePath)));
        await Post.findByIdAndDelete(req.params.id);
        searchService.upsertPostById(req.params.id).catch(() => { });
        res.json({ success: true, deleted: true });
    }
});

app.delete('/api/wall/:postId/comments/:commentId', checkPermission('HOME', 'edit'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId).populate('channel', 'title isPrivate createdBy moderators subscribers');
        if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
        if (post.channel && !isChannelAccessibleForUser(post.channel, req.user)) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Kanal.' });
        }

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Kommentar nicht gefunden' });

        const isAdm = req.user.RoleIds.some(r => r.name === 'ADMIN');
        const isAuthor = comment.author.toString() === req.user._id.toString();

        if (!isAdm && !isAuthor) return res.status(403).json({ error: 'Nicht autorisiert' });

        if (isAdm && !isAuthor) {
            // Admin moderates comment
            comment.content = 'Wurde von einem Moderator entfernt, da es gegen die Richtlinien verstößt.';
            comment.likes = [];
            comment.isModerated = true;
            await post.save();
            res.json({ success: true, moderated: true });
        } else {
            // Author deletes comment
            post.comments.pull({ _id: req.params.commentId });
            await post.save();
            res.json({ success: true, deleted: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- DIENSTPLANER ---
app.get('/api/plan', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => { try { res.json({ plan: await getPlan() }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/plan/:id/runsheet', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        const plan = await MusicPlan.findById(req.params.id).lean();
        if (!plan) return res.status(404).json({ error: 'Dienst nicht gefunden.' });
        const roleKeys = ['Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound', 'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'];
        const usernames = Array.from(new Set(
            roleKeys
                .map((key) => String(plan?.[key] || '').trim())
                .filter((value) => value && value !== '/' && value !== '?' && value !== '-')
        ));
        const users = usernames.length > 0
            ? await User.find({ username: { $in: usernames } }).select('username firstName lastName')
            : [];
        const usersByUsername = new Map(users.map((user) => [String(user.username), user]));
        const { buffer, fileName, mode } = await generateRunSheetBuffer({ plan, usersByUsername });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('X-RunSheet-Mode', mode || 'unknown');
        return res.send(buffer);
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Ablaufplan konnte nicht erstellt werden.' });
    }
});
app.post('/api/plan', checkPermission('MUSIC_PLANER', 'edit'), async (req, res) => {
    try {
        await addEntry(null, req.body.data);
        const latest = await MusicPlan.findOne({ Datum: req.body?.data?.Datum }).sort({ createdAt: -1 }).select('_id');
        if (latest?._id) searchService.upsertPlanById(latest._id).catch(() => { });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/plan/bulk-shells', checkPermission('MUSIC_PLANER', 'edit'), async (req, res) => {
    try {
        const from = String(req.body?.from || '').trim();
        const to = String(req.body?.to || '').trim();
        const overwriteExisting = Boolean(req.body?.overwriteExisting);
        const createModeRaw = String(req.body?.createMode || 'both').trim().toLowerCase();
        const createMode = ['both', 'service', 'bible'].includes(createModeRaw) ? createModeRaw : 'both';
        const includeServices = createMode === 'both' || createMode === 'service';
        const includeBible = createMode === 'both' || createMode === 'bible';
        const fromDate = parsePlanDateValue(from);
        const toDate = parsePlanDateValue(to);

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'Bitte gueltigen Zeitraum angeben (YYYY-MM-DD).' });
        }
        if (fromDate > toDate) {
            return res.status(400).json({ error: 'Startdatum muss vor Enddatum liegen.' });
        }

        const maxRangeDays = 730;
        const daySpan = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daySpan > maxRangeDays) {
            return res.status(400).json({ error: `Zeitraum zu gross. Maximal ${maxRangeDays} Tage erlaubt.` });
        }

        const existing = await MusicPlan.find({ Datum: { $gte: from, $lte: to } }).select('_id Datum').lean();
        const existingByDate = new Map();
        for (const entry of existing) {
            const key = String(entry.Datum || '');
            if (!existingByDate.has(key)) existingByDate.set(key, []);
            existingByDate.get(key).push(String(entry._id));
        }

        const docsToCreate = [];
        const updatesToApply = [];
        let skippedExisting = 0;
        let overwrittenCount = 0;
        let sundayCandidates = 0;
        let tuesdayCandidates = 0;
        const lockedMusicFields = {
            Anbetungsstunde: '/',
            Organisator: '/',
            Klavier: '/',
            Gitarre: '/',
            Bass: '/',
            Schlagzeug: '/',
            'Blockflöte': '/',
            Gesang1: '/',
            Gesang2: '/'
        };

        for (let cursor = new Date(fromDate); cursor <= toDate; cursor.setDate(cursor.getDate() + 1)) {
            const datum = formatDateYmdLocal(cursor);
            const dayOfWeek = cursor.getDay();

            if (dayOfWeek === 0 && includeServices) {
                sundayCandidates += 1;
                const lastSunday = isLastSundayOfMonth(cursor);
                const sundayDoc = {
                    Datum: datum,
                    Uhrzeit: lastSunday ? '10:30 Uhr' : '10:00 Uhr',
                    Typ: 'Gottesdienst',
                    Thema: '',
                    Predigt: '',
                    Leitung: '',
                    Anbetungsstunde: lastSunday ? '/' : '',
                    Organisator: '',
                    TechnikPC: '',
                    TechnikSound: '',
                    Klavier: '',
                    Gitarre: '',
                    Bass: '',
                    Schlagzeug: '',
                    'Blockflöte': '',
                    Gesang1: '',
                    Gesang2: '',
                    Probe: '',
                    Besonderes: lastSunday ? 'Integrierte Mahlfeier' : '',
                    tags: lastSunday ? ['Gottesdienst', 'Mahlfeier'] : ['Gottesdienst']
                };

                const existingIds = existingByDate.get(datum) || [];
                if (existingIds.length > 0) {
                    if (!overwriteExisting) {
                        skippedExisting += 1;
                        continue;
                    }
                    for (const id of existingIds) {
                        updatesToApply.push({
                            updateOne: {
                                filter: { _id: id },
                                update: { $set: sundayDoc }
                            }
                        });
                        overwrittenCount += 1;
                    }
                    continue;
                }

                docsToCreate.push(sundayDoc);
                existingByDate.set(datum, ['new']);
                continue;
            }

            if (dayOfWeek === 2 && includeBible) {
                tuesdayCandidates += 1;
                const tuesdayDoc = {
                    Datum: datum,
                    Uhrzeit: '19:30 Uhr',
                    Typ: 'Bibel- und Gebetsabend',
                    Thema: '',
                    Predigt: '',
                    Leitung: '/',
                    Anbetungsstunde: '/',
                    Organisator: '/',
                    TechnikPC: '/',
                    TechnikSound: '/',
                    Klavier: '/',
                    Gitarre: '/',
                    Bass: '/',
                    Schlagzeug: '/',
                    'Blockflöte': '/',
                    Gesang1: '/',
                    Gesang2: '/',
                    Probe: '',
                    Besonderes: '',
                    tags: ['Dienstag', 'Bibel & Gebet']
                };
                Object.assign(tuesdayDoc, lockedMusicFields);

                const existingIds = existingByDate.get(datum) || [];
                if (existingIds.length > 0) {
                    if (!overwriteExisting) {
                        skippedExisting += 1;
                        continue;
                    }
                    for (const id of existingIds) {
                        updatesToApply.push({
                            updateOne: {
                                filter: { _id: id },
                                update: { $set: tuesdayDoc }
                            }
                        });
                        overwrittenCount += 1;
                    }
                    continue;
                }

                docsToCreate.push(tuesdayDoc);
                existingByDate.set(datum, ['new']);
            }
        }

        let createdDocs = [];
        if (docsToCreate.length > 0) {
            createdDocs = await MusicPlan.insertMany(docsToCreate, { ordered: false });
        }
        if (updatesToApply.length > 0) {
            await MusicPlan.bulkWrite(updatesToApply, { ordered: false });
        }

        const reindexIds = [
            ...createdDocs.map((entry) => String(entry._id)),
            ...updatesToApply.map((op) => String(op.updateOne.filter._id))
        ];
        if (reindexIds.length > 0) {
            await Promise.allSettled(
                reindexIds.map((id) => searchService.upsertPlanById(id))
            );
        }

        return res.json({
            success: true,
            range: { from, to },
            createMode,
            candidates: sundayCandidates + tuesdayCandidates,
            sundayCandidates,
            tuesdayCandidates,
            createdCount: docsToCreate.length,
            overwrittenCount,
            skippedExisting,
            overwriteExisting
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
app.put('/api/plan/:id', checkPermission('MUSIC_PLANER', 'edit'), async (req, res) => {
    try {
        await updateEntry(null, req.params.id, req.body.data);
        searchService.upsertPlanById(req.params.id).catch(() => { });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/plan/:id/topic', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const plan = await MusicPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

        const hasPlanEdit = await userHasAnyToolPermission(req.user, 'MUSIC_PLANER', 'edit');
        const isAssignedPreacher = plan.Predigt && plan.Predigt === req.user.username;
        if (!hasPlanEdit && !isAssignedPreacher) {
            return res.status(403).json({ error: 'Nur Prediger oder Admin können das Thema bearbeiten.' });
        }

        const Thema = String(req.body?.Thema || '').trim();
        plan.Thema = Thema;
        await plan.save();
        searchService.upsertPlanById(plan._id).catch(() => { });
        res.json({ success: true, Thema });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/plan/:id/probe-settings', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const plan = await MusicPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

        const hasPlanEdit = await userHasAnyToolPermission(req.user, 'MUSIC_PLANER', 'edit');
        const username = String(req.user.username || '').trim();
        const isAssignedInPlan = PLAN_SLOT_ROLE_KEYS.some((roleKey) => String(plan[roleKey] || '').trim() === username);
        if (!hasPlanEdit && !isAssignedInPlan) {
            return res.status(403).json({ error: 'Nur eingetragene Personen oder Admin können Probeinfos verwalten.' });
        }

        const probeRaw = req.body?.probe;
        if (probeRaw === '' || probeRaw === null) {
            plan.Probe = '';
        } else if (probeRaw !== undefined) {
            const nextDate = new Date(String(probeRaw));
            if (Number.isNaN(nextDate.getTime())) return res.status(400).json({ error: 'Ungültige Probezeit.' });
            plan.Probe = nextDate.toISOString();
        }

        if (req.body?.probePollOptions !== undefined) {
            const rawOptions = Array.isArray(req.body.probePollOptions) ? req.body.probePollOptions : [];
            const cleaned = rawOptions
                .map((item) => String(item || '').trim())
                .filter((item) => item.length > 0)
                .slice(0, 8);
            plan.probePollOptions = cleaned;
        }

        await plan.save();
        searchService.upsertPlanById(plan._id).catch(() => { });
        res.json({ success: true, Probe: plan.Probe || '', probePollOptions: plan.probePollOptions || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const normalizeSongsForPlan = (rawSongs = []) => (
    (Array.isArray(rawSongs) ? rawSongs : [])
        .map((song) => ({
            number: String(song?.number || '').trim(),
            title: String(song?.title || '').trim(),
            sourceUrl: String(song?.sourceUrl || '').trim()
        }))
        .filter((song) => song.number || song.title)
        .slice(0, 20)
);

app.patch('/api/plan/:id/songs', authMiddleware, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const plan = await MusicPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

        const hasPlanEdit = await userHasAnyToolPermission(req.user, 'MUSIC_PLANER', 'edit');
        const username = String(req.user.username || '').trim();
        const isAssignedInPlan = PLAN_SLOT_ROLE_KEYS.some((roleKey) => String(plan[roleKey] || '').trim() === username);
        if (!hasPlanEdit && !isAssignedInPlan) {
            return res.status(403).json({ error: 'Nur eingetragene Personen oder Admin können Lieder verwalten.' });
        }

        const songs = normalizeSongsForPlan(req.body?.songs);
        plan.songs = songs;
        await plan.save();
        await upsertSongsToCatalog(songs);
        searchService.upsertPlanById(plan._id).catch(() => { });
        res.json({ success: true, songs: plan.songs || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/plan/:id', checkPermission('MUSIC_PLANER', 'edit'), async (req, res) => {
    try {
        const id = req.params.id;
        await MusicPlan.findByIdAndDelete(id);
        searchService.upsertPlanById(id).catch(() => { });
        logActivity(req, 'DELETE_PLAN_ENTRY', 'MUSIC_PLANER', { id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- JOBS API ---
app.use('/api/jobs', jobRoutes);

// --- LOGS ---
app.get('/api/activity-logs', checkPermission('ACTIVITY_LOGS', 'view'), async (req, res) => { const { page = 1, limit = 50, search } = req.query; const query = {}; if (search) query.$or = [{ ip: new RegExp(search, 'i') }, { path: new RegExp(search, 'i') }, { action: new RegExp(search, 'i') }]; const total = await ActivityLog.countDocuments(query); res.json({ total, page: parseInt(page), pages: Math.ceil(total / limit), logs: await ActivityLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).populate({ path: 'UserId', select: 'username firstName lastName' }) }); });
app.get('/api/system-logs', checkPermission('ACTIVITY_LOGS', 'view'), async (req, res) => { res.json(await SystemLog.find().sort({ createdAt: -1 }).limit(100)); });

app.get('/api/whatsapp/logs', isAdmin, async (req, res) => {
    try {
        const logs = await WhatsAppLog.find().sort({ createdAt: -1 }).limit(100);
        res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/debug-send-logs', isAdmin, async (req, res) => {
    try {
        const {
            messageId = '',
            event = '',
            level = '',
            jid = '',
            input = '',
            from = '',
            to = '',
            limit = '100'
        } = req.query || {};

        const parsedLimit = Number.parseInt(String(limit), 10);
        const safeLimit = Number.isFinite(parsedLimit)
            ? Math.max(1, Math.min(parsedLimit, 500))
            : 100;

        const query = { type: 'send' };
        const normalizedMessageId = String(messageId || '').trim();
        const normalizedEvent = String(event || '').trim();
        const normalizedLevel = String(level || '').trim();
        const normalizedJid = String(jid || '').trim();
        const normalizedInput = String(input || '').trim();

        if (normalizedMessageId) query['details.messageId'] = normalizedMessageId;
        if (normalizedEvent) query.event = normalizedEvent;
        if (normalizedLevel) query.level = normalizedLevel;
        if (normalizedJid) query['details.jid'] = normalizedJid;
        if (normalizedInput) query['details.input'] = normalizedInput;

        const fromDate = from ? new Date(String(from)) : null;
        const toDate = to ? new Date(String(to)) : null;
        if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
            return res.status(400).json({ error: 'Ungültiger Zeitraum. Bitte ISO-Datum für from/to verwenden.' });
        }
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = fromDate;
            if (toDate) query.createdAt.$lte = toDate;
        }

        const [total, logs] = await Promise.all([
            WhatsAppLog.countDocuments(query),
            WhatsAppLog.find(query).sort({ createdAt: -1 }).limit(safeLimit)
        ]);

        res.json({
            total,
            limit: safeLimit,
            filters: {
                messageId: normalizedMessageId,
                event: normalizedEvent,
                level: normalizedLevel,
                jid: normalizedJid,
                input: normalizedInput,
                from: fromDate ? fromDate.toISOString() : '',
                to: toDate ? toDate.toISOString() : ''
            },
            logs
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/whatsapp/stats', isAdmin, async (req, res) => {
    try {
        const totalLogs = await WhatsAppLog.countDocuments();
        const errors = await WhatsAppLog.countDocuments({ level: 'error' });
        const disconnects = await WhatsAppLog.countDocuments({ event: 'disconnected' });
        const lastConnect = await WhatsAppLog.findOne({ event: 'connected' }).sort({ createdAt: -1 });

        res.json({
            totalLogs,
            errors,
            disconnects,
            lastConnectedAt: lastConnect?.createdAt || null
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- QUICK ASSIGN API (Authenticated) ---
const buildAssignInfoPayload = async (plan, viewerUser, { lockedRoleKey = '' } = {}) => {
    const viewerEntries = upsertPlanViewer(plan._id, viewerUser);
    const assignedUsernames = PLAN_SLOT_DEFINITIONS
        .map((slot) => String(plan[slot.roleKey] || '').trim())
        .filter((username) => username && username !== '/' && username !== '?' && username !== '-');
    const uniqueAssigned = Array.from(new Set(assignedUsernames));
    const assignedUsers = uniqueAssigned.length > 0
        ? await User.find({ username: { $in: uniqueAssigned } }).select('username firstName lastName profileImage')
        : [];
    const assignedByUsername = new Map(assignedUsers.map((u) => [u.username, u]));

    const slots = PLAN_SLOT_DEFINITIONS.map((slot) => {
        const raw = String(plan[slot.roleKey] || '').trim();
        const blocked = raw === '/';
        const open = isPlanSlotOpen(raw);
        const assignedUser = !open && !blocked ? assignedByUsername.get(raw) : null;
        return {
            roleKey: slot.roleKey,
            label: slot.label,
            blocked,
            open,
            assignedUsername: !open && !blocked ? raw : '',
            assignedName: assignedUser ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() : (!open && !blocked ? raw : ''),
            assignedProfileImage: assignedUser?.profileImage || ''
        };
    });

    const filteredSlots = lockedRoleKey ? slots.filter((slot) => slot.roleKey === lockedRoleKey) : slots;
    return {
        plan,
        slots: filteredSlots,
        lockedRoleKey,
        viewers: viewerEntries.map((viewer) => ({
            userId: viewer.userId,
            username: viewer.username,
            firstName: viewer.firstName,
            lastName: viewer.lastName,
            profileImage: viewer.profileImage,
            lastSeen: new Date(viewer.seenAt).toISOString()
        }))
    };
};

const assignRoleToPlan = async ({ plan, user, roleKey, action = 'assign' }) => {
    const currentAssignee = String(plan[roleKey] || '').trim();
    if (currentAssignee === '/') {
        return { ok: false, status: 409, error: 'Dieser Dienst ist für den Termin deaktiviert.' };
    }

    if (action === 'unassign') {
        if (currentAssignee !== user.username) {
            return { ok: false, status: 403, error: 'Du kannst nur deinen eigenen Eintrag rückgängig machen.' };
        }
        plan[roleKey] = '';
        await plan.save();
        searchService.upsertPlanById(plan._id).catch(() => { });
        upsertPlanViewer(plan._id, user);
        return { ok: true, payload: { success: true, roleKey, username: user.username, action: 'unassign' } };
    }

    if (!isPlanSlotOpen(currentAssignee)) {
        const assignedUser = await User.findOne({ username: currentAssignee }).select('firstName lastName username');
        const assignedName = assignedUser ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() : currentAssignee;
        return { ok: false, status: 409, error: `Dienst bereits vergeben an ${assignedName}` };
    }

    plan[roleKey] = user.username;
    await plan.save();
    searchService.upsertPlanById(plan._id).catch(() => { });
    upsertPlanViewer(plan._id, user);
    return { ok: true, payload: { success: true, roleKey, username: user.username } };
};

app.get('/api/assign/info/plan/:planId', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const planId = String(req.params.planId || '').trim();
        if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ error: 'Ungültige Plan-ID' });
        }
        const plan = await MusicPlan.findById(planId);
        if (!plan) return res.status(404).json({ error: 'Termin nicht gefunden' });
        const payload = await buildAssignInfoPayload(plan, req.user);
        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/assign/plan/:planId', checkPermission('MUSIC_PLANER', 'view'), requirePermission('assign_music_plan_role'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const planId = String(req.params.planId || '').trim();
        if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ error: 'Ungültige Plan-ID' });
        }
        const plan = await MusicPlan.findById(planId);
        if (!plan) return res.status(404).json({ error: 'Nicht gefunden' });

        const roleKey = String(req.body?.roleKey || '').trim();
        const requestedAction = String(req.body?.action || 'assign').trim().toLowerCase();
        if (!PLAN_SLOT_ROLE_KEYS.includes(roleKey)) return res.status(400).json({ error: 'Ungültige Rolle' });

        const result = await assignRoleToPlan({ plan, user: req.user, roleKey, action: requestedAction });
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        return res.json(result.payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/assign/presence/plan/:planId', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const planId = String(req.params.planId || '').trim();
        if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ error: 'Ungültige Plan-ID' });
        }
        const plan = await MusicPlan.findById(planId).select('_id');
        if (!plan) return res.status(404).json({ error: 'Termin nicht gefunden' });
        const viewerEntries = upsertPlanViewer(plan._id, req.user);
        res.json({
            success: true,
            viewers: viewerEntries.map((viewer) => ({
                userId: viewer.userId,
                username: viewer.username,
                firstName: viewer.firstName,
                lastName: viewer.lastName,
                profileImage: viewer.profileImage,
                lastSeen: new Date(viewer.seenAt).toISOString()
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Legacy token endpoints for backward compatibility
app.get('/api/assign/info/:token', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });

        const t = await QuickAssignToken.findOne({ token: req.params.token });
        if (!t) return res.status(404).json({ error: 'Link ungültig' });
        if (t.expiresAt < new Date()) return res.status(410).json({ error: 'Link abgelaufen' });
        if (t.roleKey && t.used) return res.status(410).json({ error: 'Link bereits verwendet' });

        const plan = await MusicPlan.findById(t.planId);
        if (!plan) return res.status(404).json({ error: 'Termin nicht gefunden' });

        const requestedRole = String(t.roleKey || '').trim();
        const lockedRoleKey = requestedRole && PLAN_SLOT_ROLE_KEYS.includes(requestedRole) ? requestedRole : '';
        const payload = await buildAssignInfoPayload(plan, req.user, { lockedRoleKey });
        res.json(payload);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assign/:token', checkPermission('MUSIC_PLANER', 'view'), requirePermission('assign_music_plan_role'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });

        const t = await QuickAssignToken.findOne({ token: req.params.token });
        if (!t || t.expiresAt < new Date()) return res.status(410).json({ error: 'Link abgelaufen' });
        if (t.roleKey && t.used) return res.status(410).json({ error: 'Link bereits verwendet' });
        const plan = await MusicPlan.findById(t.planId);
        if (!plan) return res.status(404).json({ error: 'Nicht gefunden' });

        const tokenRoleKey = String(t.roleKey || '').trim();
        const requestedRoleKey = String(req.body?.roleKey || '').trim();
        const requestedAction = String(req.body?.action || 'assign').trim().toLowerCase();
        const roleKey = tokenRoleKey && PLAN_SLOT_ROLE_KEYS.includes(tokenRoleKey) ? tokenRoleKey : requestedRoleKey;
        if (!PLAN_SLOT_ROLE_KEYS.includes(roleKey)) return res.status(400).json({ error: 'Ungültige Rolle' });
        const result = await assignRoleToPlan({ plan, user: req.user, roleKey, action: requestedAction });
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        if (tokenRoleKey && requestedAction !== 'unassign') {
            t.used = true;
            await t.save();
        }
        res.json(result.payload);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assign/presence/:token', checkPermission('MUSIC_PLANER', 'view'), async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const t = await QuickAssignToken.findOne({ token: req.params.token });
        if (!t || t.expiresAt < new Date()) return res.status(410).json({ error: 'Link abgelaufen' });
        const plan = await MusicPlan.findById(t.planId).select('_id');
        if (!plan) return res.status(404).json({ error: 'Termin nicht gefunden' });
        const viewerEntries = upsertPlanViewer(plan._id, req.user);
        res.json({
            success: true,
            viewers: viewerEntries.map((viewer) => ({
                userId: viewer.userId,
                username: viewer.username,
                firstName: viewer.firstName,
                lastName: viewer.lastName,
                profileImage: viewer.profileImage,
                lastSeen: new Date(viewer.seenAt).toISOString()
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/a/:token', (req, res) => { res.redirect(`/assign/${req.params.token}`); });

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error('ðŸ”¥ Server Error:', err.message);
    res.status(500).json({
        error: 'Interner Serverfehler',
        message: process.env.NODE_ENV === 'production' ? 'Ein unerwarteter Fehler ist aufgetreten.' : err.message
    });
});

// --- SERVE FRONTEND ---
app.use('/uploads', express.static(getUploadsRoot(), {
    maxAge: '30d',
    immutable: true
}));
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/dist/index.html')); });
