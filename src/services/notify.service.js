import { Notification, User } from './db.service.js';
import whatsappService from './whatsapp.service.js';
import emailService from './email.service.js';
import { logSystem } from './log.service.js';
import { notificationEvents } from '../app.js';

const WHATSAPP_DEFAULT_ON_TYPES = new Set([
    'plan_assigned',
    'plan_reminder',
    'plan_changed',
    'substitute_request'
]);

const getDefaultChannelsForType = (type) => ({
    app: true,
    whatsapp: WHATSAPP_DEFAULT_ON_TYPES.has(String(type || '').trim()),
    email: false
});

/**
 * Centralized Notification Service
 * Handles dispatching messages via In-App, WhatsApp and E-Mail based on user preferences.
 */
class NotifyService {
    /**
     * Notify a specific user
     * @param {string} userId - Target user ID
     * @param {string} type - Notification type (e.g., 'plan_assigned', 'wall_comment')
     * @param {Object} content - Notification content { title, message, link }
     */
    async notifyUser(userId, type, { title, message, link }) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            const prefs = {
                ...getDefaultChannelsForType(type),
                ...(user.notifications?.[type] || {})
            };

            // 1. Dispatch In-App Notification
            if (prefs.app) {
                const notif = await Notification.create({
                    UserId: user._id,
                    type,
                    title,
                    message,
                    link
                });
                
                // Emit event for real-time delivery
                notificationEvents.emit('notification', notif);
            }

            // 2. Dispatch WhatsApp Notification
            if (prefs.whatsapp && user.phone) {
                try {
                    const waMessage = `*${title}*

${message}${link ? `

Direkt ansehen:
${process.env.BASE_URL || 'http://localhost:5173'}${link}` : ''}`;
                    await whatsappService.sendMessage(user.phone, waMessage);
                } catch (waError) {
                    logSystem('NOTIFY', `WhatsApp dispatch failed for user ${user.username}: ${waError.message}`, 'WARNING');
                }
            }

            // 3. Dispatch E-Mail Notification
            if (prefs.email && user.email) {
                try {
                    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
                    const absoluteLink = link ? `${baseUrl}${link}` : '';
                    const text = `${message}${absoluteLink ? `\n\nDirekt ansehen:\n${absoluteLink}` : ''}`;
                    const html = `
                        <div style="font-family: Arial, sans-serif; color: #1f2937;">
                            <h2 style="margin-bottom: 8px;">${title}</h2>
                            <p style="margin-top: 0; white-space: pre-line;">${message}</p>
                            ${absoluteLink ? `<p><a href="${absoluteLink}">Direkt im Portal öffnen</a></p>` : ''}
                        </div>
                    `;
                    const result = await emailService.send({
                        to: user.email,
                        subject: title || 'EFG NSU Portal',
                        text,
                        html
                    });
                    if (result?.skipped === true) {
                        logSystem('NOTIFY', `Email dispatch skipped for ${user.username}: ${result.reason}`, 'DEBUG');
                    }
                } catch (mailError) {
                    logSystem('NOTIFY', `Email dispatch failed for user ${user.username}: ${mailError.message}`, 'WARNING');
                }
            }
        } catch (e) {
            logSystem('NOTIFY', `General notification error: ${e.message}`, 'ERROR');
        }
    }

    /**
     * Notify multiple users (e.g., for system alerts or global wall posts)
     * @param {Array|Object} filter - Mongoose filter for users
     * @param {string} type - Notification type
     * @param {Object} content - Content object
     */
    async notifyMany(filter, type, content) {
        try {
            const users = await User.find(filter);
            await Promise.all(users.map(u => this.notifyUser(u._id, type, content)));
        } catch (e) {
            logSystem('NOTIFY', `Bulk notification error: ${e.message}`, 'ERROR');
        }
    }

    /**
     * Special case: Notify Admin about system issues
     */
    async notifyAdmins(type, content) {
        await this.notifyMany({ RoleIds: { $in: await this.getAdminRoleIds() } }, type, content);
    }

    async getAdminRoleIds() {
        // Helper to find the role IDs for ADMIN
        const { Role } = await import('./db.service.js');
        const adminRole = await Role.findOne({ name: 'ADMIN' });
        return adminRole ? [adminRole._id] : [];
    }
}

const notifyService = new NotifyService();
export default notifyService;
