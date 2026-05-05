import nodemailer from 'nodemailer';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sends via SMTP when `SMTP_HOST` is set. Otherwise logs once in development (no throw).
 */
export async function sendTransactionalEmail(payload: MailPayload): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? '587');
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM?.trim() ?? user ?? 'noreply@localhost';

  if (!host) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[email] SMTP_HOST not set — skipping send to ${payload.to}: ${payload.subject}`
      );
    } else {
      console.warn('[email] SMTP_HOST missing; cannot send quota alert in production.');
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}
