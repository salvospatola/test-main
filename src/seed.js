import mongoose from 'mongoose';
import 'dotenv/config';

// Schemas laden
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    firstName: String,
    lastName: String,
    phone: String,
    RoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    countryCode: { type: String, default: '49' }
});

const roleSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true }
});

const musicPlanSchema = new mongoose.Schema({
    Datum: { type: String, required: true, unique: true },
    Uhrzeit: String,
    Typ: String,
    Thema: String,
    Predigt: String,
    Leitung: String,
    Anbetungsstunde: String,
    Organisator: String,
    Klavier: String,
    Gitarre: String,
    Bass: String,
    Schlagzeug: String,
    Blockflöte: String,
    Gesang1: String,
    Gesang2: String,
    TechnikPC: String,
    TechnikSound: String,
    Probe: String,
    Anmerkung: String,
    Besonderes: String
});

const User = mongoose.model('User', userSchema);
const Role = mongoose.model('Role', roleSchema);
const MusicPlan = mongoose.model('MusicPlan', musicPlanSchema);

const MONGODB_URI = process.env.MONGODB_URI;
const PLAN_USER_FIELDS = [
    'Predigt',
    'Leitung',
    'Anbetungsstunde',
    'Organisator',
    'Klavier',
    'Gitarre',
    'Bass',
    'Schlagzeug',
    'Blockflöte',
    'Gesang1',
    'Gesang2',
    'TechnikPC',
    'TechnikSound'
];
const KEEP_AS_IS_VALUES = new Set(['', '?', '-', '/', 'Jugend', 'Integrierte Mahlfeier!', 'n/a', 'N/A']);

const normalizeName = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ');

const buildUserLookup = (users) => {
    const byFullName = new Map();
    const byLastNameFirstName = new Map();
    const byFirstNameOnly = new Map();

    for (const u of users) {
        const username = String(u?.username || '').trim();
        const firstName = String(u?.firstName || '').trim();
        const lastName = String(u?.lastName || '').trim();
        if (!username || !firstName || !lastName) continue;

        const fullName = normalizeName(`${firstName} ${lastName}`);
        const reverseName = normalizeName(`${lastName} ${firstName}`);
        const firstOnly = normalizeName(firstName);

        if (fullName && !byFullName.has(fullName)) byFullName.set(fullName, username);
        if (reverseName && !byLastNameFirstName.has(reverseName)) byLastNameFirstName.set(reverseName, username);
        if (firstOnly) {
            const existing = byFirstNameOnly.get(firstOnly);
            if (!existing) byFirstNameOnly.set(firstOnly, username);
            else if (existing !== username) byFirstNameOnly.set(firstOnly, null);
        }
    }

    return { byFullName, byLastNameFirstName, byFirstNameOnly };
};

const resolvePlanValueToUsername = (rawValue, lookup) => {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed || KEEP_AS_IS_VALUES.has(trimmed)) return { value: trimmed, resolved: false, reason: 'kept' };

    const normalized = normalizeName(trimmed);
    if (!normalized) return { value: trimmed, resolved: false, reason: 'empty' };

    const fromFull = lookup.byFullName.get(normalized);
    if (fromFull) return { value: fromFull, resolved: true, reason: 'full_name' };

    const fromReverse = lookup.byLastNameFirstName.get(normalized);
    if (fromReverse) return { value: fromReverse, resolved: true, reason: 'last_first' };

    const firstToken = normalized.split(' ').filter(Boolean)[0] || '';
    if (firstToken) {
        const fromFirst = lookup.byFirstNameOnly.get(firstToken);
        if (fromFirst) return { value: fromFirst, resolved: true, reason: 'first_name_unique' };
    }

    return { value: trimmed, resolved: false, reason: 'not_found' };
};

const seedData = async () => {
    try {
        if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
        await mongoose.connect(MONGODB_URI);

        const adminRole = await Role.findOne({ name: 'ADMIN' });
        const memberRole = await Role.findOne({ name: 'MEMBER' });

        if (!adminRole || !memberRole) {
            console.error('Basis-Rollen nicht gefunden. Starte die App erst einmal normal.');
            process.exit(1);
        }

        const seedMode = process.env.SEED_MODE || 'merge';
        const seedTarget = process.env.SEED_TARGET || 'both';

        console.log(`Seeding Target: ${seedTarget.toUpperCase()} | Mode: ${seedMode.toUpperCase()}`);

        // --- USERS ---
        if ((seedTarget === 'users' || seedTarget === 'both') && process.env.SEED_USERS_JSON) {
            const userData = JSON.parse(process.env.SEED_USERS_JSON);
            if (seedMode === 'replace') {
                await User.deleteMany({ RoleIds: { $in: [adminRole._id, memberRole._id] } });
            }

            for (const u of userData) {
                const doc = {
                    username: (u.lastName.replace(/[^a-zA-Z]/g, '') + u.firstName.substring(0, 2)).toLowerCase().replace(/\s/g, ''),
                    firstName: u.firstName,
                    lastName: u.lastName,
                    RoleIds: [u.isAdmin ? adminRole._id : memberRole._id],
                    countryCode: '49'
                };
                await User.findOneAndUpdate({ username: doc.username }, doc, { upsert: true });
            }
            console.log('User seeding completed.');
        }

        // --- PLAN ---
        if ((seedTarget === 'plan' || seedTarget === 'both') && process.env.SEED_PLAN_JSON) {
            const planData = JSON.parse(process.env.SEED_PLAN_JSON);
            if (seedMode === 'replace') {
                await MusicPlan.deleteMany({});
            }

            const usersForLookup = await User.find({}, { username: 1, firstName: 1, lastName: 1 }).lean();
            const userLookup = buildUserLookup(usersForLookup);
            let resolvedCounter = 0;
            let unresolvedCounter = 0;

            for (const entry of planData) {
                const mappedEntry = { ...entry };
                for (const field of PLAN_USER_FIELDS) {
                    if (!(field in mappedEntry)) continue;
                    const { value, resolved, reason } = resolvePlanValueToUsername(mappedEntry[field], userLookup);
                    mappedEntry[field] = value;

                    if (resolved) {
                        resolvedCounter += 1;
                    } else if (reason === 'not_found') {
                        unresolvedCounter += 1;
                        console.warn(`[SEED][PLAN] User not found for ${field}="${String(entry[field] || '').trim()}" on ${entry.Datum}`);
                    }
                }
                await MusicPlan.findOneAndUpdate({ Datum: mappedEntry.Datum }, mappedEntry, { upsert: true });
            }
            console.log('Plan seeding completed.');
            console.log(`[SEED][PLAN] User mapping: resolved=${resolvedCounter}, unresolved=${unresolvedCounter}`);
        }

        process.exit(0);
    } catch (e) {
        console.error('Seeding failed:', e.message);
        process.exit(1);
    }
};

seedData();
