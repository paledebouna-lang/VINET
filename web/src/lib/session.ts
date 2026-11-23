import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";

const currentSession = async () => auth.api.getSession({ headers: await headers() });

// Accounts that may use the code of an authenticator app on top of the e-mail code, once per session.
// For admins it is required; for agencies it is their choice, and required once they turn it on.
const SECOND_FACTOR_ROLES = ["admin", "agence"];

/**
 * The account and whether its second factor is still to be typed in this session. An admin acts as
 * an ordinary account until then; an agency that turned the second factor on has no access at all,
 * since what it holds (its fleet's positions, its customers' documents) is what the factor protects.
 */
async function resolveUser() {
  const session = await currentSession();
  if (!session) return null;
  const { user } = session;
  if (SECOND_FACTOR_ROLES.includes(user.role)) {
    const [verified, mfa] = await Promise.all([
      prisma.session.findUnique({ where: { id: session.session.id }, select: { mfaVerifiedAt: true } }),
      user.role === "agence" ? prisma.adminMfa.findUnique({ where: { userId: user.id }, select: { sealedSecret: true } }) : null,
    ]);
    const required = user.role === "admin" || Boolean(mfa?.sealedSecret);
    if (required && !verified?.mfaVerifiedAt) {
      return { user: { ...user, role: "particulier", adminPending: user.role === "admin" }, agencyPending: user.role === "agence" };
    }
  }
  return { user: { ...user, adminPending: false }, agencyPending: false };
}

/** The signed-in account, or null. An agency account waiting for its second factor counts as signed out. */
export async function getUser() {
  const resolved = await resolveUser();
  return resolved && !resolved.agencyPending ? resolved.user : null;
}

export async function requireUser() {
  const resolved = await resolveUser();
  if (!resolved) redirect("/connexion");
  if (resolved.agencyPending) redirect("/compte/securite");
  return resolved.user;
}

// 404 rather than 403: the admin area does not advertise itself.
export async function requireAdmin() {
  const user = await getUser();
  if (user?.adminPending) redirect("/compte/securite");
  if (user?.role !== "admin") notFound();
  return user;
}

/** For the second-factor screen only: an account that needs one, and its session, verified or not. */
export async function requireSecondFactorSession() {
  const session = await currentSession();
  if (!session) redirect("/connexion");
  if (!SECOND_FACTOR_ROLES.includes(session.user.role)) notFound();
  return session;
}

/** How to reach an account holder: the phone number, or the e-mail for e-mail accounts. */
export const contactOf = (user: { phoneNumber?: string | null; email: string }) =>
  user.phoneNumber ?? user.email;
