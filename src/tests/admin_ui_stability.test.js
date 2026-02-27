import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, GlobalSetting, Invite, Tool } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Admin UI API Stability', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        let adminRole = await Role.findOne({ name: 'ADMIN' });
        if (!adminRole) adminRole = await Role.create({ name: 'ADMIN' });

        const userDoc = await User.create({
            username: 'stability_admin',
            firstName: 'Admin',
            lastName: 'Stability',
            phone: '49000000000',
            RoleIds: [adminRole._id]
        });
        adminUser = await User.findById(userDoc._id).populate('RoleIds');
        adminToken = await generateToken(adminUser);
    });

    it('GET /api/admin/security/config should return an object with registrationOpen', async () => {
        const res = await request(app)
            .get('/api/admin/security/config')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('registrationOpen');
        expect(typeof res.body.registrationOpen).toBe('boolean');
    });

    it('GET /api/admin/invites should return an array', async () => {
        const res = await request(app)
            .get('/api/admin/invites')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/admin/invites/generate should cap validity to max 7 days', async () => {
        const before = Date.now();
        const res = await request(app)
            .post('/api/admin/invites/generate')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ validDays: 30 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.invite).toBeTruthy();

        const expiresAt = new Date(res.body.invite.expiresAt).getTime();
        const maxExpected = before + 7 * 24 * 60 * 60 * 1000 + 60 * 1000;
        const minExpected = before + 6 * 24 * 60 * 60 * 1000;
        expect(expiresAt).toBeGreaterThan(minExpected);
        expect(expiresAt).toBeLessThanOrEqual(maxExpected);
    });

    it('GET /api/roles/tools should return an array of tools', async () => {
        const res = await request(app)
            .get('/api/roles/tools')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/monitoring/bans should return an array', async () => {
        const res = await request(app)
            .get('/api/monitoring/bans')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/roles should return an array', async () => {
        const res = await request(app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
