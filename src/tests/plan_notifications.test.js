import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateEntry } from '../services/sheet.service.js';
import { MusicPlan, User, Notification } from '../services/db.service.js';
import notifyService from '../services/notify.service.js';

vi.mock('../services/notify.service.js', () => ({
    default: {
        notifyUser: vi.fn().mockResolvedValue({})
    }
}));

describe('Plan Notifications', () => {
    beforeEach(async () => {
        await MusicPlan.deleteMany({});
        await User.deleteMany({});
        await Notification.deleteMany({});
        vi.clearAllMocks();
    });

    it('should send a notification when a user is assigned to a role via username', async () => {
        // Create user
        const user = await User.create({
            username: 'marcel',
            firstName: 'Marcel',
            lastName: 'Lohr',
            phone: '491734648795'
        });

        // Create plan entry
        const plan = await MusicPlan.create({
            Datum: '2026-02-20',
            Typ: 'Sonntag',
            Bass: ''
        });

        // Update entry with 'marcel' as Bass
        await updateEntry(null, plan._id.toString(), {
            Datum: '2026-02-20',
            Typ: 'Sonntag',
            Bass: 'marcel'
        });

        expect(notifyService.notifyUser).toHaveBeenCalledWith(
            user._id,
            'plan_assigned',
            expect.objectContaining({
                title: 'Neue Diensteinteilung',
                message: expect.stringContaining('Bass')
            })
        );
    });

    it('should NOT send a notification for non-username strings', async () => {
        const user = await User.create({
            username: 'marcel',
            firstName: 'Marcel',
            lastName: 'Lohr'
        });

        const plan = await MusicPlan.create({
            Datum: '2026-02-21',
            Bass: '?'
        });

        // This is a full name, but we now expect strict username
        await updateEntry(null, plan._id.toString(), {
            Datum: '2026-02-21',
            Bass: 'Marcel Lohr'
        });

        expect(notifyService.notifyUser).not.toHaveBeenCalled();
    });
});
