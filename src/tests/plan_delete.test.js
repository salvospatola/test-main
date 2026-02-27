import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, MusicPlan, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Backend: Music Planer Deletion', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        const adminRole = await Role.create({ name: 'ADMIN' });
        const planTool = await Tool.create({ key: 'MUSIC_PLANER', name: 'Planer' });

        adminUser = await User.create({
            username: 'admin',
            firstName: 'Admin',
            RoleIds: [adminRole._id]
        });

        adminToken = await generateToken(adminUser);
    });

    it('should allow admin to delete a plan entry', async () => {
        const plan = await MusicPlan.create({ Datum: '2026-05-01', Thema: 'Test Delete' });
        const id = plan._id.toString();

        const res = await request(app)
            .delete(`/api/plan/${id}`)
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const check = await MusicPlan.findById(id);
        expect(check).toBeNull();
    });
});
