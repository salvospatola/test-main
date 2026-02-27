import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, initDatabase } from '../services/db.service.js';

describe('Smart User Matching', () => {
    beforeEach(async () => {
        await initDatabase();
        let userRole = await Role.findOne({ name: 'USER' });
        if (!userRole) userRole = await Role.create({ name: 'USER' });

        await User.deleteMany({}); // Sauberer Start

        await User.create({
            username: 'existing_member',
            firstName: 'Max',
            lastName: 'Mustermann',
            phone: '491701111111',
            RoleIds: [userRole._id]
        });
        
        await User.create({
            username: 'member_no_phone',
            firstName: 'Erika',
            lastName: 'Musterfrau',
            RoleIds: [userRole._id]
        });
    });

    it('should find user by name if phone does not match', async () => {
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({
                phone: '01702222222',
                firstName: 'Erika',
                lastName: 'Musterfrau'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should be case-insensitive when matching names', async () => {
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({
                phone: '01702222222',
                firstName: 'erika',
                lastName: 'MUSTERFRAU'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should require registration data if neither phone nor name matches', async () => {
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({
                phone: '01703333333'
            });

        expect(res.status).toBe(200);
        expect(res.body.needsRegistration).toBe(true);
    });
});
