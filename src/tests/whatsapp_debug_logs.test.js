import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { WhatsAppLog, User, Role } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('WhatsApp debug send logs endpoint', () => {
  let adminToken;

  beforeEach(async () => {
    await WhatsAppLog.deleteMany({});
    await User.deleteMany({});
    await Role.deleteMany({});

    const adminRole = await Role.create({ name: 'ADMIN' });
    const adminUser = await User.create({
      username: 'admin_debug',
      firstName: 'Admin',
      lastName: 'Debug',
      RoleIds: [adminRole._id]
    });

    adminToken = await generateToken(adminUser);
  });

  it('filters send logs by messageId', async () => {
    await WhatsAppLog.create({
      level: 'info',
      type: 'send',
      event: 'send_success',
      message: 'Send event: send_success',
      details: {
        messageId: 'msg-123',
        jid: '491701234567@s.whatsapp.net',
        input: '491701234567@s.whatsapp.net'
      }
    });

    await WhatsAppLog.create({
      level: 'info',
      type: 'send',
      event: 'send_success',
      message: 'Send event: send_success',
      details: {
        messageId: 'msg-999'
      }
    });

    const res = await request(app)
      .get('/api/whatsapp/debug-send-logs?messageId=msg-123')
      .set('Cookie', [`auth_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].details.messageId).toBe('msg-123');
  });

  it('returns 400 for invalid date filter', async () => {
    const res = await request(app)
      .get('/api/whatsapp/debug-send-logs?from=not-a-date')
      .set('Cookie', [`auth_token=${adminToken}`]);

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toContain('Zeitraum');
  });
});

