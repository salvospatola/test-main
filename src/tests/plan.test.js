import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, MusicPlan, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Backend: Music Planer (Core Logic)', () => {
    let adminToken;
    let userToken;
    let adminUser;
    let normalUser;

    beforeEach(async () => {
        // 1. Setup Roles
        const adminRole = await Role.create({ name: 'ADMIN' });
        const userRole = await Role.create({ name: 'USER' });

        // 2. Setup Tool (Critical for checkPermission!)
        const planTool = await Tool.create({ key: 'MUSIC_PLANER', name: 'Planer' });

        // 3. Setup Permissions
        // Admin gets auto-access via code logic, but let's be explicit if needed. 
        // User needs permissions to view.
        await ToolPermission.create({
            RoleId: userRole._id,
            ToolId: planTool._id,
            canView: true,
            canEdit: false
        });

        // 4. Setup Users
        adminUser = await User.create({
            username: 'admin',
            firstName: 'Admin',
            RoleIds: [adminRole._id]
        });
        normalUser = await User.create({
            username: 'user',
            firstName: 'User',
            RoleIds: [userRole._id]
        });

        // 5. Setup Tokens
        adminToken = await generateToken(adminUser);
        userToken = await generateToken(normalUser);
    });

    it('should prevent unauthorized access to create plan', async () => {
        const res = await request(app).post('/api/plan').send({ data: { Datum: '2026-12-24' } });
        expect(res.status).toBe(401);
    });

    it('should allow admin to create a new plan entry', async () => {
        const res = await request(app)
            .post('/api/plan')
            .set('Cookie', [`auth_token=${adminToken}`])
            .send({ 
                data: { 
                    Datum: '2026-12-24', 
                    Uhrzeit: '16:00',
                    Typ: 'Gottesdienst',
                    Thema: 'Weihnachten'
                } 
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const plan = await MusicPlan.findOne({ Datum: '2026-12-24' });
        expect(plan).toBeTruthy();
        expect(plan.Thema).toBe('Weihnachten');
    });

    it('should allow users to read the plan', async () => {
        await MusicPlan.create({ Datum: '2026-01-01', Thema: 'Neujahr' });

        const res = await request(app)
            .get('/api/plan')
            .set('Cookie', [`auth_token=${userToken}`]); // Normal User

        expect(res.status).toBe(200);
        expect(res.body.plan).toHaveLength(1);
        expect(res.body.plan[0].Thema).toBe('Neujahr');
    });

    it('should prevent normal users from updating the plan', async () => {
        const plan = await MusicPlan.create({ Datum: '2026-01-01', Thema: 'Original' });

        const res = await request(app)
            .put(`/api/plan/${plan._id}`)
            .set('Cookie', [`auth_token=${userToken}`])
            .send({ data: { Thema: 'Hacked' } });

        // Erwartet 403 Forbidden (da canEdit: false)
        expect(res.status).toBe(403);
        
        const check = await MusicPlan.findById(plan._id);
        expect(check.Thema).toBe('Original');
    });
    
    it('should validate date format on create', async () => {
         const res = await request(app)
            .post('/api/plan')
            .set('Cookie', [`auth_token=${adminToken}`])
            .send({ data: { Thema: 'Kein Datum' } }); // Datum fehlt
            
         // Should fail because Datum is now required: true
         expect(res.status).not.toBe(200); 
    });
});
