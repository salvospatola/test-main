import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { Post, User, Role, initDatabase } from '../services/db.service.js';
import mongoose from 'mongoose';

describe('Image Optimization Integration', () => {
    let adminToken;
    let adminUser;

    beforeEach(async () => {
        await initDatabase();
        
        // Admin-Rolle finden oder im Notfall erstellen
        let adminRole = await Role.findOne({ name: 'ADMIN' });
        if (!adminRole) adminRole = await Role.create({ name: 'ADMIN' });
        
        const res = await request(app).get('/api/dev/mock-login');
        adminToken = res.body.token;
        
        await User.findOneAndUpdate({ username: 'e2e_admin' }, { RoleIds: [adminRole._id] });
        adminUser = await User.findOne({ username: 'e2e_admin' });
    });

    it('should process wall post images', async () => {
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        
        const res = await request(app)
            .post('/api/wall')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('images', buffer, 'test.png')
            .field('content', 'Test Image Post');

        expect(res.status).toBe(200);
        const postId = res.body._id;

        // Wir warten etwas länger und prüfen in einer Schleife (Retry-Logik für Async Worker)
        let optimized = false;
        for(let i=0; i<10; i++) {
            const post = await Post.findById(postId);
            if (post.optimizedAttachments && post.optimizedAttachments.length > 0) {
                optimized = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        expect(optimized).toBe(true);
    });

    it('should process profile image', async () => {
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        
        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('image', buffer, 'avatar.png');

        expect(res.status).toBe(200);

        let optimized = false;
        for(let i=0; i<10; i++) {
            const user = await User.findById(adminUser._id);
            if (user.optimizedProfileImage) {
                optimized = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        expect(optimized).toBe(true);
    });

    it.skip('should accept 2MB image upload without 413 error', async () => {
        // Create a 2MB buffer that looks like a JPEG header at least
        const largeBuffer = Buffer.alloc(2 * 1024 * 1024);
        largeBuffer[0] = 0xFF; largeBuffer[1] = 0xD8; // JPEG SOI
        largeBuffer[largeBuffer.length-2] = 0xFF; largeBuffer[largeBuffer.length-1] = 0xD9; // JPEG EOI
        
        const res = await request(app)
            .post('/api/wall')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('images', largeBuffer, { filename: 'large.jpg', contentType: 'image/jpeg' })
            .field('content', 'Large Image Test');

        expect(res.status).toBe(200);
    });
});
