import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { ScheduledJob, User, Role } from '../services/db.service.js';
import mongoose from 'mongoose';

describe('Jobs API', () => {
    let adminToken;

    beforeEach(async () => {
        const adminRole = await Role.findOneAndUpdate({ name: 'ADMIN' }, { name: 'ADMIN' }, { upsert: true, new: true });
        
        const loginRes = await request(app).get('/api/dev/mock-login');
        adminToken = loginRes.body.token;
    });

    afterAll(async () => {
        await User.deleteMany({ username: 'e2e_admin' });
        await ScheduledJob.deleteMany({});
    });

    it('should allow admin to create a scheduled job', async () => {
        const res = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test Task',
                type: 'SIMPLE_MESSAGE',
                mode: 'once',
                executionTime: new Date(Date.now() + 100000).toISOString(),
                params: { number: '49123456789', message: 'Hello' }
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.job.name).toBe('Test Task');
    });

    it('should allow admin to list all jobs', async () => {
        // Create a job because global beforeEach wipes DB
        await ScheduledJob.create({
            name: 'Existing Job',
            type: 'SIMPLE_MESSAGE',
            mode: 'once',
            executionTime: new Date(Date.now() + 100000).toISOString()
        });

        const res = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should prevent unauthorized access to jobs', async () => {
        const res = await request(app).get('/api/jobs');
        expect(res.status).toBe(401);
    });
});
