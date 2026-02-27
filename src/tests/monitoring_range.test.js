import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, SystemStat, ActivityLog, Role } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Monitoring History Date Range', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        await User.deleteMany({});
        await SystemStat.deleteMany({});
        await ActivityLog.deleteMany({});
        await Role.deleteMany({});

        const adminRole = await Role.create({ name: 'ADMIN', permissions: [] });
        adminUser = await User.create({
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            RoleIds: [adminRole._id]
        });
        adminToken = await generateToken(adminUser);

        // Create data for a specific day
        const targetDate = new Date('2026-02-13T05:00:00Z');
        await SystemStat.create({
            timestamp: targetDate,
            cpuUsage: 10,
            memoryUsage: 500
        });

        await ActivityLog.create({
            ip: '127.0.0.1',
            action: 'TEST',
            path: '/test',
            createdAt: targetDate
        });
    });

    it('should return data when start and end date are the same', async () => {
        const res = await request(app)
            .get('/api/monitoring/history')
            .query({ start: '2026-02-13', end: '2026-02-13' })
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.history.length).toBe(1);
        expect(res.body.peaks.hourlyTraffic).toBe(1);
    });

    it('should exclude data outside the range', async () => {
        const res = await request(app)
            .get('/api/monitoring/history')
            .query({ start: '2026-03-01', end: '2026-03-01' })
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.history.length).toBe(0);
        expect(res.body.peaks.hourlyTraffic).toBe(0);
    });
});
