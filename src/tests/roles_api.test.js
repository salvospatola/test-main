import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Roles & Permissions API', () => {
    let adminToken;
    let testRole;
    let testTool;

    beforeEach(async () => {
        // Setup Admin
        const adminRole = await Role.findOneAndUpdate({ name: 'ADMIN' }, { name: 'ADMIN' }, { upsert: true, new: true });
        const adminUser = await User.create({
            username: 'role_admin',
            firstName: 'Admin',
            lastName: 'User',
            RoleIds: [adminRole._id]
        });
        const populatedAdmin = await User.findById(adminUser._id).populate('RoleIds');
        adminToken = await generateToken(populatedAdmin);

        // Setup Test Data
        testRole = await Role.create({ name: 'TEST_ROLE' });
        testTool = await Tool.create({ key: 'TEST_TOOL', name: 'Test Tool' });
        
        await ToolPermission.create({
            RoleId: testRole._id,
            ToolId: testTool._id,
            canView: true,
            canEdit: false
        });
    });

    it('GET /api/roles should return roles with mapped permissions', async () => {
        const res = await request(app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        const role = res.body.find(r => r.name === 'TEST_ROLE');
        expect(role).toBeTruthy();
        expect(role.permissions).toHaveLength(1);
        expect(role.permissions[0].toolId).toBe(testTool._id.toString());
        expect(role.permissions[0].canView).toBe(true);
        expect(role.permissions[0].canEdit).toBe(false);
    });

    it('PUT /api/roles/:id should update permissions correctly', async () => {
        const updatedPerms = [
            {
                toolId: testTool._id.toString(),
                canView: true,
                canEdit: true
            }
        ];

        const putRes = await request(app)
            .put(`/api/roles/${testRole._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ permissions: updatedPerms });

        expect(putRes.status).toBe(200);

        // Verify update
        const getRes = await request(app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${adminToken}`);
        
        const role = getRes.body.find(r => r.name === 'TEST_ROLE');
        expect(role.permissions[0].canEdit).toBe(true);
    });
});
