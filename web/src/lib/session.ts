import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";

const currentSession = async () => auth.api.getSession({ headers: await headers() });

/**
 * The signed-in account. An admin who has not typed their authenticator code in this session
 * acts as an ordinary account everywhere, so no admin right can be reached without it.
 */
export async function getUser() {
  const session = await currentSession();
  if (!session) return null;
  const { user } = session;
  if (user.role === "admin") {
    const verified = await prisma.session.findUnique({ where: { id: session.session.id }, select: { mfaVerifiedAt: true } });
    if (!verified?.mfaVerifiedAt) return { ...user, role: "particulier", adminPending: true };
  }
  return { ...user, adminPending: false };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return user;
}

// 404 rather than 403: the admin area does not advertise itself.
export async function requireAdmin() {
  const user = await getUser();
  if (user?.adminPending) redirect("/compte/securite");
  if (user?.role !== "admin") notFound();
  return user;
}

/** For the second-factor screen only: an admin account and its session, verified or not. */
export async function requireAdminSession() {
  const session = await currentSession();
  if (!session) redirect("/connexion");
  if (session.user.role !== "admin") notFound();
  return session;
}

/** How to reach an account holder: the phone number, or the e-mail for e-mail accounts. */
export const contactOf = (user: { phoneNumber?: string | null; email: string }) =>
  user.phoneNumber ?? user.email;
