import 'server-only';

import nodemailer from 'nodemailer';

let transporter;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('your_') || value.startsWith('replace_with_')) {
    throw new Error(`${name} is not configured in .env.local.`);
  }
  return value;
}

export function getVageMailboxConfig() {
  const user = requiredEnv('GMAIL_USER').toLowerCase();
  const appPassword = requiredEnv('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  const contactTo = (process.env.VAGE_CONTACT_TO || user).trim().toLowerCase();

  if (!/^[^\s@]+@gmail\.com$/i.test(user)) {
    throw new Error('GMAIL_USER must be the dedicated VAGE Gmail address.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactTo)) {
    throw new Error('VAGE_CONTACT_TO must be a valid email address.');
  }
  if (appPassword.length !== 16) {
    throw new Error('GMAIL_APP_PASSWORD must be the 16-character Google App Password.');
  }

  return { user, appPassword, contactTo };
}

function getTransporter() {
  if (transporter) return transporter;

  const { user, appPassword } = getVageMailboxConfig();
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user,
      pass: appPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter;
}

export async function sendVageEmail({ to, subject, html, text, replyTo, messageId }) {
  const { user } = getVageMailboxConfig();
  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Email recipient is required.');

  const result = await getTransporter().sendMail({
    from: `VAGE Clothing <${user}>`,
    to: recipient,
    replyTo: replyTo || user,
    subject,
    html,
    text,
    ...(messageId ? { messageId } : {}),
  });

  return {
    messageId: result.messageId || messageId || null,
    accepted: result.accepted || [],
    rejected: result.rejected || [],
  };
}

export async function verifyVageMailbox() {
  await getTransporter().verify();
  const { user, contactTo } = getVageMailboxConfig();
  return { connected: true, sender: user, contactInbox: contactTo };
}
