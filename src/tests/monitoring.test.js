import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, ActivityLog, IPBan } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Backend: Monitoring & Intelligence', () => {
    let adminToken;

    beforeEach(async () => {
        const adminRole = await Role.create({ name: 'ADMIN' });
        const adminUser = await User.create({ username: 'monitor_admin', firstName: 'Admin', RoleIds: [adminRole._id] });
        adminToken = await generateToken(adminUser);
    });

    it('should return system stats for admin', async () => {
        const res = await request(app)
            .get('/api/monitoring/stats')
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('cpu');
        expect(res.body).toHaveProperty('memory');
        expect(res.body).toHaveProperty('security');
    });

    it('should correctly identify suspicious requests in security alerts', async () => {
        // Create a suspicious log entry
        await ActivityLog.create({
            action: 'ACCESS_ATTEMPT',
            path: '/.env', // Suspicious path
            severity: 'HIGH'
        });

        const res = await request(app)
            .get('/api/monitoring/stats')
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.security.alerts).toBeGreaterThanOrEqual(1);
    });

    it('should list IP bans', async () => {
        await IPBan.create({ ip: '8.8.8.8', reason: 'Google is not allowed here', attempts: 10 });

        const res = await request(app)
            .get('/api/monitoring/bans')
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].ip).toBe('8.8.8.8');
    });

    it('should allow admin to delete an IP ban', async () => {
        const ban = await IPBan.create({ ip: '1.2.3.4', reason: 'Test' });

        const res = await request(app)
            .delete(`/api/monitoring/bans/${ban._id}`)
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        const check = await IPBan.findById(ban._id);
        expect(check).toBeNull();
    });
});
