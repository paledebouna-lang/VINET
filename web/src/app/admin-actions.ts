"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { notify, siteUrl } from "@/lib/mail";
import { requireAdmin, requireUser } from "@/lib/session";

const ROLES = ["particulier", "agence", "admin"];
const MAX_OPEN_TICKETS = 3;

const audit = (action: string, actorId: string, target: string) =>
  prisma.auditLog.create({ data: { action, actorId, target } });

/** An admin changes another account's role. Never one's own: the last admin cannot lock the door behind them. */
export async function setRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));
  if (userId === admin.id || !ROLES.includes(role)) return;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(`role.set.${role}`, admin.id, userId);
  revalidatePath("/admin", "layout");
}

/** Suspends an account, or lifts the suspension. */
export async function toggleSuspension(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } });
  if (!user) return;

  if (user.suspendedAt) {
    await prisma.user.update({ where: { id: userId }, data: { suspendedAt: null } });
  } else {
    // Signed out everywhere and taken off the market in one step. Listings are not restored
    // when the suspension is lifted: the seller resubmits them, which sends them to moderation.
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { suspendedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.listing.updateMany({
        where: { sellerId: userId, status: { in: ["PUBLISHED", "PENDING"] } },
        data: { status: "ARCHIVED" },
      }),
    ]);
  }
  await audit(user.suspendedAt ? "user.reinstated" : "user.suspended", admin.id, userId);
  revalidatePath("/", "layout");
}

const ticketInput = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre demande en 10 caractères au moins.")
    .max(2000, "2000 caractères au maximum."),
});

/** A member writes to the team. With a bookingId it is a dispute about a rental they are part of. */
export async function openTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ticketInput.safeParse({ message: formData.get("message") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const bookingId = formData.get("bookingId") ? String(formData.get("bookingId")) : null;
  if (bookingId) {
    const party = await prisma.booking.findFirst({
      where: { id: bookingId, OR: [{ renterId: user.id }, { listing: { sellerId: user.id } }] },
    });
    if (!party) return { errors: { message: ["Cette location est introuvable."] } };
  }
  const open = await prisma.ticket.count({ where: { userId: user.id, answeredAt: null } });
  if (open >= MAX_OPEN_TICKETS) {
    return { errors: { message: ["Vous avez déjà 3 demandes en attente de réponse."] } };
  }
  await prisma.ticket.create({ data: { userId: user.id, bookingId, message: parsed.data.message } });
  revalidatePath("/", "layout");
  return { ok: true };
}

const answerInput = z.object({
  answer: z.string().trim().min(5, "Écrivez une réponse.").max(2000, "2000 caractères au maximum."),
});

export async function answerTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = answerInput.safeParse({ answer: formData.get("answer") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  // The filter makes two admins answering at once produce a single answer.
  const { count } = await prisma.ticket.updateMany({
    where: { id, answeredAt: null },
    data: { answer: parsed.data.answer, answeredAt: new Date() },
  });
  if (!count) return { errors: { answer: ["Cette demande a déjà reçu une réponse."] } };
  await audit("ticket.answered", admin.id, id);

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    include: { user: true, booking: { include: { renter: true, listing: { include: { seller: true } } } } },
  });
  // For a dispute, both sides of the rental are told; otherwise only the author.
  const recipients = new Set([ticket.user.email]);
  if (ticket.booking) recipients.add(ticket.booking.renter.email).add(ticket.booking.listing.seller.email);
  const where = ticket.bookingId ? `${siteUrl}/locations/${ticket.bookingId}` : `${siteUrl}/aide`;
  await Promise.all(
    [...recipients].map((to) => notify(to, "L'équipe MonAuto a répondu", `Lisez la réponse ici : ${where}`)),
  );
  revalidatePath("/", "layout");
  return { ok: true };
}
