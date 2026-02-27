import { describe, it, expect, vi, beforeEach } from 'vitest';
import notifyService from '../services/notify.service.js';
import { User, Role, Notification } from '../services/db.service.js';

describe('Admin Notifications Security', () => {
    beforeEach(async () => {
        await User.deleteMany({});
        await Role.deleteMany({});
        await Notification.deleteMany({});
    });

    it('should only send system alerts to admins', async () => {
        // Create Admin Role
        const adminRole = await Role.create({ name: 'ADMIN' });
        const userRole = await Role.create({ name: 'USER' });

        // Create Admin
        const admin = await User.create({
            username: 'admin',
            RoleIds: [adminRole._id],
            notifications: { security_alert: { app: true, whatsapp: false } }
        });

        // Create regular user
        const normalUser = await User.create({
            username: 'user',
            RoleIds: [userRole._id],
            notifications: { security_alert: { app: true, whatsapp: false } }
        });

        // Send admin notification
        await notifyService.notifyAdmins('security_alert', {
            title: 'Alert',
            message: 'Secret'
        });

        // Check notifications
        const adminNotifs = await Notification.find({ UserId: admin._id });
        const userNotifs = await Notification.find({ UserId: normalUser._id });

        expect(adminNotifs.length).toBe(1);
        expect(userNotifs.length).toBe(0);
    });
});
