import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Post, Role, Tool, Notification } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Post Mentions & Single View API', () => {
    let user1, user2, token1;

    beforeEach(async () => {
        user1 = await User.create({ username: 'sender', firstName: 'Sender', lastName: 'User' });
        user2 = await User.create({ username: 'target', firstName: 'Target', lastName: 'User' });
        token1 = await generateToken(user1);

        // Ensure user has permissions for HOME tool
        const homeTool = await Tool.create({ key: 'HOME', name: 'Home' });
        const adminRole = await Role.create({ name: 'ADMIN' });
        user1.RoleIds.push(adminRole._id);
        await user1.save();
    });

    it('should fetch a single post with author and comments', async () => {
        const post = await Post.create({ 
            content: 'Test Post', 
            author: user1._id 
        });

        const res = await request(app)
            .get(`/api/wall/${post._id}`)
            .set('Authorization', `Bearer ${token1}`);
        
        expect(res.status).toBe(200);
        expect(res.body.content).toBe('Test Post');
        expect(res.body.author.username).toBe('sender');
    });

    it('should detect mentions in comments and notify mentioned user', async () => {
        const post = await Post.create({ content: 'Main Post', author: user1._id });

        const res = await request(app)
            .post(`/api/wall/${post._id}/comment`)
            .set('Authorization', `Bearer ${token1}`)
            .send({ content: 'Hello @target check this out' });
        
        expect(res.status).toBe(200);

        const notification = await Notification.findOne({ UserId: user2._id, type: 'wall_mention' });
        expect(notification).toBeDefined();
        expect(notification.message).toContain('Sender hat dich erwähnt');
    });

    it('should allow liking a comment', async () => {
        const post = await Post.create({ 
            content: 'Main Post', 
            author: user1._id,
            comments: [{ content: 'Cool', author: user2._id }]
        });
        const commentId = post.comments[0]._id;

        const res = await request(app)
            .post(`/api/wall/${post._id}/comments/${commentId}/like`)
            .set('Authorization', `Bearer ${token1}`);
        
        expect(res.status).toBe(200);
        expect(res.body.likes).toContain(user1._id.toString());
    });
});
