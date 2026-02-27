import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Team, GlobalTag } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Admin Team & Tag Management API', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        const adminRole = await Role.create({ name: 'ADMIN' });
        adminUser = await User.create({
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            RoleIds: [adminRole._id]
        });
        adminToken = await generateToken(adminUser);
    });

    it('should create a new team', async () => {
        const res = await request(app)
            .post('/api/teams')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Musik Team',
                positions: ['Bass', 'Gitarre'],
                description: 'Test Team'
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Musik Team');
        expect(res.body.positions).toContain('Bass');
    });

    it('should list teams', async () => {
        await Team.create({ name: 'Vorhanden', positions: ['Test'] });
        const res = await request(app)
            .get('/api/teams')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should create a global tag', async () => {
        const res = await request(app)
            .post('/api/admin/tags')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Fest' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Fest');
    });

    it('should list global tags including plan tags during initialization', async () => {
        const { MusicPlan, GlobalTag } = await import('../services/db.service.js');
        await GlobalTag.deleteMany({}); // Force re-initialization
        await MusicPlan.create({ Datum: '2026-05-01', tags: ['Ostern'] });

        const res = await request(app)
            .get('/api/admin/tags')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.some(t => t.name === 'Ostern')).toBe(true);
    });

    it('should remove tags from plans when a global tag is deleted', async () => {
        const { MusicPlan, GlobalTag } = await import('../services/db.service.js');
        await GlobalTag.create({ name: 'ZuLoeschen' });
        const plan = await MusicPlan.create({ Datum: '2026-06-01', tags: ['ZuLoeschen', 'Bleibt'] });

        const res = await request(app)
            .delete('/api/admin/tags/ZuLoeschen')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        const updatedPlan = await MusicPlan.findById(plan._id);
        expect(updatedPlan.tags).not.toContain('ZuLoeschen');
        expect(updatedPlan.tags).toContain('Bleibt');
    });

    it('should save team positions for a user', async () => {
        const team = await Team.create({ name: 'Musik', positions: ['Bass'] });
        const user = await User.create({ username: 'musiker1', firstName: 'Max' });
        
        const res = await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                firstName: 'Max',
                lastName: 'Mustermann',
                username: 'musiker1',
                teamPositions: [{ TeamId: team._id, position: 'Bass' }]
            });

        expect(res.status).toBe(200);
        const updatedUser = await User.findById(user._id);
        expect(updatedUser.teamPositions.length).toBe(1);
        expect(updatedUser.teamPositions[0].position).toBe('Bass');
    });
});
