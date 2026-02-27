import { MusicPlan, User } from './db.service.js';
import notifyService from './notify.service.js';
import { findUserByName } from './user.service.js';
import ExcelJS from 'exceljs';
import { upsertSongsToCatalog } from './song-catalog.service.js';

const COLUMNS = [
    { header: 'Datum', key: 'Datum', width: 15 },
    { header: 'Uhrzeit', key: 'Uhrzeit', width: 15 },
    { header: 'Typ', key: 'Typ', width: 15 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Thema', key: 'Thema', width: 30 },
    { header: 'Predigt', key: 'Predigt', width: 20 },
    { header: 'Leitung', key: 'Leitung', width: 20 },
    { header: 'Anbetungsstunde', key: 'Anbetungsstunde', width: 20 },
    { header: 'Organisator', key: 'Organisator', width: 20 },
    { header: 'Klavier', key: 'Klavier', width: 15 },
    { header: 'Gitarre', key: 'Gitarre', width: 15 },
    { header: 'Bass', key: 'Bass', width: 15 },
    { header: 'Schlagzeug', key: 'Schlagzeug', width: 15 },
    { header: 'Blockflöte', key: 'Blockflöte', width: 15 },
    { header: 'Gesang 1', key: 'Gesang1', width: 15 },
    { header: 'Gesang 2', key: 'Gesang2', width: 15 },
    { header: 'Technik (PC)', key: 'TechnikPC', width: 20 },
    { header: 'Technik (Sound)', key: 'TechnikSound', width: 20 },
    { header: 'Probe', key: 'Probe', width: 25 },
    { header: 'Besonderes', key: 'Besonderes', width: 30 },
];

export const getPlan = async () => {
    const plans = await MusicPlan.find().sort({ Datum: 1 });
    return plans.map((p, index) => ({
        ...p.toObject(),
        id: p._id.toString(),
        _id: p._id.toString(),
        rowIndex: index 
    }));
};

const normalizeCategoryLabel = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.toLowerCase() === 'sonntag' ? 'Gottesdienst' : normalized;
};

const normalizeSongs = (rawSongs) => (
    (Array.isArray(rawSongs) ? rawSongs : [])
        .map((song) => ({
            number: String(song?.number || '').trim(),
            title: String(song?.title || '').trim(),
            sourceUrl: String(song?.sourceUrl || '').trim()
        }))
        .filter((song) => song.number || song.title)
);

const normalizePlanPayload = (input = {}) => {
    const data = { ...input };
    const rawTags = Array.isArray(data.tags) ? data.tags : [];
    const tags = Array.from(new Set(
        rawTags
            .map((entry) => normalizeCategoryLabel(entry))
            .filter(Boolean)
    ));
    const typ = normalizeCategoryLabel(data.Typ);
    data.tags = tags;
    data.Typ = typ || tags[0] || 'Gottesdienst';
    data.songs = normalizeSongs(data.songs);
    return data;
};

export const addEntry = async (unused, data) => {
    const normalized = normalizePlanPayload(data);
    await MusicPlan.create(normalized);
    await upsertSongsToCatalog(normalized.songs);
    return { success: true };
};

export const updateEntry = async (unused, identifier, data) => {
    let plan;
    if (identifier && identifier.length === 24) {
        plan = await MusicPlan.findById(identifier);
    }
    if (!plan) {
        plan = await MusicPlan.findOne({ Datum: data.Datum });
    }
    if (!plan) throw new Error('Eintrag nicht gefunden');

    const oldPlan = plan.toObject();
    const updateData = normalizePlanPayload(data);
    
    // Cleanup internal fields
    delete updateData._id; delete updateData.id; delete updateData.__v;
    delete updateData.rowIndex; delete updateData.createdAt; delete updateData.updatedAt;

    plan.set(updateData);
    await plan.save();
    await upsertSongsToCatalog(updateData.songs);

    // --- NOTIFICATION LOGIC ---
    const relevantKeys = [
        'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
        'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
    ];

    for (const key of relevantKeys) {
        const newValue = String(updateData[key] || '');
        const oldValue = String(oldPlan[key] || '');

        if (newValue !== oldValue && newValue !== '' && newValue !== '/' && newValue !== '?') {
            const user = await User.findOne({ username: newValue });
            if (user) {
                const isNewAssignment = oldValue === '' || oldValue === '/' || oldValue === '?';
                const type = isNewAssignment ? 'plan_assigned' : 'plan_changed';
                const title = isNewAssignment ? 'Neue Diensteinteilung' : 'Dienst geändert';
                const dateStr = plan.Datum.split('-').reverse().join('.');
                
                notifyService.notifyUser(user._id, type, {
                    title,
                    message: `Du bist am ${dateStr} für "${key}" eingeteilt.`,
                    link: `/dienstplaner?entry=${plan._id}`
                });
            }
        }
    }

    return { success: true };
};

export const generateExcel = async () => {
    const data = await getPlan();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Gottesdienstplan');

    worksheet.columns = COLUMNS;
    data.forEach(d => {
        worksheet.addRow(d);
    });

    return await workbook.xlsx.writeBuffer();
};

export const importExcel = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    
    const results = { updated: 0, created: 0, skipped: 0 };
    const headerRow = worksheet.getRow(1);
    const colMap = {};
    headerRow.eachCell((cell, colNumber) => {
        const colDef = COLUMNS.find(c => c.header === cell.value);
        if (colDef) colMap[colNumber] = colDef.key;
    });

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const key = colMap[colNumber];
            if (key) {
                let val = cell.value;
                if (val instanceof Date) {
                    if (key === 'Datum') val = val.toISOString().split('T')[0];
                    else val = val.toISOString();
                }
                if (val && typeof val === 'object' && val.text) val = val.text;
                rowData[key] = val || '';
            }
        });
        if (rowData.Datum) rows.push(rowData);
    });

    const relevantRoles = [
        'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
        'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
    ];

    for (const rowData of rows) {
        const normalizedRow = normalizePlanPayload(rowData);
        // Resolve names to usernames for relevant roles
        for (const role of relevantRoles) {
            if (normalizedRow[role] && normalizedRow[role] !== '/' && normalizedRow[role] !== '?' && normalizedRow[role] !== '-') {
                const user = await findUserByName(normalizedRow[role]);
                if (user) {
                    normalizedRow[role] = user.username;
                }
            }
        }

        let existing = await MusicPlan.findOne({ Datum: normalizedRow.Datum });
        if (existing) {
            let changed = false;
            for (const key of Object.keys(normalizedRow)) {
                if (String(existing[key] || '') !== String(normalizedRow[key] || '')) {
                    existing[key] = normalizedRow[key];
                    changed = true;
                }
            }
            if (changed) { await existing.save(); results.updated++; }
            if (changed) await upsertSongsToCatalog(normalizedRow.songs);
            else results.skipped++;
        } else {
            await MusicPlan.create(normalizedRow);
            await upsertSongsToCatalog(normalizedRow.songs);
            results.created++;
        }
    }
    return results;
};
