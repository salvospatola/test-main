export const PERMISSION_CATALOG = [
    { key: 'admin_access', label: 'System-Admin', group: 'Administration', description: 'Voller Zugriff auf administrative Funktionen.' },
    { key: 'view_home', label: 'Wall lesen', group: 'Gemeinschaft', description: 'Darf die Wall und Kanaele ansehen.' },
    { key: 'edit_home', label: 'Wall schreiben', group: 'Gemeinschaft', description: 'Darf auf der Wall erstellen, kommentieren und interagieren.' },
    { key: 'view_music_plan', label: 'Dienstplan lesen', group: 'Dienstplan', description: 'Darf den Dienstplan ansehen.' },
    { key: 'edit_music_plan', label: 'Dienstplan bearbeiten', group: 'Dienstplan', description: 'Darf den gesamten Dienstplan administrativ bearbeiten.' },
    { key: 'assign_music_plan_role', label: 'Dienste eintragen', group: 'Dienstplan', description: 'Darf sich in offene Rollen eintragen oder austragen.' },
    { key: 'request_substitute', label: 'Vertretung anfragen', group: 'Dienstplan', description: 'Darf Vertretung fuer einen Dienst anfragen.' },
    { key: 'accept_substitute', label: 'Vertretung annehmen', group: 'Dienstplan', description: 'Darf Vertretungsanfragen annehmen.' },
    { key: 'view_activity_logs', label: 'Logs ansehen', group: 'Monitoring', description: 'Darf Aktivitaets- und Systemlogs lesen.' },
    { key: 'manage_bot', label: 'Bot steuern', group: 'Automation', description: 'Darf den WhatsApp Bot und Jobs steuern.' },
    { key: 'manage_users', label: 'Benutzer verwalten', group: 'Administration', description: 'Darf Benutzerkonten verwalten.' },
    { key: 'manage_roles', label: 'Rechte verwalten', group: 'Administration', description: 'Darf Rollen und Berechtigungen bearbeiten.' },
    { key: 'manage_teams', label: 'Teams verwalten', group: 'Teams', description: 'Darf Teams global anlegen/bearbeiten.' },
    { key: 'moderate_team', label: 'Team moderieren', group: 'Teams', description: 'Darf in eigenen Teams Anfragen/Mitglieder moderieren.' },
    { key: 'view_profile', label: 'Profile sehen', group: 'Profile', description: 'Darf Profile anderer Mitglieder ansehen.' },
    { key: 'edit_own_profile', label: 'Eigenes Profil bearbeiten', group: 'Profile', description: 'Darf das eigene Profil bearbeiten.' },
    { key: 'edit_any_profile', label: 'Fremdprofile bearbeiten', group: 'Profile', description: 'Darf Profile anderer Benutzer bearbeiten.' }
];

const TOOL_PERMISSION_TO_PERMISSION_KEYS = {
    HOME: { view: 'view_home', edit: 'edit_home' },
    MUSIC_PLANER: { view: 'view_music_plan', edit: 'edit_music_plan' },
    ACTIVITY_LOGS: { view: 'view_activity_logs', edit: 'view_activity_logs' },
    BOT_CONTROL: { view: 'manage_bot', edit: 'manage_bot' },
    USER_MGMT: { view: 'manage_users', edit: 'manage_users' },
    ROLES: { view: 'manage_roles', edit: 'manage_roles' }
};

export const DEFAULT_ROLE_PERMISSION_KEYS = {
    ADMIN: PERMISSION_CATALOG.map((entry) => entry.key),
    GUEST: [],
    MEMBER: [
        'view_home',
        'edit_home',
        'view_music_plan',
        'assign_music_plan_role',
        'request_substitute',
        'accept_substitute',
        'moderate_team',
        'view_profile',
        'edit_own_profile'
    ]
};

const toKeySet = (items) => new Set(
    (Array.isArray(items) ? items : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
);

export const mapToolPermissionToPermissionKey = (toolKey, type = 'view') => {
    const normalizedToolKey = String(toolKey || '').trim().toUpperCase();
    const normalizedType = String(type || 'view').trim().toLowerCase() === 'edit' ? 'edit' : 'view';
    return TOOL_PERMISSION_TO_PERMISSION_KEYS[normalizedToolKey]?.[normalizedType] || null;
};

export const mapPermissionKeyToToolCapability = (permissionKey) => {
    const key = String(permissionKey || '').trim();
    if (!key) return null;
    if (key === 'admin_access') return { key: 'ADMIN', canView: true, canEdit: true };
    if (key === 'view_home') return { key: 'HOME', canView: true, canEdit: false };
    if (key === 'edit_home') return { key: 'HOME', canView: true, canEdit: true };
    if (key === 'view_music_plan') return { key: 'MUSIC_PLANER', canView: true, canEdit: false };
    if (key === 'edit_music_plan') return { key: 'MUSIC_PLANER', canView: true, canEdit: true };
    if (key === 'view_activity_logs') return { key: 'ACTIVITY_LOGS', canView: true, canEdit: false };
    if (key === 'manage_bot') return { key: 'BOT_CONTROL', canView: true, canEdit: true };
    if (key === 'manage_users' || key === 'manage_teams') return { key: 'USER_MGMT', canView: true, canEdit: true };
    if (key === 'manage_roles') return { key: 'ROLES', canView: true, canEdit: true };
    return null;
};

export const buildLegacyToolMatrixFromPermissionKeys = (permissionKeys = []) => {
    const map = new Map();
    for (const permissionKey of permissionKeys) {
        const entry = mapPermissionKeyToToolCapability(permissionKey);
        if (!entry) continue;
        const current = map.get(entry.key) || { key: entry.key, canView: false, canEdit: false };
        map.set(entry.key, {
            key: entry.key,
            canView: current.canView || Boolean(entry.canView),
            canEdit: current.canEdit || Boolean(entry.canEdit)
        });
    }
    return Array.from(map.values());
};

export const getUserPermissionKeySet = (user) => {
    if (!user) return new Set();
    const rolePermKeys = (user.RoleIds || []).flatMap((role) => role?.permissionKeys || []);
    return toKeySet(rolePermKeys);
};

export const hasPermission = (user, permissionKey) => {
    if (!user || !permissionKey) return false;
    const normalized = String(permissionKey).trim();
    if (!normalized) return false;
    const roleNames = (user.RoleIds || []).map((role) => String(role?.name || '').toUpperCase());
    if (roleNames.includes('ADMIN')) return true;
    const keySet = getUserPermissionKeySet(user);
    return keySet.has(normalized);
};

export const canManageTeamScope = (user, team) => {
    if (!user || !team) return false;
    const roleNames = (user.RoleIds || []).map((role) => String(role?.name || '').toUpperCase());
    if (roleNames.includes('ADMIN')) return true;
    const userId = String(user._id || '');
    return Array.isArray(team.moderators) && team.moderators.some((id) => String(id) === userId);
};

export const canRequestSubstituteScope = ({ user, plan, roleKey, allowOnlyAssignedRequester }) => {
    if (!user || !plan || !roleKey) return false;
    if (!allowOnlyAssignedRequester) return hasPermission(user, 'request_substitute');
    if (!hasPermission(user, 'request_substitute')) return false;
    const roleNames = (user.RoleIds || []).map((role) => String(role?.name || '').toUpperCase());
    if (roleNames.includes('ADMIN')) return true;
    return String(plan?.[roleKey] || '').trim() === String(user.username || '').trim();
};

export const ensureDefaultRolePermissions = async (roles = []) => {
    const roleDocs = Array.isArray(roles) ? roles : [];
    for (const role of roleDocs) {
        const roleName = String(role?.name || '').toUpperCase();
        const defaults = DEFAULT_ROLE_PERMISSION_KEYS[roleName] || [];
        const current = toKeySet(role?.permissionKeys || []);
        const next = Array.from(new Set([...current, ...defaults]));
        if (next.length !== current.size) {
            role.permissionKeys = next;
            await role.save();
        }
    }
};
