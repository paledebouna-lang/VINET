import { prisma } from "./db";
import { notify } from "./mail";

/** E-mails every active admin: the team has no other inbox yet. */
export async function notifyTeam(subject: string, text: string) {
  const admins = await prisma.user.findMany({ where: { role: "admin", suspendedAt: null }, select: { email: true } });
  await Promise.all(admins.map((admin) => notify(admin.email, subject, text)));
}
