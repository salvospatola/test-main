import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateToken } from '../services/auth.service.js';
import { MusicPlan, Notification, PlanSlotConfig, Role, Team, Tool, ToolPermission, User } from '../services/db.service.js';

describe('Plan slot rules and substitution routing', () => {
  let admin;
  let adminToken;
  let preacher;
  let preacherToken;
  let helper;
  let guest;
  let outsider;
  let predigtTeam;

  beforeEach(async () => {
    const adminRole = await Role.create({ name: 'ADMIN' });
    const userRole = await Role.create({ name: 'USER' });

    const planTool = await Tool.create({ key: 'MUSIC_PLANER', name: 'Dienstplaner' });
    await ToolPermission.create({
      RoleId: userRole._id,
      ToolId: planTool._id,
      canView: true,
      canEdit: false
    });

    predigtTeam = await Team.create({ name: 'Predigtteam', positions: ['Prediger', 'Gast-Prediger'] });

    admin = await User.create({ username: 'admin_slot', firstName: 'Admin', RoleIds: [adminRole._id] });
    preacher = await User.create({
      username: 'prediger1',
      firstName: 'Paul',
      RoleIds: [userRole._id],
      teamPositions: [{ TeamId: predigtTeam._id, position: 'Prediger' }]
    });
    helper = await User.create({
      username: 'prediger2',
      firstName: 'Petra',
      RoleIds: [userRole._id],
      teamPositions: [{ TeamId: predigtTeam._id, position: 'Prediger' }]
    });
    guest = await User.create({
      username: 'gastprediger',
      firstName: 'Gast',
      RoleIds: [userRole._id],
      teamPositions: [{ TeamId: predigtTeam._id, position: 'Gast-Prediger' }]
    });
    outsider = await User.create({ username: 'outsider', firstName: 'Out', RoleIds: [userRole._id] });

    adminToken = await generateToken(admin);
    preacherToken = await generateToken(preacher);

    await PlanSlotConfig.findOneAndUpdate(
      { roleKey: 'Predigt' },
      {
        roleKey: 'Predigt',
        label: 'Predigt',
        allowOnlyAssignedRequester: true,
        editableFields: ['Thema'],
        targetRules: [
          { mode: 'INCLUDE', TeamId: predigtTeam._id, positions: ['Prediger'] },
          { mode: 'EXCLUDE', TeamId: predigtTeam._id, positions: ['Gast-Prediger'] }
        ]
      },
      { upsert: true }
    );
  });

  it('allows admin to update a slot config via api', async () => {
    const res = await request(app)
      .put('/api/admin/plan-slots/TechnikSound')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        allowOnlyAssignedRequester: false,
        editableFields: [],
        targetRules: [{ mode: 'INCLUDE', TeamId: predigtTeam._id, positions: ['Prediger'] }]
      });

    expect(res.status).toBe(200);
    expect(res.body.slot.roleKey).toBe('TechnikSound');
    expect(res.body.slot.allowOnlyAssignedRequester).toBe(false);
  });

  it('returns substitute candidates filtered by include/exclude rules', async () => {
    const plan = await MusicPlan.create({ Datum: '2026-07-07', Predigt: preacher.username });

    const res = await request(app)
      .get(`/api/plan/${plan._id}/substitute/candidates`)
      .query({ roleKey: 'Predigt' })
      .set('Authorization', `Bearer ${preacherToken}`);

    expect(res.status).toBe(200);
    const usernames = res.body.users.map((u) => u.username);
    expect(usernames).toContain(helper.username);
    expect(usernames).not.toContain(guest.username);
    expect(usernames).not.toContain(preacher.username);
  });

  it('sends notifications only to resolved recipients for substitute requests', async () => {
    const plan = await MusicPlan.create({ Datum: '2026-07-14', Predigt: preacher.username });

    const res = await request(app)
      .post(`/api/plan/${plan._id}/substitute`)
      .set('Authorization', `Bearer ${preacherToken}`)
      .send({ roleKey: 'Predigt', message: 'Bitte übernehmen' });

    expect(res.status).toBe(200);

    // notifyUser läuft asynchron; kurz warten bis die Notification persisted ist.
    await new Promise((resolve) => setTimeout(resolve, 80));
    const allNotifications = await Notification.find({ type: 'substitute_request' });
    const targetUserIds = allNotifications.map((n) => String(n.UserId));

    expect(targetUserIds).toContain(String(helper._id));
    expect(targetUserIds).not.toContain(String(guest._id));
    expect(targetUserIds).not.toContain(String(outsider._id));
  });

  it('allows assigned preacher to update topic without plan edit permission', async () => {
    const plan = await MusicPlan.create({ Datum: '2026-08-01', Predigt: preacher.username, Thema: 'Alt' });

    const res = await request(app)
      .patch(`/api/plan/${plan._id}/topic`)
      .set('Authorization', `Bearer ${preacherToken}`)
      .send({ Thema: 'Neues Thema' });

    expect(res.status).toBe(200);
    const updated = await MusicPlan.findById(plan._id);
    expect(updated.Thema).toBe('Neues Thema');
  });
});
