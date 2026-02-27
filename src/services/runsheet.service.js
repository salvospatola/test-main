import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const TEMPLATE_PATH = path.resolve(process.cwd(), 'templates', 'Vorlage.GDP.2.xlsx');

const ROLE_KEYS = [
    'Predigt', 'Leitung', 'Anbetungsstunde', 'Organisator', 'TechnikPC', 'TechnikSound',
    'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Blockflöte', 'Gesang1', 'Gesang2'
];

const readCellText = (cell) => {
    const value = cell?.value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object' && value.richText) {
        return value.richText.map((item) => item?.text || '').join('');
    }
    if (value && typeof value === 'object' && value.text) return String(value.text || '');
    return '';
};

const normalizeSong = (song) => {
    const number = String(song?.number || '').trim();
    const title = String(song?.title || '').trim();
    const text = `${number ? `${number} ` : ''}${title}`.trim();
    return text || '';
};

const sanitizeForExcelText = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/\r\n/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trim();
};

const resolveDisplayName = (username, usersByUsername) => {
    const key = String(username || '').trim();
    if (!key || key === '/' || key === '?' || key === '-') return '';
    const user = usersByUsername?.get(key);
    if (!user) return key;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || key;
};

const formatServiceDate = (plan) => {
    const rawDate = String(plan?.Datum || '').trim();
    if (!rawDate) return '';
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    const datePart = parsed.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = String(plan?.Uhrzeit || '').trim();
    return timePart ? `${datePart} • ${timePart}` : datePart;
};

const extractAssignedUsers = (plan) => {
    const usernames = new Set();
    for (const key of ROLE_KEYS) {
        const value = String(plan?.[key] || '').trim();
        if (!value || value === '/' || value === '?' || value === '-') continue;
        usernames.add(value);
    }
    return Array.from(usernames);
};

const renderMusicTeamLine = (plan, usersByUsername) => {
    const order = ['Organisator', 'Klavier', 'Gitarre', 'Bass', 'Schlagzeug', 'Gesang1', 'Gesang2'];
    const lines = [];
    for (const key of order) {
        const value = String(plan?.[key] || '').trim();
        if (!value || value === '/' || value === '?' || value === '-') continue;
        const display = resolveDisplayName(value, usersByUsername);
        lines.push(`${key}: ${display}`);
    }
    return lines.join(', ');
};

const buildRunSheetData = (plan, usersByUsername) => {
    const songs = (Array.isArray(plan?.songs) ? plan.songs : []).map(normalizeSong).filter(Boolean);
    return {
        serviceDate: sanitizeForExcelText(formatServiceDate(plan)),
        topic: sanitizeForExcelText(String(plan?.Thema || '').trim()),
        preacher: sanitizeForExcelText(resolveDisplayName(plan?.Predigt, usersByUsername)),
        leader: sanitizeForExcelText(resolveDisplayName(plan?.Leitung, usersByUsername)),
        techLine: [
            resolveDisplayName(plan?.TechnikPC, usersByUsername),
            resolveDisplayName(plan?.TechnikSound, usersByUsername)
        ].filter(Boolean).join(' / '),
        musicLine: sanitizeForExcelText(renderMusicTeamLine(plan, usersByUsername)),
        songs: songs.map((entry) => sanitizeForExcelText(entry)).filter(Boolean)
    };
};

const applySheetMapping = ({ sheet, runSheetData }) => {
    const setCellValueSafe = (address, value) => {
        const targetCell = sheet.getCell(address);
        const writeCell = targetCell?.isMerged && targetCell.master ? targetCell.master : targetCell;
        if (!writeCell) return;
        writeCell.value = sanitizeForExcelText(value);
    };

    setCellValueSafe('F4', runSheetData.serviceDate || readCellText(sheet.getCell('F4')));
    setCellValueSafe('F7', runSheetData.topic || readCellText(sheet.getCell('F7')));
    setCellValueSafe('F9', runSheetData.preacher || readCellText(sheet.getCell('F9')));
    setCellValueSafe('F11', runSheetData.leader || readCellText(sheet.getCell('F11')));
    if (runSheetData.techLine) setCellValueSafe('B8', runSheetData.techLine);
    if (runSheetData.musicLine) setCellValueSafe('B7', runSheetData.musicLine);
    if (runSheetData.songs.length > 0) setCellValueSafe('D15', runSheetData.songs[0] || '');
    if (runSheetData.songs.length > 1) setCellValueSafe('D17', [runSheetData.songs[1] || '', runSheetData.songs[2] || ''].filter(Boolean).join('\n'));
    if (runSheetData.songs.length > 3) setCellValueSafe('D20', runSheetData.songs[3] || '');
    if (runSheetData.songs.length > 4) setCellValueSafe('D23', runSheetData.songs[4] || '');
};

const buildFileName = (plan) => {
    const date = String(plan?.Datum || 'dienst').replace(/[^0-9-]/g, '');
    const type = String(plan?.Typ || 'dienst').toLowerCase().replace(/[^a-z0-9äöüß-]+/gi, '-');
    return `Ablaufplan-${date}-${type || 'dienst'}.xlsx`;
};

export const hasRunSheetTemplate = () => fs.existsSync(TEMPLATE_PATH);

const selfCheckWorkbookBuffer = async (buffer) => {
    const checkWorkbook = new ExcelJS.Workbook();
    await checkWorkbook.xlsx.load(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    if (!Array.isArray(checkWorkbook.worksheets) || checkWorkbook.worksheets.length === 0) {
        throw new Error('Self-Check fehlgeschlagen: keine Arbeitsblaetter vorhanden.');
    }
};

const buildCleanWorkbook = ({ plan, runSheetData }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EFG NSU Portal';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Ablaufplan', {
        properties: { defaultRowHeight: 22 }
    });

    const columns = [8, 20, 20, 20, 24, 24, 18, 18];
    columns.forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
    });

    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = 'Gottesdienst Ablaufplan';
    sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8C4E28' } };
    sheet.getRow(1).height = 30;

    const styleLabel = (address) => {
        const cell = sheet.getCell(address);
        cell.font = { bold: true, color: { argb: 'FF70401F' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8D6' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            left: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            bottom: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            right: { style: 'thin', color: { argb: 'FFE5C7AD' } }
        };
    };

    const styleValue = (address) => {
        const cell = sheet.getCell(address);
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            left: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            bottom: { style: 'thin', color: { argb: 'FFE5C7AD' } },
            right: { style: 'thin', color: { argb: 'FFE5C7AD' } }
        };
    };

    const sections = [
        { label: 'Datum & Uhrzeit', value: runSheetData.serviceDate || sanitizeForExcelText(plan?.Datum || ''), row: 4 },
        { label: 'Thema', value: runSheetData.topic || '-', row: 7 },
        { label: 'Prediger', value: runSheetData.preacher || '-', row: 9 },
        { label: 'Leitung', value: runSheetData.leader || '-', row: 11 },
        { label: 'Technik', value: runSheetData.techLine || '-', row: 13 },
        { label: 'Musikteam', value: runSheetData.musicLine || '-', row: 15 }
    ];

    sections.forEach((entry) => {
        sheet.mergeCells(`B${entry.row}:E${entry.row}`);
        sheet.mergeCells(`F${entry.row}:H${entry.row}`);
        sheet.getCell(`B${entry.row}`).value = entry.label;
        sheet.getCell(`F${entry.row}`).value = sanitizeForExcelText(entry.value);
        styleLabel(`B${entry.row}`);
        styleValue(`F${entry.row}`);
    });

    sheet.mergeCells('B18:H18');
    sheet.getCell('B18').value = 'Lieder';
    styleLabel('B18');
    sheet.getCell('B18').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('B18').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8C4E28' } };

    const songRows = [20, 21, 22, 23, 24, 25];
    songRows.forEach((rowIndex, idx) => {
        sheet.mergeCells(`B${rowIndex}:H${rowIndex}`);
        sheet.getCell(`B${rowIndex}`).value = sanitizeForExcelText(runSheetData.songs[idx] || '');
        styleValue(`B${rowIndex}`);
    });
    sheet.getRow(20).height = 28;
    sheet.getRow(21).height = 28;
    sheet.getRow(22).height = 28;
    sheet.getRow(23).height = 28;

    return workbook;
};

const generateTemplateBuffer = async ({ plan, runSheetData }) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    let sheet = workbook.getWorksheet('Ablaufplan') || workbook.worksheets[0];
    if (!sheet) throw new Error('Vorlage enthält kein Arbeitsblatt.');
    // Keep only the actual runsheet tab; helper tabs often carry artifacts that trigger Excel repair dialogs.
    const sheetName = sheet.name;
    const removableSheetIds = workbook.worksheets
        .filter((ws) => ws.name !== sheetName)
        .map((ws) => ws.id);
    removableSheetIds.forEach((id) => workbook.removeWorksheet(id));
    sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
    if (!sheet) throw new Error('Ablaufplan-Arbeitsblatt konnte nicht erhalten werden.');

    // Remove media blobs that are no longer referenced after helper sheets are dropped.
    const usedImageIds = new Set(
        (Array.isArray(sheet.model?.media) ? sheet.model.media : [])
            .map((entry) => Number(entry?.imageId))
            .filter((id) => Number.isInteger(id) && id >= 0)
    );
    if (Array.isArray(workbook.model?.media) && usedImageIds.size > 0) {
        workbook.model.media = workbook.model.media.filter((mediaEntry) => usedImageIds.has(Number(mediaEntry?.index)));
    }
    if (Array.isArray(workbook.media) && usedImageIds.size > 0) {
        workbook.media = workbook.media.filter((_, index) => usedImageIds.has(index));
    }

    applySheetMapping({ sheet, runSheetData });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await selfCheckWorkbookBuffer(buffer);
    return buffer;
};

const generateFallbackBuffer = async ({ plan, runSheetData }) => {
    const workbook = buildCleanWorkbook({ plan, runSheetData });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await selfCheckWorkbookBuffer(buffer);
    return buffer;
};

export const generateRunSheetBuffer = async ({ plan, usersByUsername = new Map() }) => {
    const runSheetData = buildRunSheetData(plan, usersByUsername);
    let buffer;
    let mode = 'clean-template';
    const useLegacyTemplate = String(process.env.RUNSHEET_USE_LEGACY_TEMPLATE || '').trim() === '1';
    if (useLegacyTemplate && hasRunSheetTemplate()) {
        try {
            buffer = await generateTemplateBuffer({ plan, runSheetData });
            mode = 'legacy-template';
        } catch (templateErr) {
            console.error('RUNSHEET: Vorlage fehlgeschlagen, nutze Fallback:', templateErr?.message || templateErr);
            buffer = await generateFallbackBuffer({ plan, runSheetData });
            mode = 'clean-template';
        }
    } else {
        buffer = await generateFallbackBuffer({ plan, runSheetData });
        mode = 'clean-template';
    }
    return {
        buffer,
        fileName: buildFileName(plan),
        assignedUsernames: extractAssignedUsers(plan),
        mode
    };
};
