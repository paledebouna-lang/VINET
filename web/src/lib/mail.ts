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
