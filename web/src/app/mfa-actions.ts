"use server";

import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/session";
import { matchTotp } from "@/lib/totp";
import { openKey } from "@/lib/vinet";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const fail = (message: string): FormState => ({ errors: { code: [message] } });
const audit = (action: string, actorId: string, ip?: string | null) =>
  prisma.auditLog.create({ data: { action, actorId, ip } });

/**
 * Checks the code typed by an admin against their secret (the pending one during setup), and on
 * success marks this session as verified. Five wrong codes block the account for 15 minutes.
 */
export async function verifyAdminCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, session } = await requireAdminSession();
  const failures = await prisma.auditLog.count({
    where: { action: "mfa.failed", actorId: user.id, at: { gt: new Date(Date.now() - FAILURE_WINDOW_MS) } },
  });
  if (failures >= MAX_FAILURES) return fail("Trop de codes incorrects. Réessayez dans 15 minutes.");

  const mfa = await prisma.adminMfa.findUnique({ where: { userId: user.id } });
  const setup = !mfa?.sealedSecret;
  const sealed = mfa?.sealedSecret ?? mfa?.pendingSecret;
  if (!mfa || !sealed) return fail("Rechargez la page pour configurer votre application.");

  const step = matchTotp(openKey(sealed), String(formData.get("code") ?? ""), mfa.lastStep);
  // The step is recorded only if no other request used it first: a code works once.
  const claimed =
    step !== null &&
    (
      await prisma.adminMfa.updateMany({
        where: { userId: user.id, lastStep: { lt: step } },
        data: setup ? { lastStep: step, sealedSecret: sealed, pendingSecret: null, enabledAt: new Date() } : { lastStep: step },
      })
    ).count === 1;
  if (!claimed) {
    await audit("mfa.failed", user.id, session.ipAddress);
    return fail("Code incorrect ou déjà utilisé. Tapez le code affiché en ce moment par l'application.");
  }

  await prisma.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
  await audit(setup ? "mfa.enabled" : "mfa.verified", user.id, session.ipAddress);
  redirect("/admin");
}
