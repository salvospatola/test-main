import { ActivityLog, SystemLog, ThreatLog, IPBan, SystemStat } from './db.service.js';
import notifyService from './notify.service.js';
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

const presenceCache = new NodeCache({ stdTTL: 60, checkperiod: 10 });

// Original console methods
const originalLog = console.log;
const originalError = console.error;

// Capture console logs
console.log = function(...args) {
    originalLog.apply(console, args);
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    // Filter out some noise if needed
    if (!message.includes('Mongoose')) { 
       SystemLog.create({ source: 'CONTAINER_STDOUT', message, level: 'INFO' }).catch(() => {});
    }
};

console.error = function(...args) {
    originalError.apply(console, args);
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    SystemLog.create({ source: 'CONTAINER_STDERR', message, level: 'ERROR' }).catch(() => {});
};

export const logActivity = async (req, action, params = null) => {
    try {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
        const requestPath = req.path || String(req.originalUrl || '').split('?')[0];
        const isDevApiPath = /^\/api\/dev(\/|$)/i.test(requestPath);
        
        await ActivityLog.create({
            ip,
            method: req.method,
            path: req.originalUrl,
            action: action,
            params: params || (isMultipart ? { message: '[File Upload Content Hidden]' } : req.body),
            userAgent,
            UserId: req.user ? req.user._id : null
        });

        // Detect Threats
        const isExploit = /\.(env|git|php|jsp|yml|sql|bak|db)$/i.test(req.originalUrl);
        const isAdminProbe = /\/admin(\/|$)/i.test(requestPath) && !req.user && !isDevApiPath;
        const isFailedLogin = /FAILED_LOGIN/i.test(action);

        if (isExploit || isAdminProbe || isFailedLogin) {
            const threatReason = isExploit ? 'Exploit Scan' : isAdminProbe ? 'Unauthorized Admin Probe' : 'Brute Force Attempt';
            
            // Intelligence Gathering
            const geo = geoip.lookup(ip) || {};
            const parser = new UAParser(userAgent);
            const ua = parser.getResult();
            
            // Bot Estimation
            const isBot = /bot|spider|crawler|scanner|headless/i.test(userAgent) || !ua.browser.name;

            await ThreatLog.findOneAndUpdate(
                { ip, action, path: req.originalUrl },
                {
                    $inc: { count: 1 },
                    severity: isExploit ? 'HIGH' : 'MEDIUM',
                    method: req.method,
                    userAgent,
                    details: params || (isMultipart ? { message: '[File Upload Content Hidden]' } : req.body),
                    geo: {
                        country: geo.country,
                        city: geo.city,
                        region: geo.region,
                        ll: geo.ll
                    },
                    client: {
                        os: `${ua.os.name || ''} ${ua.os.version || ''}`.trim() || 'Unknown',
                        browser: `${ua.browser.name || ''} ${ua.browser.version || ''}`.trim() || 'Unknown',
                        device: `${ua.device.vendor || ''} ${ua.device.model || ''}`.trim() || (isBot ? 'Bot/Scanner' : 'Desktop'),
                        isBot
                    }
                },
                { upsert: true }
            );

            // Automatic Banning Logic
            const threatCount = await ThreatLog.countDocuments({ ip, createdAt: { $gt: new Date(Date.now() - 3600000) } });
            
            // Sofortiger Ban für Nicht-DE IPs bei Exploits/Admin-Probes
            const isNonGermanThreat = geo.country && geo.country !== 'DE' && (isExploit || isAdminProbe);
            
            if (threatCount >= 5 || isNonGermanThreat) {
                const banReason = isNonGermanThreat 
                    ? `Geoblocking-Schutz: Verdächtige Aktivität (${threatReason}) aus dem Ausland (${geo.country || 'Unbekannt'})`
                    : `Automatischer Schutz: Mehrfache verdächtige Anfragen (${threatReason})`;

                await IPBan.findOneAndUpdate(
                    { ip },
                    { 
                        reason: banReason,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h Ban
                        $inc: { attempts: 1 }
                    },
                    { upsert: true }
                );
                originalLog(`🚫 IP BANNED automatically: ${ip} (Reason: ${banReason})`);
                
                notifyService.notifyAdmins('security_alert', {
                    title: '🚨 IP Automatisch Gebannt',
                    message: `Die IP ${ip} wurde gebannt. Grund: ${banReason}`,
                    link: '/admin/security'
                });
            }
        }
    } catch (e) {
        originalError('Logging activity failed:', e.message);
    }
};

let lastAdminAlert = 0;

export const logSystem = async (source, message, level = 'INFO', details = null) => {
    try {
        const timestamp = new Date().toISOString();
        originalLog(`[${timestamp}] [${level}] [${source}] ${message}`);
        await SystemLog.create({ source, message, level, details });

        // Admin Benachrichtigung bei Fehlern (mit 5 Min Rate-Limit gegen Loops)
        if (level === 'ERROR' && (Date.now() - lastAdminAlert > 5 * 60 * 1000)) {
            lastAdminAlert = Date.now();
            notifyService.notifyAdmins('system_critical', {
                title: '❌ System Fehler',
                message: `[${source}] ${message}`,
                link: '/admin/activity'
            });
        }
    } catch (e) {
        originalError('Logging system failed:', e.message);
    }
};

export const activityMiddleware = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const action = `API_${req.method}_${req.path.replace(/\//g, '_').toUpperCase()}`;
        logActivity(req, action).catch(() => {});
        
        // Track Presence on every API call
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const key = req.user ? `user:${req.user._id}` : `guest:${ip}`;
        presenceCache.set(key, { 
            lastSeen: Date.now(), 
            username: req.user?.username || 'Nicht eingeloggt',
            role: req.user?.RoleIds?.[0]?.name || 'ANONYMOUS'
        });
    }
    next();
};

export const getLiveStats = () => {
    const keys = presenceCache.keys();
    return {
        total: keys.length,
        users: keys.filter(k => k.startsWith('user:')).length,
        guests: keys.filter(k => k.startsWith('guest:')).length
    };
};

export const getActiveUserCount = async (minutes = 15) => {
    try {
        const since = new Date(Date.now() - minutes * 60 * 1000);
        const active = await ActivityLog.distinct('UserId', { 
            createdAt: { $gt: since },
            UserId: { $ne: null }
        });
        return active.length;
    } catch (e) { return 0; }
};

export const cleanupLogs = async () => {
    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        
        // Cleanup ActivityLogs (Keep for 1 Year)
        await ActivityLog.deleteMany({ createdAt: { $lt: oneYearAgo } });

        // Cleanup ThreatLogs (Keep for 2 Years)
        await ThreatLog.deleteMany({ createdAt: { $lt: twoYearsAgo } });

        // Cleanup SystemStats (Keep for 5 Years)
        await SystemStat.deleteMany({ timestamp: { $lt: fiveYearsAgo } });
        
        // Cleanup SystemLogs (keep only 14 days for heavy debugging logs)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        await SystemLog.deleteMany({ createdAt: { $lt: fourteenDaysAgo } });

        // Cap SystemLogs at 50,000 entries regardless of age
        const totalSysLogs = await SystemLog.countDocuments();
        if (totalSysLogs > 50000) {
            const oldest = await SystemLog.find().sort({ createdAt: 1 }).limit(10000).select('_id');
            await SystemLog.deleteMany({ _id: { $in: oldest.map(l => l._id) } });
        }
    } catch (e) {
        console.error('Cleanup failed:', e.message);
    }
};
