import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Backend: User Management', () => {
    let adminToken, userToken;
    let adminUser, normalUser;
    let userMgmtTool;

    beforeEach(async () => {
        const adminRole = await Role.create({ name: 'ADMIN' });
        const userRole = await Role.create({ name: 'USER' });
        userMgmtTool = await Tool.create({ key: 'USER_MGMT', name: 'User Management' });

        adminUser = await User.create({ username: 'admin', firstName: 'Admin', RoleIds: [adminRole._id] });
        normalUser = await User.create({ username: 'user', firstName: 'Normal', RoleIds: [userRole._id] });

        adminToken = await generateToken(adminUser);
        userToken = await generateToken(normalUser);
    });

    it('should allow admin to list all users', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow admin to create a user', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Cookie', [`auth_token=${adminToken}`])
            .send({
                username: 'newguy',
                firstName: 'New',
                lastName: 'Guy'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const check = await User.findOne({ username: 'newguy' });
        expect(check).toBeTruthy();
        expect(check.firstName).toBe('New');
    });

    it('should allow users to update their own profile', async () => {
        const res = await request(app)
            .put('/api/auth/profile')
            .set('Cookie', [`auth_token=${userToken}`])
            .send({ firstName: 'UpdatedName' });

        expect(res.status).toBe(200);
        
        const check = await User.findById(normalUser._id);
        expect(check.firstName).toBe('UpdatedName');
    });

    it('should allow admin to delete a user', async () => {
        const res = await request(app)
            .delete(`/api/users/${normalUser._id}`)
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        const check = await User.findById(normalUser._id);
        expect(check).toBeNull();
    });
});
