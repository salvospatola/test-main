import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, OTP, Role, Invite } from '../services/db.service.js';
import mongoose from 'mongoose';

describe('Login Flow & Normalization', () => {
    let userRole;

    beforeAll(async () => {
        userRole = await Role.findOneAndUpdate({ name: 'USER' }, { name: 'USER' }, { upsert: true, new: true });
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await OTP.deleteMany({});
        await Invite.deleteMany({});
    });

    it('should find user with normalized phone number', async () => {
        await User.create({
            username: 'marcel',
            firstName: 'Marcel',
            lastName: 'Lohr',
            phone: '491734648795',
            RoleIds: [userRole._id]
        });

        // Test with leading zero
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({ phone: '01734648795' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        const otp = await OTP.findOne({ phone: '491734648795' });
        expect(otp).toBeTruthy();
    });

    it('should find user by name if phone is not matched and link phone on verify', async () => {
        await User.create({
            username: 'lohrma',
            firstName: 'Marcel',
            lastName: 'Lohr',
            RoleIds: [userRole._id]
            // No phone yet
        });

        // Request OTP with name
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({ 
                phone: '01734648795', 
                firstName: 'Marcel', 
                lastName: 'Lohr' 
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const otp = await OTP.findOne({ phone: '491734648795' });
        expect(otp).toBeTruthy();
        expect(otp.firstName).toBe('Marcel');

        // Verify OTP
        const verifyRes = await request(app)
            .post('/api/auth/otp/verify')
            .send({ phone: '01734648795', code: otp.code });

        expect(verifyRes.status).toBe(200);
        
        const updatedUser = await User.findOne({ username: 'lohrma' });
        expect(updatedUser.phone).toBe('491734648795');
    });

    it('should return needsRegistration if user is not found by phone and no name provided', async () => {
        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({ phone: '01739999999' });

        expect(res.status).toBe(200);
        expect(res.body.needsRegistration).toBe(true);
    });

    it('should allow OTP request for first registration with a valid invite token', async () => {
        const invite = await Invite.create({
            token: 'valid-invite-token',
            expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        });

        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({
                phone: '01735555555',
                firstName: 'Neu',
                lastName: 'User',
                registerKey: invite.token
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const otp = await OTP.findOne({ phone: '491735555555' });
        expect(otp).toBeTruthy();
    });

    it('should reject OTP request with an expired invite token', async () => {
        await Invite.create({
            token: 'expired-invite-token',
            expiresAt: new Date(Date.now() - 60 * 1000)
        });

        const res = await request(app)
            .post('/api/auth/otp/request')
            .send({
                phone: '01736666666',
                firstName: 'Abgelaufen',
                lastName: 'Token',
                registerKey: 'expired-invite-token'
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Ungültig|abgelaufen/i);
    });
});
