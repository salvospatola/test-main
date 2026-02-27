import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledJob, MusicPlan, User, QuickAssignToken } from '../services/db.service.js';
import whatsappService from '../services/whatsapp.service.js';
import { triggerJobManually } from '../services/worker.service.js';

vi.mock('../services/whatsapp.service.js', () => ({
    default: {
        sendMessage: vi.fn().mockResolvedValue({ key: { id: '123' } })
    }
}));

describe('PLAN_UPDATE Automation Job', () => {
    beforeEach(async () => {
        await MusicPlan.deleteMany({});
        await User.deleteMany({});
        await ScheduledJob.deleteMany({});
        await QuickAssignToken.deleteMany({});
        vi.clearAllMocks();
    });

    it('should send plan update with one event link and open roles for next service with assigned Organisator', async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Create an entry for today (full)
        await MusicPlan.create({
            Datum: todayStr,
            Typ: 'Sonntag',
            Leitung: 'admin',
            TechnikPC: 'user1',
            TechnikSound: 'user2',
            Klavier: 'user3',
            Anbetungsstunde: 'user4',
            Organisator: 'user5'
        });

        // Create an entry for next week (open + Orga assigned)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        await MusicPlan.create({
            Datum: nextWeekStr,
            Typ: 'Sonntag',
            Organisator: 'orga_user',
            Leitung: '', // Open (not music role, but part of message)
            Klavier: '' // Open music role -> triggers notification
        });

        const job = await ScheduledJob.create({
            name: 'Music Plan Info',
            type: 'PLAN_UPDATE',
            params: { targetJid: '12345@g.us' },
            active: true
        });

        await triggerJobManually(job._id);

        expect(whatsappService.sendMessage).toHaveBeenCalledWith(
            '12345@g.us',
            expect.stringContaining('*Dienstplan Update:')
        );

        const callArgs = vi.mocked(whatsappService.sendMessage).mock.calls[0][1];
        expect(callArgs).toContain('👤 Leitung');
        expect(callArgs).toContain('🎹 Klavier');
        expect(callArgs).toContain('*Eintragen & Details:*');
        expect(callArgs).toMatch(/\/a\/[a-f0-9]{32}/);
        expect((callArgs.match(/\/a\/[a-f0-9]{32}/g) || []).length).toBe(1);
    });

    it('should NOT send if no Organisator is assigned', async () => {
        const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await MusicPlan.create({
            Datum: nextWeekStr,
            Typ: 'Sonntag',
            Organisator: '', // Missing Orga
            Klavier: '' // Open
        });

        const job = await ScheduledJob.create({
            name: 'Music Plan Info',
            type: 'PLAN_UPDATE',
            params: { targetJid: '12345@g.us' },
            active: true
        });

        await triggerJobManually(job._id);

        expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should NOT send if all music roles are filled', async () => {
        const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await MusicPlan.create({
            Datum: nextWeekStr,
            Typ: 'Sonntag',
            Organisator: 'orga_user',
            Leitung: '', // Open non-music role
            Klavier: 'user1',
            Gitarre: '/',
            Bass: '/',
            Schlagzeug: '/',
            Gesang1: '/',
            Gesang2: '/'
        });

        const job = await ScheduledJob.create({
            name: 'Music Plan Info',
            type: 'PLAN_UPDATE',
            params: { targetJid: '12345@g.us' },
            active: true
        });

        await triggerJobManually(job._id);

        expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should include Dienstag services if they have open music roles and Orga', async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        await MusicPlan.create({
            Datum: todayStr,
            Typ: 'Dienstag',
            Organisator: 'orga_user',
            Klavier: '' // Open
        });

        const job = await ScheduledJob.create({
            name: 'Music Plan Info',
            type: 'PLAN_UPDATE',
            params: { targetJid: '12345@g.us' },
            active: true
        });

        await triggerJobManually(job._id);

        expect(whatsappService.sendMessage).toHaveBeenCalledWith(
            '12345@g.us',
            expect.stringContaining('🎹 Klavier')
        );
    });
});
