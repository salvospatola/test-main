import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, ChatConversation, ChatMessage } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('Messenger API', () => {
    let user1, user2, token1;

    beforeEach(async () => {
        user1 = await User.create({ username: 'user1', firstName: 'U1', lastName: 'L1' });
        user2 = await User.create({ username: 'user2', firstName: 'U2', lastName: 'L2' });
        token1 = await generateToken(user1);
    });

    it('should list empty conversations initially', async () => {
        const res = await request(app)
            .get('/api/chat/conversations')
            .set('Authorization', `Bearer ${token1}`);
        
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should list conversations after a message is created', async () => {
        const conv = await ChatConversation.create({ participants: [user1._id, user2._id] });
        await ChatMessage.create({
            ConversationId: conv._id,
            SenderId: user1._id,
            content: 'Hello'
        });

        const res = await request(app)
            .get('/api/chat/conversations')
            .set('Authorization', `Bearer ${token1}`);
        
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].participants.length).toBe(2);
    });

    it('should fetch message history for a conversation', async () => {
        const conv = await ChatConversation.create({ participants: [user1._id, user2._id] });
        await ChatMessage.create({ ConversationId: conv._id, SenderId: user1._id, content: 'Msg 1' });
        await ChatMessage.create({ ConversationId: conv._id, SenderId: user2._id, content: 'Msg 2' });

        const res = await request(app)
            .get(`/api/chat/messages/${conv._id}`)
            .set('Authorization', `Bearer ${token1}`);
        
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].content).toBe('Msg 1');
        expect(res.body[1].content).toBe('Msg 2');
    });
});
