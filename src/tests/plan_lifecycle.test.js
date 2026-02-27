import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, MusicPlan, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Integration: Music Planer Life Cycle', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        const adminRole = await Role.create({ name: 'ADMIN' });
        const planTool = await Tool.create({ key: 'MUSIC_PLANER', name: 'Planer' });

        adminUser = await User.create({
            username: 'admin_int',
            firstName: 'Admin',
            RoleIds: [adminRole._id]
        });

        adminToken = await generateToken(adminUser);
    });

    it('should create, read, and delete a plan entry', async () => {
        // 1. Create
        const createRes = await request(app)
            .post('/api/plan')
            .set('Cookie', [`auth_token=${adminToken}`])
            .send({ data: { Datum: '2026-06-01', Thema: 'Lifecycle Test' } });
        expect(createRes.status).toBe(200);

        // 2. Read to get ID
        const readRes = await request(app)
            .get('/api/plan')
            .set('Cookie', [`auth_token=${adminToken}`]);
        
        const entry = readRes.body.plan.find(p => p.Thema === 'Lifecycle Test');
        expect(entry).toBeTruthy();
        const id = entry.id || entry._id;
        expect(id).toBeTypeOf('string');

        // 3. Delete
        const deleteRes = await request(app)
            .delete(`/api/plan/${id}`)
            .set('Cookie', [`auth_token=${adminToken}`]);
        expect(deleteRes.status).toBe(200);

        // 4. Verify deletion
        const finalReadRes = await request(app)
            .get('/api/plan')
            .set('Cookie', [`auth_token=${adminToken}`]);
        const check = finalReadRes.body.plan.find(p => p.Thema === 'Lifecycle Test');
        expect(check).toBeUndefined();
    });
});
