import { describe, it, expect, beforeEach } from 'vitest';
import { User, Role } from '../services/db.service.js';

describe('User notification defaults', () => {
  let userRole;

  beforeEach(async () => {
    await User.deleteMany({});
    await Role.deleteMany({});
    userRole = await Role.create({ name: 'USER' });
  });

  it('enables WhatsApp by default for first-login planner notifications', async () => {
    const user = await User.create({
      username: 'notif_default_user',
      firstName: 'Default',
      lastName: 'Notif',
      RoleIds: [userRole._id]
    });

    expect(user.notifications.plan_assigned.whatsapp).toBe(true);
    expect(user.notifications.plan_reminder.whatsapp).toBe(true);
    expect(user.notifications.plan_changed.whatsapp).toBe(true);
    expect(user.notifications.substitute_request.whatsapp).toBe(true);
  });
});
