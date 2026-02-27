import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Post, Tool, ToolPermission, Notification } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';
import whatsappService from '../services/whatsapp.service.js';

// Mock WhatsApp Service to prevent actual API calls during tests
vi.mock('../services/whatsapp.service.js', () => ({
    default: {
        sendMessage: vi.fn().mockResolvedValue({ key: { id: 'mock-id' } }),
        isConnected: true,
        formatJid: (num) => `${num}@s.whatsapp.net`
    }
}));

describe('Backend: Community Wall (Social Logic)', () => {
    let adminToken, user1Token, user2Token;
    let adminUser, user1, user2;
    let homeTool;

    beforeEach(async () => {
        // 1. Setup Roles
        const adminRole = await Role.create({ name: 'ADMIN' });
        const userRole = await Role.create({ name: 'USER' });

        // 2. Setup HOME Tool & Permissions
        homeTool = await Tool.create({ key: 'HOME', name: 'Community Wall' });
        
        await ToolPermission.create({
            RoleId: userRole._id,
            ToolId: homeTool._id,
            canView: true,
            canEdit: true // Regular users can post on the wall
        });

        // 3. Setup Users
        adminUser = await User.create({ username: 'admin', firstName: 'Admin', RoleIds: [adminRole._id] });
        user1 = await User.create({ username: 'user1', firstName: 'User', lastName: 'One', phone: '491701111111', RoleIds: [userRole._id] });
        user2 = await User.create({ username: 'user2', firstName: 'User Two', lastName: 'Two', RoleIds: [userRole._id] });

        // 4. Setup Tokens
        adminToken = await generateToken(adminUser);
        user1Token = await generateToken(user1);
        user2Token = await generateToken(user2);
    });

    it('should allow a user to create a text post', async () => {
        const res = await request(app)
            .post('/api/wall')
            .set('Cookie', [`auth_token=${user1Token}`])
            .send({ content: 'Hello Community!' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Hello Community!');
        expect(res.body.author.username).toBe('user1');

        const post = await Post.findOne({ content: 'Hello Community!' });
        expect(post).toBeTruthy();
    });

    it('should block empty posts', async () => {
        const res = await request(app)
            .post('/api/wall')
            .set('Cookie', [`auth_token=${user1Token}`])
            .send({ content: '' });

        expect(res.status).toBe(400);
    });

    it('should allow voting on post polls', async () => {
        const post = await Post.create({
            content: 'Poll',
            author: user1._id,
            poll: {
                question: 'Option?',
                multiple: false,
                options: [{ label: 'A' }, { label: 'B' }],
                votes: []
            }
        });

        const optionId = post.poll.options[0]._id.toString();
        const res = await request(app)
            .post(`/api/wall/${post._id}/poll/vote`)
            .set('Cookie', [`auth_token=${user2Token}`])
            .send({ optionIds: [optionId] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.poll.votes).toHaveLength(1);
    });

    it('should allow users to like a post and notify the author', async () => {
        // user1 creates a post
        const post = await Post.create({ content: 'Like me!', author: user1._id });

        // user2 likes the post
        const res = await request(app)
            .post(`/api/wall/${post._id}/like`)
            .set('Cookie', [`auth_token=${user2Token}`]);

        expect(res.status).toBe(200);
        expect(res.body.likes).toContain(user2._id.toString());

        // Wait a bit for async notification
        await new Promise(r => setTimeout(r, 100));

        // Check if user1 (author) received a notification
        const notif = await Notification.findOne({ UserId: user1._id, type: 'wall_like' });
        expect(notif).toBeTruthy();
        expect(notif.message).toContain('User Two gefällt dein Beitrag');
    });

    it('should allow users to unlike a post', async () => {
        const post = await Post.create({ 
            content: 'Unlike me!', 
            author: user1._id, 
            likes: [user2._id] 
        });

        const res = await request(app)
            .post(`/api/wall/${post._id}/like`)
            .set('Cookie', [`auth_token=${user2Token}`]);

        expect(res.status).toBe(200);
        expect(res.body.likes).not.toContain(user2._id.toString());
    });

    it('should allow users to comment on a post and notify the author', async () => {
        const post = await Post.create({ content: 'Comment on me!', author: user1._id });

        const res = await request(app)
            .post(`/api/wall/${post._id}/comment`)
            .set('Cookie', [`auth_token=${user2Token}`])
            .send({ content: 'This is a comment' });

        expect(res.status).toBe(200);
        expect(res.body.comments).toHaveLength(1);
        expect(res.body.comments[0].content).toBe('This is a comment');

        // Wait a bit for async notification
        await new Promise(r => setTimeout(r, 100));

        // Notification check
        const notif = await Notification.findOne({ UserId: user1._id, type: 'wall_comment' });
        expect(notif).toBeTruthy();
    });

    it('should allow users to delete their own posts', async () => {
        const post = await Post.create({ content: 'My post', author: user1._id });

        const res = await request(app)
            .delete(`/api/wall/${post._id}`)
            .set('Cookie', [`auth_token=${user1Token}`]);

        expect(res.status).toBe(200);
        const check = await Post.findById(post._id);
        expect(check).toBeNull();
    });

    it('should prevent users from deleting others posts', async () => {
        const post = await Post.create({ content: 'Not yours', author: user1._id });

        const res = await request(app)
            .delete(`/api/wall/${post._id}`)
            .set('Cookie', [`auth_token=${user2Token}`]);

        expect(res.status).toBe(403);
        const check = await Post.findById(post._id);
        expect(check).toBeTruthy();
    });

    it('should allow admin to fully delete any post', async () => {
        const post = await Post.create({ content: 'Admin remove this', author: user1._id });

        const res = await request(app)
            .delete(`/api/wall/${post._id}`)
            .set('Cookie', [`auth_token=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.deleted).toBe(true);

        const check = await Post.findById(post._id);
        expect(check).toBeNull();
    });
});
