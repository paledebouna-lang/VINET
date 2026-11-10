import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, phoneNumber } from "better-auth/plugins";
import nodemailer from "nodemailer";
import { prisma } from "./db";
import { normalizeCiPhone } from "./phone";

// E-mail goes out through SMTP (LWS mailbox) when SMTP_URL is set.
const mailer = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

// shortcut: SMS codes are only printed to the server log, no SMS provider is wired yet.
// Production refuses to send rather than leak codes into logs; wire the provider before launch.
async function deliverCode(channel: "sms" | "email", to: string, code: string) {
  if (channel === "email" && mailer) {
    await mailer.sendMail({
      from: process.env.MAIL_FROM ?? "MonAuto <no-reply@monauto.org>",
      to,
      subject: `${code} est votre code MonAuto`,
      text: `Votre code de connexion MonAuto : ${code}\n\nIl expire dans 5 minutes. Si vous n'avez rien demandé, ignorez ce message.`,
    });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`No ${channel} provider configured`);
  }
  console.log(`[dev] code ${channel} pour ${to} : ${code}`);
}

const otpSendLimit = { window: 60, max: 3 };

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      // input: false — a client can never choose its own role.
      role: { type: "string", defaultValue: "particulier", input: false },
    },
  },
  plugins: [
    phoneNumber({
      phoneNumberValidator: (phone) => normalizeCiPhone(phone) === phone,
      sendOTP: ({ phoneNumber: to, code }) => deliverCode("sms", to, code),
      signUpOnVerification: {
        // Accounts need an e-mail column; .invalid never routes anywhere.
        getTempEmail: (phone) => `${phone.slice(1)}@telephone.monauto.invalid`,
      },
    }),
    emailOTP({
      storeOTP: "hashed",
      sendVerificationOTP: ({ email, otp }) => deliverCode("email", email, otp),
    }),
  ],
  rateLimit: {
    // Stored in the database so the limit holds across server instances.
    storage: "database",
    customRules: {
      "/phone-number/send-otp": otpSendLimit,
      "/email-otp/send-verification-otp": otpSendLimit,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.auditLog.create({
            data: { action: "user.created", actorId: user.id },
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await prisma.auditLog.create({
            data: {
              action: "session.created",
              actorId: session.userId,
              ip: session.ipAddress,
            },
          });
        },
      },
    },
  },
});
