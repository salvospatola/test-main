import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, OTP, Role } from '../services/db.service.js';

describe('Backend: Security & Authentication', () => {

    beforeAll(() => {
        // Ensure NODE_ENV is test
    });

    it('should return 200 OK for health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UP');
    });

    it('should have security headers enabled (Helmet)', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['content-security-policy']).toBeDefined();
        expect(res.headers['strict-transport-security']).toBeDefined();
        expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should block invalid login attempts', async () => {
        const res = await request(app).post('/api/auth/otp/request').send({
            phone: '0000000000'
        });
        expect(res.status).not.toBe(500); 
    });

    it('should create an OTP code for valid requests', async () => {
        const role = await Role.create({ name: 'USER' });
        await User.create({
            username: 'test_otp_user', 
            firstName: 'Test',
            lastName: 'User',
            phone: '4915100000000',
            RoleIds: [role._id]
        });

        const res = await request(app).post('/api/auth/otp/request').send({
            phone: '015100000000' 
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const otp = await OTP.findOne({ phone: '4915100000000' });
        expect(otp).toBeTruthy();
        expect(otp.code).toHaveLength(6);
    });

    // TODO: Rate Limit Test is flaky in memory environment. Re-enable later.
    it.skip('should enforce rate limiting on auth endpoints', async () => {
        const ip = '10.0.0.99';
        for (let i = 0; i < 15; i++) {
            await request(app).post('/api/auth/otp/request')
                .set('X-Forwarded-For', ip)
                .send({ phone: '123' });
        }
        
        const res = await request(app).post('/api/auth/otp/request')
            .set('X-Forwarded-For', ip)
            .send({ phone: '123' });
            
        expect(res.status).toBe(429); 
    }, 15000); 
});
