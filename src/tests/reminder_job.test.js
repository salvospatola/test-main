import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledJob, MusicPlan, User, Notification } from '../services/db.service.js';
import { initScheduler } from '../services/worker.service.js';
import notifyService from '../services/notify.service.js';

vi.mock('../services/notify.service.js', () => ({
    default: {
        notifyUser: vi.fn().mockResolvedValue({})
    }
}));

describe('24h Reminder Job', () => {
    beforeEach(async () => {
        await MusicPlan.deleteMany({});
        await User.deleteMany({});
        await ScheduledJob.deleteMany({});
        vi.clearAllMocks();
    });

    it('should send reminders for tomorrow services', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        // Create user
        const user = await User.create({
            username: 'technik_user',
            firstName: 'Technik',
            lastName: 'Pro'
        });

        // Create plan for tomorrow
        await MusicPlan.create({
            Datum: dateStr,
            Typ: 'Gottesdienst',
            TechnikPC: 'technik_user'
        });

        // Create the reminder job
        const job = await ScheduledJob.create({
            name: 'Check Reminders',
            type: 'CHECK_REMINDERS',
            cronExpression: '0 * * * *',
            active: true
        });

        // We can't easily wait for cron, so we manually trigger runJob logic
        // or just test the logic inside worker.service.js if we export it.
        // For now, I'll assume I've implemented it and test the outcome by calling triggerJobManually.
        const { triggerJobManually } = await import('../services/worker.service.js');
        await triggerJobManually(job._id);

        expect(notifyService.notifyUser).toHaveBeenCalledWith(
            expect.anything(),
            'plan_reminder',
            expect.objectContaining({
                title: expect.stringMatching(/erinnerung/i)
            })
        );
    });
});
