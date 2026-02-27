import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User, Role, IPBan, GlobalSetting, RefreshSession } from './db.service.js';
import {
    hasPermission,
    mapToolPermissionToPermissionKey,
    canManageTeamScope,
    canRequestSubstituteScope
} from './authorization.service.js';

let PERSISTED_JWT_SECRET = process.env.JWT_SECRET;

const ACCESS_TOKEN_COOKIE = 'auth_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '30m';
const REFRESH_TOKEN_DAYS = Math.max(1, Number.parseInt(process.env.REFRESH_TOKEN_DAYS || '60', 10) || 60);
const REFRESH_ROTATION_GRACE_MS = Math.max(1000, Number.parseInt(process.env.REFRESH_ROTATION_GRACE_MS || '15000', 10) || 15000);

const parseBooleanEnv = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
};

const resolveSameSite = () => {
    const raw = String(process.env.COOKIE_SAMESITE || 'lax').trim().toLowerCase();
    if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
    return 'lax';
};

const getCookieBaseOptions = (req) => {
    const isHttps = req.secure || req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
    const forcedSecure = parseBooleanEnv(process.env.COOKIE_SECURE);
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    return {
        httpOnly: true,
        secure: forcedSecure === null ? (isProd ? true : Boolean(isHttps)) : forcedSecure,
        sameSite: resolveSameSite(),
        path: '/'
    };
};

const hashToken = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const uniqueStrings = (values) => Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean)));

const buildUserAuthClaims = (user, extraClaims = {}) => {
    const roleNames = uniqueStrings((user?.RoleIds || []).map((role) => role?.name).map((name) => String(name || '').toUpperCase()));
    const permissionKeys = uniqueStrings((user?.RoleIds || []).flatMap((role) => role?.permissionKeys || []));
    return {
        id: String(user?.id || user?._id || ''),
        roles: roleNames,
        permissionKeys,
        ...extraClaims
    };
};

export const getJwtSecret = async () => {
    if (PERSISTED_JWT_SECRET) return PERSISTED_JWT_SECRET;
    try {
        const setting = await GlobalSetting.findOne({ key: 'jwt_secret_persistent' });
        if (setting?.value) {
            PERSISTED_JWT_SECRET = setting.value;
            return PERSISTED_JWT_SECRET;
        }
        const newSecret = crypto.randomBytes(64).toString('hex');
        await GlobalSetting.findOneAndUpdate(
            { key: 'jwt_secret_persistent' },
            { value: newSecret },
            { upsert: true }
        );
        PERSISTED_JWT_SECRET = newSecret;
        return PERSISTED_JWT_SECRET;
    } catch (_e) {
        const envSecret = process.env.JWT_SECRET;
        if (envSecret) return envSecret;
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT secret is missing. Set JWT_SECRET or ensure GlobalSetting jwt_secret_persistent is readable.');
        }
        throw new Error('JWT secret is missing in non-production environment.');
    }
};

const signAccessToken = async (claims, expiresIn = ACCESS_TOKEN_TTL) => {
    const secret = await getJwtSecret();
    return jwt.sign(
        {
            ...claims,
            typ: 'access'
        },
        secret,
        { expiresIn, algorithm: 'HS256' }
    );
};

// Legacy helper for tests/compat.
export const generateToken = async (user, expiresIn = ACCESS_TOKEN_TTL, extraClaims = {}) => {
    const claims = buildUserAuthClaims(user, extraClaims);
    return signAccessToken(claims, expiresIn);
};

const setAuthCookies = (req, res, { accessToken, refreshToken }) => {
    const base = getCookieBaseOptions(req);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        ...base,
        maxAge: 30 * 60 * 1000
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        ...base,
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    });
};

export const clearAuthCookies = (req, res) => {
    const base = getCookieBaseOptions(req);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base });
};

const createRefreshSession = async ({ user, sessionClaims = {}, req }) => {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await RefreshSession.create({
        tokenHash,
        UserId: user._id,
        expiresAt,
        sessionClaims,
        createdAt: new Date(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    return { refreshToken, tokenHash, expiresAt };
};

const revokeRefreshByRawToken = async (rawToken, { replacedByHash = null } = {}) => {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await RefreshSession.findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date(), ...(replacedByHash ? { replacedByHash } : {}) }
    );
};

export const issueAuthSession = async (req, res, user, { extraClaims = {}, rotateFromRequest = true } = {}) => {
    const sessionClaims = { ...extraClaims };
    const claims = buildUserAuthClaims(user, sessionClaims);
    const accessToken = await signAccessToken(claims, ACCESS_TOKEN_TTL);
    const { refreshToken, tokenHash } = await createRefreshSession({ user, sessionClaims, req });
    if (rotateFromRequest) {
        await revokeRefreshByRawToken(req.cookies?.[REFRESH_TOKEN_COOKIE], { replacedByHash: tokenHash });
    }
    setAuthCookies(req, res, { accessToken, refreshToken });
    return { accessToken };
};

const hydrateUserFromClaims = async (claims) => {
    if (!claims?.id) return null;
    const user = await User.findById(claims.id).populate('RoleIds');
    if (!user) return null;
    const realRoles = Array.isArray(user.RoleIds) ? [...user.RoleIds] : [];
    const isRealAdmin = realRoles.some((role) => role.name === 'ADMIN');
    if (claims.asRole && isRealAdmin) {
        const actingRole = await Role.findOne({ name: String(claims.asRole).toUpperCase() });
        if (actingRole) {
            user.__realRoles = realRoles;
            user.__isRolePreview = true;
            user.__actingRole = actingRole.name;
            user.__canRoleSwitch = Boolean(claims.rolePreviewAdmin);
            user.RoleIds = [actingRole];
            return user;
        }
    }
    user.__realRoles = realRoles;
    user.__isRolePreview = false;
    user.__actingRole = null;
    user.__canRoleSwitch = isRealAdmin;
    return user;
};

const tryRefreshSession = async (req, res) => {
    const rawRefresh = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawRefresh) return null;
    const tokenHash = hashToken(rawRefresh);
    const now = new Date();
    let session = await RefreshSession.findOne({
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: now }
    });

    // Handle parallel refresh requests (common after mobile resume):
    // if token was just rotated by another request, accept its replacement.
    if (!session) {
        const graceSince = new Date(Date.now() - REFRESH_ROTATION_GRACE_MS);
        const recentlyRotated = await RefreshSession.findOne({
            tokenHash,
            revokedAt: { $gte: graceSince },
            replacedByHash: { $exists: true, $ne: null }
        });
        if (recentlyRotated?.replacedByHash) {
            session = await RefreshSession.findOne({
                tokenHash: recentlyRotated.replacedByHash,
                revokedAt: null,
                expiresAt: { $gt: now }
            });
        }
    }

    if (!session) return null;
    const user = await User.findById(session.UserId).populate('RoleIds');
    if (!user) return null;
    const extraClaims = session.sessionClaims || {};
    const claims = buildUserAuthClaims(user, extraClaims);
    const accessToken = await signAccessToken(claims, ACCESS_TOKEN_TTL);
    const rotated = await createRefreshSession({ user, sessionClaims: extraClaims, req });
    session.revokedAt = new Date();
    session.replacedByHash = rotated.tokenHash;
    await session.save();
    setAuthCookies(req, res, { accessToken, refreshToken: rotated.refreshToken });
    return claims;
};

export const ipBanMiddleware = async (req, res, next) => {
    if (process.env.NODE_ENV === 'development') return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const normalizedIp = Array.isArray(ip) ? ip[0] : String(ip || '').split(',')[0].trim();
    const isLocalIp = normalizedIp === '127.0.0.1' || normalizedIp === '::1' || normalizedIp === '::ffff:127.0.0.1';
    if (isLocalIp) return next();

    try {
        const ban = await IPBan.findOne({ ip: normalizedIp });
        if (ban) {
            if (ban.expiresAt && ban.expiresAt < new Date()) {
                await IPBan.deleteOne({ _id: ban._id });
                return next();
            }
            return res.status(403).json({
                error: 'Zugriff verweigert',
                message: `Deine IP (${normalizedIp}) wurde aufgrund von verdächtigen Aktivitäten gesperrt. Grund: ${ban.reason}`,
                banned: true
            });
        }
        next();
    } catch (_e) { next(); }
};

export const authMiddleware = async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        req.user = null;
        return next();
    }

    let token = req.cookies?.[ACCESS_TOKEN_COOKIE] || null;
    const authHeader = req.headers.authorization;
    if (!token && authHeader) {
        token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    }

    try {
        let claims = null;
        if (token) {
            const secret = await getJwtSecret();
            claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
        }
        if (!claims || claims.typ !== 'access') {
            claims = await tryRefreshSession(req, res);
        }
        if (!claims?.id) {
            req.user = null;
            req.authClaims = null;
            return next();
        }
        req.authClaims = claims;
        const user = await hydrateUserFromClaims(claims);
        req.user = user || null;
        return next();
    } catch (_e) {
        try {
            const refreshedClaims = await tryRefreshSession(req, res);
            if (!refreshedClaims?.id) {
                req.user = null;
                req.authClaims = null;
                return next();
            }
            req.authClaims = refreshedClaims;
            req.user = await hydrateUserFromClaims(refreshedClaims);
            return next();
        } catch (_inner) {
            req.user = null;
            req.authClaims = null;
            return next();
        }
    }
};

export const checkPermission = (toolKey, type = 'view') => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });

        const hasAdminRole = req.user.RoleIds?.some((r) => r.name === 'ADMIN');
        if (hasAdminRole) return next();

        const mappedPermission = mapToolPermissionToPermissionKey(toolKey, type);
        if (!mappedPermission) return res.status(500).json({ error: `Keine Permission-Mappingregel fuer ${toolKey}:${type}` });
        if (hasPermission(req.user, mappedPermission)) return next();
        return res.status(403).json({ error: 'Keine Berechtigung' });
    };
};

export const isAdmin = async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
    const roles = req.user.RoleIds || [];
    const hasAdminRole = roles.some((r) => r.name === 'ADMIN') || hasPermission(req.user, 'admin_access');
    if (hasAdminRole) return next();
    return res.status(403).json({ error: 'Nur Administratoren' });
};

export const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        if (!hasPermission(req.user, permissionKey)) {
            return res.status(403).json({ error: 'Keine Berechtigung' });
        }
        return next();
    };
};

export const checkScope = (policyKey, resolver) => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Login erforderlich' });
        const context = typeof resolver === 'function' ? await resolver(req) : {};
        if (policyKey === 'TEAM_MODERATOR_OR_ADMIN') {
            if (canManageTeamScope(req.user, context.team)) return next();
            return res.status(403).json({ error: 'Keine Berechtigung fuer dieses Team.' });
        }
        if (policyKey === 'PLAN_ASSIGNED_OR_ADMIN') {
            if (canRequestSubstituteScope({
                user: req.user,
                plan: context.plan,
                roleKey: context.roleKey,
                allowOnlyAssignedRequester: context.allowOnlyAssignedRequester !== false
            })) return next();
            return res.status(403).json({ error: 'Keine Berechtigung fuer diesen Dienst.' });
        }
        return res.status(500).json({ error: 'Unbekannte Scope-Policy.' });
    };
};

export const logoutCurrentSession = async (req, res) => {
    await revokeRefreshByRawToken(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    clearAuthCookies(req, res);
};
