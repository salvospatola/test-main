import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateToken } from '../services/auth.service.js';
import { Channel, MusicPlan, Post, Role, Tool, ToolPermission, User } from '../services/db.service.js';

describe('Global search API', () => {
  let memberToken;
  let member;

  beforeEach(async () => {
    const userRole = await Role.create({ name: 'USER' });
    await Role.create({ name: 'ADMIN' });

    const homeTool = await Tool.create({ key: 'HOME', name: 'Schwarzes Brett' });
    const planTool = await Tool.create({ key: 'MUSIC_PLANER', name: 'Dienstplaner' });

    await ToolPermission.create({ RoleId: userRole._id, ToolId: homeTool._id, canView: true, canEdit: true });
    await ToolPermission.create({ RoleId: userRole._id, ToolId: planTool._id, canView: true, canEdit: false });

    member = await User.create({ username: 'member_search', firstName: 'Mila', RoleIds: [userRole._id] });
    const author = await User.create({ username: 'author_search', firstName: 'Anton', RoleIds: [userRole._id] });
    const other = await User.create({ username: 'other_search', firstName: 'Ola', RoleIds: [userRole._id] });
    await User.create({ username: 'hidden_search', firstName: 'Hidden', status: 'HIDDEN', RoleIds: [userRole._id] });

    const publicChannel = await Channel.create({
      title: 'Alpha Public',
      description: 'Öffentlich',
      isPrivate: false,
      createdBy: author._id,
      moderators: [author._id],
      subscribers: [author._id, member._id]
    });

    const privateChannel = await Channel.create({
      title: 'Alpha Private',
      description: 'Privat',
      isPrivate: true,
      createdBy: other._id,
      moderators: [other._id],
      subscribers: [other._id]
    });

    await Post.create({ author: author._id, content: 'Alpha öffentlicher Post', channel: publicChannel._id });
    await Post.create({ author: other._id, content: 'Alpha privater Post', channel: privateChannel._id });

    await MusicPlan.create({ Datum: '2026-10-05', Thema: 'Alpha Thema', Predigt: 'member_search' });

    memberToken = await generateToken(member);
  });

  it('returns only accessible search results', async () => {
    const res = await request(app)
      .get('/api/search?q=Alpha')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(Array.isArray(res.body.posts)).toBe(true);

    const channelTitles = res.body.channels.map((item) => item.title);
    expect(channelTitles).toContain('Alpha Public');
    expect(channelTitles).not.toContain('Alpha Private');

    const postTitles = res.body.posts.map((item) => item.title);
    expect(postTitles.some((title) => title.includes('öffentlicher Post'))).toBe(true);
    expect(postTitles.some((title) => title.includes('privater Post'))).toBe(false);

    expect(res.body.plans.some((item) => item.title.includes('Alpha Thema'))).toBe(true);
    expect(res.body.users.some((item) => item.subtitle === '@hidden_search')).toBe(false);
  });

  it('returns empty payload for too-short query', async () => {
    const res = await request(app)
      .get('/api/search?q=a')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});
