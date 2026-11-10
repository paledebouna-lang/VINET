import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";

export async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return user;
}

// 404 rather than 403: the admin area does not advertise itself.
export async function requireAdmin() {
  const user = await getUser();
  if (user?.role !== "admin") notFound();
  return user;
}

/** How to reach an account holder: the phone number, or the e-mail for e-mail accounts. */
export const contactOf = (user: { phoneNumber?: string | null; email: string }) =>
  user.phoneNumber ?? user.email;
