import nodemailer from 'nodemailer';

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const host = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || '';
const port = Number(process.env.SMTP_PORT || 587);
const secure = parseBool(process.env.SMTP_SECURE, port === 465);
const user = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || '';
const pass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS || '';
const fromEmail = process.env.SMTP_FROM_EMAIL || user || '';
const fromName = process.env.SMTP_FROM_NAME || 'EFG NSU Portal';

const isConfigured = Boolean(host && user && pass && fromEmail);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    })
  : null;

class EmailService {
  isReady() {
    return Boolean(transporter);
  }

  async send({ to, subject, text, html, attachments }) {
    if (!transporter) {
      return { skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
    }
    if (!to) {
      return { skipped: true, reason: 'MISSING_RECIPIENT' };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: subject || 'EFG NSU Portal',
        text: text || '',
        html: html || undefined,
        attachments: Array.isArray(attachments) ? attachments : undefined
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`EMAIL: SMTP send failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

const emailService = new EmailService();
export default emailService;
