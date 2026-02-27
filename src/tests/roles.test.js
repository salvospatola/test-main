import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Admin: Role & Permission Management', () => {
    let adminToken, adminUser;
    let testRole, testTool;

    beforeEach(async () => {
        // Setup Admin
        const adminRole = await Role.create({ name: 'ADMIN' });
        adminUser = await User.create({
            username: 'role_admin',
            firstName: 'Role',
            lastName: 'Admin',
            RoleIds: [adminRole._id]
        });
        adminToken = await generateToken(adminUser);

        // Setup Test Data
        testRole = await Role.create({ name: 'TEST_ROLE' });
        testTool = await Tool.create({ key: 'TEST_TOOL', name: 'Test Tool' });
    });

    it('GET /api/roles should include permissions for each role', async () => {
        // Create a permission
        await ToolPermission.create({
            RoleId: testRole._id,
            ToolId: testTool._id,
            canView: true,
            canEdit: false
        });

        const res = await request(app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        const role = res.body.find(r => r.name === 'TEST_ROLE');
        expect(role.permissions).toBeDefined();
        expect(role.permissions).toHaveLength(1);
        expect(role.permissions[0].toolId).toBe(testTool._id.toString());
        expect(role.permissions[0].canView).toBe(true);
    });

    it('PUT /api/roles/:id should update permissions for a role', async () => {
        const res = await request(app)
            .put(`/api/roles/${testRole._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                permissions: [
                    { toolId: testTool._id.toString(), canView: true, canEdit: true }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const perms = await ToolPermission.find({ RoleId: testRole._id });
        expect(perms).toHaveLength(1);
        expect(perms[0].canEdit).toBe(true);
    });
});
