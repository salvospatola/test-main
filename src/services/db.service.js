import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizePhone } from './utils.service.js';
import { getAuditUserId } from './audit-context.service.js';

const DEFAULT_PERMISSION_KEYS_BY_ROLE = {
    ADMIN: [
        'admin_access', 'view_home', 'edit_home', 'view_music_plan', 'edit_music_plan',
        'assign_music_plan_role', 'request_substitute', 'accept_substitute',
        'view_activity_logs', 'manage_bot', 'manage_users', 'manage_roles',
        'manage_teams', 'moderate_team', 'view_profile', 'edit_own_profile', 'edit_any_profile'
    ],
    MEMBER: [
        'view_home', 'edit_home', 'view_music_plan', 'assign_music_plan_role',
        'request_substitute', 'accept_substitute', 'moderate_team', 'view_profile', 'edit_own_profile'
    ],
    GUEST: []
};

const applyAuditPlugin = (schema) => {
    if (!schema.path('createdBy')) {
        schema.add({ createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true } });
    }
    if (!schema.path('lastModifiedBy')) {
        schema.add({ lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true } });
    }
    if (!schema.path('createdAt')) {
        schema.add({ createdAt: { type: Date, default: Date.now, index: true } });
    }
    if (!schema.path('lastModifiedAt')) {
        schema.add({ lastModifiedAt: { type: Date, default: Date.now, index: true } });
    }

    schema.pre('save', function() {
        const now = new Date();
        if (!this.createdAt) this.createdAt = now;
        this.lastModifiedAt = now;
        const auditUserId = getAuditUserId();
        if (auditUserId) {
            if (this.isNew && !this.createdBy) this.createdBy = auditUserId;
            this.lastModifiedBy = auditUserId;
        }
    });

    schema.pre('insertMany', function(docs) {
        const now = new Date();
        const auditUserId = getAuditUserId();
        for (const doc of docs || []) {
            if (!doc.createdAt) doc.createdAt = now;
            doc.lastModifiedAt = now;
            if (auditUserId) {
                if (!doc.createdBy) doc.createdBy = auditUserId;
                doc.lastModifiedBy = auditUserId;
            }
        }
    });

    const updateOps = ['findOneAndUpdate', 'updateOne', 'updateMany', 'update'];
    updateOps.forEach((op) => {
        schema.pre(op, function() {
            const now = new Date();
            const auditUserId = getAuditUserId();
            const update = this.getUpdate() || {};
            if (!update.$set) update.$set = {};
            update.$set.lastModifiedAt = now;
            if (auditUserId) update.$set.lastModifiedBy = auditUserId;

            if (this.options?.upsert) {
                if (!update.$setOnInsert) update.$setOnInsert = {};
                if (!update.$setOnInsert.createdAt) update.$setOnInsert.createdAt = now;
                if (auditUserId && !update.$setOnInsert.createdBy) update.$setOnInsert.createdBy = auditUserId;
            }
            this.setUpdate(update);
        });
    });
};

// --- DATABASE CONNECTION ---
export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://efg_nsu_mongodb:27017/efg_nsu');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
    }
};

// --- SCHEMAS ---

const roleSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    permissionKeys: { type: [String], default: [] }
}, { timestamps: true });

const toolSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    isPublic: { type: Boolean, default: false }
}, { timestamps: true });

const teamSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    positions: [String],
    positionMeta: [{
        name: { type: String, required: true },
        icon: { type: String, default: 'Tag' }
    }],
    description: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, sparse: true },
    birthday: Date,
    countryCode: { type: String, default: '49' },
    phone: { type: String, unique: true, sparse: true, index: true },
    profileImage: String,
    optimizedProfileImage: String,
    coverImage: String,
    optimizedCoverImage: String,
    coverColor: { type: String, default: '' },
    bio: { type: String, maxlength: 500 },
    status: { type: String, maxlength: 100 },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingSkipped: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    RoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    tags: [{ type: String, index: true }],
    teamPositions: [{
        TeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        position: String
    }],
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    theme: { type: String, enum: ['AUTO', 'LIGHT', 'DARK'], default: 'AUTO' },
    contactVisibility: {
        emailPublic: { type: Boolean, default: false },
        phonePublic: { type: Boolean, default: false }
    },
    notifications: {
        plan_assigned: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
        plan_reminder: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
        plan_changed: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
        wall_new_post: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        wall_comment: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        wall_like: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        wall_mention: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        system_critical: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        security_alert: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        substitute_request: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
        chat_message: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
        system_update: { app: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: false }, email: { type: Boolean, default: false } }
    },
    calendarFeed: {
        token: { type: String, default: '', index: true },
        enabledSources: { type: [String], default: ['PLAN_ASSIGNMENTS', 'PLAN_PROBES'] }
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const chatConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);

const chatMessageSchema = new mongoose.Schema({
    ConversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', index: true },
    SenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

const whatsAppLogSchema = new mongoose.Schema({
    level: { type: String, default: 'info' },
    type: { type: String, default: 'system' },
    event: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
});

const notificationSchema = new mongoose.Schema({
    UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    type: String,
    title: String,
    message: String,
    link: String,
    read: { type: Boolean, default: false }
}, { timestamps: true });

const globalTagSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true }
}, { timestamps: true });

const songCatalogSchema = new mongoose.Schema({
    number: { type: String, default: '', index: true },
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, required: true, trim: true, index: true },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });
songCatalogSchema.index({ normalizedTitle: 1, number: 1 }, { unique: true });

const musicPlanSchema = new mongoose.Schema({
    Datum: { type: String, index: true, required: true },
    Uhrzeit: String,
    Typ: String,
    Thema: String,
    Predigt: String,
    Leitung: String,
    Anbetungsstunde: String,
    Organisator: String,
    TechnikPC: String,
    TechnikSound: String,
    Klavier: String,
    Gitarre: String,
    Bass: String,
    Schlagzeug: String,
    Blockflöte: String,
    Gesang1: String,
    Gesang2: String,
    Probe: String,
    probePollOptions: { type: [String], default: [] },
    Besonderes: String,
    tags: [String],
    songs: {
        type: [{
            number: { type: String, default: '' },
            title: { type: String, default: '' },
            sourceUrl: { type: String, default: '' }
        }],
        default: []
    }
}, { timestamps: true });

const substituteRequestSchema = new mongoose.Schema({
    PlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'MusicPlan' },
    roleKey: String,
    RequesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    TeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    message: String,
    status: { type: String, enum: ['OPEN', 'FILLED', 'CANCELLED'], default: 'OPEN' },
    filledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const teamMembershipRequestSchema = new mongoose.Schema({
    TeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true, required: true },
    UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    requestedPositions: { type: [String], default: [] },
    message: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    handledAt: Date
}, { timestamps: true });

const planSlotTargetRuleSchema = new mongoose.Schema({
    mode: { type: String, enum: ['INCLUDE', 'EXCLUDE'], default: 'INCLUDE' },
    TeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    positions: { type: [String], default: [] }
}, { _id: true });

const planSlotConfigSchema = new mongoose.Schema({
    roleKey: { type: String, unique: true, required: true },
    label: { type: String, required: true },
    allowOnlyAssignedRequester: { type: Boolean, default: true },
    editableFields: { type: [String], default: [] },
    targetRules: { type: [planSlotTargetRuleSchema], default: [] }
}, { timestamps: true });

const activityLogSchema = new mongoose.Schema({
    UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, index: true },
    tool: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    path: String,
    createdAt: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
    phone: { type: String, unique: true, required: true },
    code: String,
    firstName: String,
    lastName: String,
    roleName: { type: String, enum: ['ADMIN', 'MEMBER', 'GUEST'], default: 'MEMBER' },
    expiresAt: Date
});

const systemStatSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    cpu: Number,
    memory: Number,
    uptime: Number,
    traffic: Number,
    dbReads: Number,
    dbWrites: Number,
    dbReadsTotal: Number,
    dbWritesTotal: Number,
    attackCount: Number,
    activeUsers: Number,
    dbSize: Number,
    dbObjects: Number
});

const ipBanSchema = new mongoose.Schema({
    ip: { type: String, unique: true, required: true },
    reason: String,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const systemLogSchema = new mongoose.Schema({
    level: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'DEBUG', 'CRITICAL', 'SECURITY'], default: 'INFO' },
    module: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
});

const globalSettingSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: String,
    hashedValue: String
}, { timestamps: true });

const whatsAppAuthSchema = new mongoose.Schema({
    _id: String,
    data: String
});

const jobLogSchema = new mongoose.Schema({
    JobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledJob' },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'ERROR'] },
    message: String,
    details: mongoose.Schema.Types.Mixed,
    durationMs: Number,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
});

const scheduledJobSchema = new mongoose.Schema({
    name: String,
    type: String,
    cronExpression: String,
    executionTime: Date,
    active: { type: Boolean, default: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastRun: Date,
    nextRun: Date
}, { timestamps: true });

const channelRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    createdAt: { type: Date, default: Date.now },
    handledAt: Date,
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const channelSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 600 },
    image: String,
    optimizedImage: String,
    isPrivate: { type: Boolean, default: false },
    isPassive: { type: Boolean, default: false },
    coverColor: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    joinRequests: [channelRequestSchema]
}, { timestamps: true });
channelSchema.index({ title: 1 });
channelSchema.index({ isPrivate: 1, createdAt: -1 });

const pollVoteSchema = new mongoose.Schema({
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const pollOptionSchema = new mongoose.Schema({
    label: { type: String, required: true, maxlength: 140 }
}, { _id: true });

const pollSchema = new mongoose.Schema({
    question: { type: String, required: true, maxlength: 180 },
    multiple: { type: Boolean, default: false },
    options: { type: [pollOptionSchema], default: [] },
    votes: { type: [pollVoteSchema], default: [] }
}, { _id: false });

const postSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
    content: String,
    attachments: [String], 
    optimizedAttachments: [String],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isModerated: { type: Boolean, default: false }
    }],
    isModerated: { type: Boolean, default: false },
    linkData: {
        url: String,
        title: String,
        description: String,
        image: String,
        isYouTube: Boolean,
        videoId: String
    },
    poll: pollSchema,
    pinned: { type: Boolean, default: false },
    pinnedAt: Date
}, { timestamps: true });
postSchema.index({ createdAt: -1 });
postSchema.index({ channel: 1, createdAt: -1 });

const quickAssignTokenSchema = new mongoose.Schema({
    token: { type: String, unique: true, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MusicPlan' },
    roleKey: String,
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
});

const refreshSessionSchema = new mongoose.Schema({
    tokenHash: { type: String, unique: true, required: true, index: true },
    UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: Date,
    replacedByHash: String,
    sessionClaims: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const inviteSchema = new mongoose.Schema({
    token: { type: String, unique: true, required: true },
    used: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roleName: { type: String, enum: ['ADMIN', 'MEMBER', 'GUEST'], default: 'MEMBER' },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const threatLogSchema = new mongoose.Schema({
    ip: { type: String, index: true },
    action: String,
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    path: String,
    method: String,
    userAgent: String,
    details: mongoose.Schema.Types.Mixed,
    geo: { country: String, city: String, region: String, ll: [Number] },
    client: { os: String, browser: String, device: String, isBot: Boolean },
    count: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now, expires: '90d' }
});

[
    roleSchema,
    toolSchema,
    teamSchema,
    userSchema,
    chatConversationSchema,
    chatMessageSchema,
    whatsAppLogSchema,
    notificationSchema,
    globalTagSchema,
    songCatalogSchema,
    musicPlanSchema,
    substituteRequestSchema,
    teamMembershipRequestSchema,
    planSlotConfigSchema,
    activityLogSchema,
    otpSchema,
    systemStatSchema,
    ipBanSchema,
    systemLogSchema,
    globalSettingSchema,
    whatsAppAuthSchema,
    jobLogSchema,
    scheduledJobSchema,
    channelSchema,
    postSchema,
    quickAssignTokenSchema,
    refreshSessionSchema,
    inviteSchema,
    threatLogSchema
].forEach(applyAuditPlugin);

// --- MODELS EXPORT ---

userSchema.pre('save', async function() {
    if (this.email === '') this.email = undefined;
    if (this.phone === '') this.phone = undefined;
    if (this.phone) this.phone = normalizePhone(this.phone);
});

const whatsAppOutboxSchema = new mongoose.Schema({
    number: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'error'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    scheduledAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

export const Role = mongoose.model('Role', roleSchema);
export const Tool = mongoose.model('Tool', toolSchema);
export const Team = mongoose.model('Team', teamSchema);
export const User = mongoose.model('User', userSchema);
export const WhatsAppLog = mongoose.model('WhatsAppLog', whatsAppLogSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const GlobalTag = mongoose.model('GlobalTag', globalTagSchema);
export const SongCatalog = mongoose.model('SongCatalog', songCatalogSchema);
export const MusicPlan = mongoose.model('MusicPlan', musicPlanSchema);
export const SubstituteRequest = mongoose.model('SubstituteRequest', substituteRequestSchema);
export const TeamMembershipRequest = mongoose.model('TeamMembershipRequest', teamMembershipRequestSchema);
export const PlanSlotConfig = mongoose.model('PlanSlotConfig', planSlotConfigSchema);
export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export const OTP = mongoose.model('OTP', otpSchema);
export const SystemStat = mongoose.model('SystemStat', systemStatSchema);
export const IPBan = mongoose.model('IPBan', ipBanSchema);
export const SystemLog = mongoose.model('SystemLog', systemLogSchema);
export const GlobalSetting = mongoose.model('GlobalSetting', globalSettingSchema);
export const WhatsAppAuth = mongoose.model('WhatsAppAuth', whatsAppAuthSchema);
export const WhatsAppOutbox = mongoose.model('WhatsAppOutbox', whatsAppOutboxSchema);
export const JobLog = mongoose.model('JobLog', jobLogSchema);
export const ScheduledJob = mongoose.model('ScheduledJob', scheduledJobSchema);
export const Channel = mongoose.model('Channel', channelSchema);
export const Post = mongoose.model('Post', postSchema);
export const QuickAssignToken = mongoose.model('QuickAssignToken', quickAssignTokenSchema);
export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export const Invite = mongoose.model('Invite', inviteSchema);
export const ThreatLog = mongoose.model('ThreatLog', threatLogSchema);

// --- INITIALIZATION ---

export const initDatabase = async () => {
    if (globalThis.__DB_INITIALIZED__) return;
    globalThis.__DB_INITIALIZED__ = true;
    
    try {
        try {
            await ScheduledJob.collection.dropIndex('type_1');
        } catch (_e) {}

        const adminRole = await Role.findOneAndUpdate({ name: 'ADMIN' }, { name: 'ADMIN' }, { upsert: true, new: true });
        const memberRole = await Role.findOneAndUpdate({ name: 'MEMBER' }, { name: 'MEMBER' }, { upsert: true, new: true });
        const guestRole = await Role.findOneAndUpdate({ name: 'GUEST' }, { name: 'GUEST' }, { upsert: true, new: true });
        const legacyUserRole = await Role.findOne({ name: 'USER' });
        for (const role of [adminRole, memberRole, guestRole].filter(Boolean)) {
            const defaults = DEFAULT_PERMISSION_KEYS_BY_ROLE[String(role?.name || '').toUpperCase()] || [];
            if (defaults.length > 0) {
                await Role.updateOne(
                    { _id: role._id },
                    { $addToSet: { permissionKeys: { $each: defaults } } }
                );
            }
        }
        if (legacyUserRole && memberRole) {
            await User.updateMany({ RoleIds: legacyUserRole._id }, { $addToSet: { RoleIds: memberRole._id } });
            await User.updateMany({ RoleIds: legacyUserRole._id }, { $pull: { RoleIds: legacyUserRole._id } });
            const remainingLegacyUsers = await User.countDocuments({ RoleIds: legacyUserRole._id });
            if (remainingLegacyUsers === 0) {
                await Role.deleteOne({ _id: legacyUserRole._id });
            }
        }

        const botTool = await Tool.findOneAndUpdate({ key: 'BOT_CONTROL' }, { key: 'BOT_CONTROL', name: 'WhatsApp Control', isPublic: false }, { upsert: true, new: true });
        const planTool = await Tool.findOneAndUpdate({ key: 'MUSIC_PLANER' }, { key: 'MUSIC_PLANER', name: 'Dienstplaner', isPublic: false }, { upsert: true, new: true });
        const userMgmtTool = await Tool.findOneAndUpdate({ key: 'USER_MGMT' }, { key: 'USER_MGMT', name: 'Benutzerverwaltung', isPublic: false }, { upsert: true, new: true });
        const homeTool = await Tool.findOneAndUpdate({ key: 'HOME' }, { key: 'HOME', name: 'Schwarzes Brett', isPublic: false }, { upsert: true, new: true });
        const logTool = await Tool.findOneAndUpdate({ key: 'ACTIVITY_LOGS' }, { key: 'ACTIVITY_LOGS', name: 'Aktivitäts-Logs', isPublic: false }, { upsert: true, new: true });
        const rolesTool = await Tool.findOneAndUpdate({ key: 'ROLES' }, { key: 'ROLES', name: 'Rollen-Management', isPublic: false }, { upsert: true, new: true });

        // Normalize legacy service category naming.
        await MusicPlan.updateMany({ Typ: 'Sonntag' }, { $set: { Typ: 'Gottesdienst' } });
        await MusicPlan.updateMany(
            { tags: 'Sonntag' },
            [
                {
                    $set: {
                        tags: {
                            $setUnion: [
                                {
                                    $map: {
                                        input: '$tags',
                                        as: 'tag',
                                        in: { $cond: [{ $eq: ['$$tag', 'Sonntag'] }, 'Gottesdienst', '$$tag'] }
                                    }
                                },
                                []
                            ]
                        }
                    }
                }
            ],
            { updatePipeline: true }
        );
        await GlobalTag.deleteOne({ name: 'Sonntag' });
        await GlobalTag.findOneAndUpdate({ name: 'Gottesdienst' }, { name: 'Gottesdienst' }, { upsert: true, new: true });

        // Ensure SYSTEM_STATS job exists and is clean
        const statsJobs = await ScheduledJob.find({ type: 'SYSTEM_STATS' });
        if (statsJobs.length === 0) {
            await ScheduledJob.create({
                name: 'System-Statistiken sammeln',
                type: 'SYSTEM_STATS',
                cronExpression: '*/5 * * * *',
                active: true,
                params: {}
            });
        }
        
        // Ensure CHECK_REMINDERS job exists
        const reminderJob = await ScheduledJob.findOne({ type: 'CHECK_REMINDERS' });
        if (!reminderJob) {
            await ScheduledJob.create({
                name: 'Dienst-Erinnerungen (flexibel)',
                type: 'CHECK_REMINDERS',
                cronExpression: '0 * * * *',
                active: true,
                params: {
                    daysBeforeMin: 1,
                    daysBeforeMax: 3,
                    cooldownHours: 12,
                    categories: [],
                    appTitleTemplate: 'Diensterinnerung',
                    appMessageTemplate: '$(timing_phrase) bist du zur Aufgabe "$(role_name)" eingeteilt.'
                }
            });
        } else {
            const nextParams = {
                daysBeforeMin: reminderJob.params?.daysBeforeMin ?? 1,
                daysBeforeMax: reminderJob.params?.daysBeforeMax ?? 3,
                cooldownHours: reminderJob.params?.cooldownHours ?? 12,
                categories: Array.isArray(reminderJob.params?.categories) ? reminderJob.params.categories : [],
                appTitleTemplate: reminderJob.params?.appTitleTemplate || 'Diensterinnerung',
                appMessageTemplate: reminderJob.params?.appMessageTemplate || '$(timing_phrase) bist du zur Aufgabe "$(role_name)" eingeteilt.'
            };
            const nextName = reminderJob.name?.includes('24h') ? 'Dienst-Erinnerungen (flexibel)' : reminderJob.name;
            await ScheduledJob.findByIdAndUpdate(reminderJob._id, { name: nextName, params: nextParams });
        }

        const defaultPlanSlotConfigs = [
            { roleKey: 'Predigt', label: 'Predigt', editableFields: ['Thema'], allowOnlyAssignedRequester: true },
            { roleKey: 'Leitung', label: 'Leitung', allowOnlyAssignedRequester: true },
            { roleKey: 'Anbetungsstunde', label: 'Anbetung', allowOnlyAssignedRequester: true },
            { roleKey: 'Organisator', label: 'Musik-Orga', allowOnlyAssignedRequester: true },
            { roleKey: 'TechnikPC', label: 'Technik PC', allowOnlyAssignedRequester: true },
            { roleKey: 'TechnikSound', label: 'Technik Sound', allowOnlyAssignedRequester: true },
            { roleKey: 'Klavier', label: 'Klavier', allowOnlyAssignedRequester: true },
            { roleKey: 'Gitarre', label: 'Gitarre', allowOnlyAssignedRequester: true },
            { roleKey: 'Bass', label: 'Bass', allowOnlyAssignedRequester: true },
            { roleKey: 'Schlagzeug', label: 'Schlagzeug', allowOnlyAssignedRequester: true },
            { roleKey: 'Blockflöte', label: 'Blockflöte', allowOnlyAssignedRequester: true },
            { roleKey: 'Gesang1', label: 'Gesang 1', allowOnlyAssignedRequester: true },
            { roleKey: 'Gesang2', label: 'Gesang 2', allowOnlyAssignedRequester: true }
        ];
        for (const slot of defaultPlanSlotConfigs) {
            await PlanSlotConfig.findOneAndUpdate(
                { roleKey: slot.roleKey },
                {
                    $setOnInsert: {
                        roleKey: slot.roleKey,
                        label: slot.label,
                        editableFields: slot.editableFields || [],
                        allowOnlyAssignedRequester: slot.allowOnlyAssignedRequester
                    }
                },
                { upsert: true, new: true }
            );
        }

        // --- DATA MIGRATION: Names to Usernames ---
        try {
            const { findUserByName } = await import('./user.service.js');
            const plans = await MusicPlan.find({});
            const relevantRoles = [
                'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
                'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
            ];

            for (const plan of plans) {
                let changed = false;
                for (const role of relevantRoles) {
                    const val = plan[role];
                    if (val && val !== '/' && val !== '?' && val !== '-' && !val.includes(' ') && val.length > 3) {
                        // Probably already a username
                        continue;
                    }
                    if (val && val !== '/' && val !== '?' && val !== '-') {
                        const user = await findUserByName(val);
                        if (user) {
                            plan[role] = user.username;
                            changed = true;
                        }
                    }
                }
                if (changed) await plan.save();
            }
        } catch (migErr) { console.error("Migration failed:", migErr.message); }

    } catch (e) { console.error("Database Init Failed:", e.message); }
};
