import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { generateRunSheetBuffer } from '../services/runsheet.service.js';

describe('Runsheet generator', () => {
    it('creates a readable xlsx even when many fields are empty', async () => {
        const plan = {
            Datum: '2026-02-22',
            Typ: 'Gottesdienst',
            Uhrzeit: '',
            Thema: '',
            songs: []
        };

        const result = await generateRunSheetBuffer({ plan, usersByUsername: new Map() });
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.buffer.length).toBeGreaterThan(1000);
        expect(result.fileName).toContain('Ablaufplan-2026-02-22');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.buffer);
        expect(workbook.worksheets.length).toBeGreaterThan(0);
    });

    it('uses clean template mode and keeps key fields', async () => {
        const usersByUsername = new Map([
            ['prediger', { username: 'prediger', firstName: 'Max', lastName: 'Muster' }],
            ['leiter', { username: 'leiter', firstName: 'Anna', lastName: 'Leitung' }]
        ]);
        const plan = {
            Datum: '2026-03-01',
            Uhrzeit: '10:00 Uhr',
            Typ: 'Gottesdienst',
            Thema: 'Glaube und Hoffnung',
            Predigt: 'prediger',
            Leitung: 'leiter',
            songs: [{ number: '1', title: 'Lied A' }]
        };

        const result = await generateRunSheetBuffer({ plan, usersByUsername });
        expect(result.mode).toBe('clean-template');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.buffer);
        const sheet = workbook.getWorksheet('Ablaufplan');
        expect(sheet).toBeTruthy();
        expect(workbook.worksheets.length).toBe(1);
        expect((workbook.model?.media || []).length).toBe(0);
        expect(String(sheet.getCell('A1').value || '')).toContain('Gottesdienst Ablaufplan');
        expect(String(sheet.getCell('F7').value || '')).toContain('Glaube und Hoffnung');
        expect(String(sheet.getCell('F9').value || '')).toContain('Max Muster');
    });

    it('sanitizes control characters so workbook stays readable', async () => {
        const result = await generateRunSheetBuffer({
            plan: {
                Datum: '2026-03-08',
                Typ: 'Gottesdienst',
                Thema: 'Thema mit Steuerzeichen\u0001\u0002 Ende',
                Predigt: 'p1'
            },
            usersByUsername: new Map([['p1', { username: 'p1', firstName: 'Test\u0007', lastName: 'Prediger' }]])
        });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.buffer);
        const sheet = workbook.getWorksheet('Ablaufplan');
        expect(sheet).toBeTruthy();
        const topicCell = String(sheet.getCell('F7').value || '');
        expect(topicCell.includes('\u0001')).toBe(false);
        expect(topicCell.includes('\u0002')).toBe(false);
    });
});
