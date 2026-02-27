import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { User, Role, Tool, ToolPermission } from '../services/db.service.js';
import { generateToken } from '../services/auth.service.js';

describe('QA: Access Matrix Security', () => {
  let adminToken;
  let userToken;
  let memberToken;

  beforeEach(async () => {
    const adminRole = await Role.create({ name: 'ADMIN' });
    const userRole = await Role.create({ name: 'USER' });
    const memberRole = await Role.create({ name: 'MEMBER' });

    const channelsTool = await Tool.create({ key: 'CHANNELS', name: 'Meine Kanäle' });
    const messengerTool = await Tool.create({ key: 'MESSENGER', name: 'Messenger' });

    // USER: channels yes, messenger no
    await ToolPermission.create({ RoleId: userRole._id, ToolId: channelsTool._id, canView: true, canEdit: false });
    await ToolPermission.create({ RoleId: userRole._id, ToolId: messengerTool._id, canView: false, canEdit: false });

    // MEMBER: messenger yes, channels no
    await ToolPermission.create({ RoleId: memberRole._id, ToolId: channelsTool._id, canView: false, canEdit: false });
    await ToolPermission.create({ RoleId: memberRole._id, ToolId: messengerTool._id, canView: true, canEdit: false });

    const adminUser = await User.create({ username: 'qa_admin', firstName: 'QA', lastName: 'Admin', RoleIds: [adminRole._id] });
    const userUser = await User.create({ username: 'qa_user', firstName: 'QA', lastName: 'User', RoleIds: [userRole._id] });
    const memberUser = await User.create({ username: 'qa_member', firstName: 'QA', lastName: 'Member', RoleIds: [memberRole._id] });

    adminToken = await generateToken(await User.findById(adminUser._id).populate('RoleIds'));
    userToken = await generateToken(await User.findById(userUser._id).populate('RoleIds'));
    memberToken = await generateToken(await User.findById(memberUser._id).populate('RoleIds'));
  });

  it('blocks non-admin from admin roles endpoint', async () => {
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin on admin roles endpoint', async () => {
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('enforces messenger permissions per role', async () => {
    const denied = await request(app).get('/api/chat/conversations').set('Authorization', `Bearer ${userToken}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app).get('/api/chat/conversations').set('Authorization', `Bearer ${memberToken}`);
    expect(allowed.status).toBe(200);
  });

  it('enforces channels permissions per role', async () => {
    const allowed = await request(app).get('/api/channels').set('Authorization', `Bearer ${userToken}`);
    expect(allowed.status).toBe(200);

    const denied = await request(app).get('/api/channels').set('Authorization', `Bearer ${memberToken}`);
    expect(denied.status).toBe(403);
  });
});

