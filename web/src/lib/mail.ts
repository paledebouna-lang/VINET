import nodemailer from "nodemailer";

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

/**
 * Sends through the mailbox in SMTP_URL (LWS). Returns false, sending nothing,
 * when no mailbox is configured or the address is a phone account's placeholder.
 */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport || to.endsWith(".invalid")) return false;
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? "MonAuto <no-reply@monauto.org>",
    to,
    subject,
    text,
  });
  return true;
}

export const siteUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * A notification that fails must not undo the action it reports. Notifications never carry
 * the other party's contact details or a message's text: exchanges stay on the site.
 */
export const notify = (to: string, subject: string, text: string) =>
  sendMail(to, subject, text).catch((e) => console.error("notification e-mail failed", e));
