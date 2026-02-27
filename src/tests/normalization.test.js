import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User } from '../services/db.service.js';

describe('Phone Normalization Regression Tests', () => {
    afterAll(async () => {
        await User.deleteMany({ username: /normtest/ });
    });

    it('should find a user even if stored with different formatting', async () => {
        const testUser = new User({
            username: 'normtest1',
            firstName: 'Norm',
            lastName: 'Test',
            phone: '+491701234567' 
        });
        await testUser.save();

        const res = await request(app)
            .get('/api/auth/check-phone')
            .query({ phone: '+49 170 1234567' });

        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });

    it('should find a user stored with local format 0... when searching with E.164', async () => {
        const testUser2 = new User({
            username: 'normtest2',
            firstName: 'Norm',
            lastName: 'Test 2',
            phone: '01701234568' 
        });
        await testUser2.save();

        const res = await request(app)
            .get('/api/auth/check-phone')
            .query({ phone: '+491701234568' });

        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });
});
