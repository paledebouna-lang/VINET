import Link from "next/link";
import { AnswerForm } from "../../aide/ticket-form";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function Demandes() {
  await requireAdmin();
  const include = {
    user: { include: { sellerProfile: true } },
    booking: { include: { listing: { select: { id: true, brand: true, model: true, year: true } } } },
  } as const;
  const [open, answered] = await Promise.all([
    prisma.ticket.findMany({ where: { answeredAt: null }, orderBy: { createdAt: "asc" }, include }),
    prisma.ticket.findMany({ where: { answeredAt: { not: null } }, orderBy: { answeredAt: "desc" }, take: 20, include }),
  ]);
  // For a dispute, the exchanges between the two parties of that rental, and nothing else.
  const threads = await prisma.conversation.findMany({
    where: { OR: open.flatMap((t) => (t.booking ? [{ listingId: t.booking.listingId, buyerId: t.booking.renterId }] : [])) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Demandes et litiges</h1>

      <h2 className="sub-title">En attente ({open.length})</h2>
      {open.length === 0 && <p className="muted">Aucune demande en attente.</p>}
      <div className="stack">
        {open.map((t) => {
          const thread = threads.find((c) => c.listingId === t.booking?.listingId && c.buyerId === t.booking?.renterId);
          return (
            <article key={t.id} className="card stack">
              <div className="row">
                <strong>{t.booking ? "Litige sur une location" : "Demande d'aide"}</strong>
                <span className="muted small">{dateFr.format(t.createdAt)}</span>
              </div>
              <p className="muted small">
                {t.user.sellerProfile?.fullName ?? "Identité non renseignée"} ·{" "}
                {matriculeOf(t.user.memberNumber, t.user.sellerProfile?.company)} · {contactOf(t.user)}
              </p>
              <p className="description">{t.message}</p>
              {t.booking && (
                <p>
                  <Link href={`/locations/${t.booking.id}`}>
                    Location : {t.booking.listing.brand} {t.booking.listing.model} {t.booking.listing.year} (contrat et
                    états des lieux)
                  </Link>
                </p>
              )}
              {thread && (
                <details>
                  <summary>Échanges entre les deux parties ({thread.messages.length})</summary>
                  <ol className="thread">
                    {thread.messages.map((m) => (
                      <li key={m.id} className={m.senderId === t.booking?.renterId ? undefined : "mine"}>
                        <p>{m.body}</p>
                        <p className="muted small">
                          {m.senderId === t.booking?.renterId ? "Locataire" : "Loueur"} · {dateFr.format(m.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <AnswerForm id={t.id} />
            </article>
          );
        })}
      </div>

      <h2 className="sub-title spaced">Dernières réponses</h2>
      {answered.length === 0 && <p className="muted">Aucune réponse pour l&apos;instant.</p>}
      <div className="stack">
        {answered.map((t) => (
          <article key={t.id} className="card stack tight">
            <p className="muted small">
              {contactOf(t.user)} · {t.booking ? "litige" : "aide"} · {dateFr.format(t.createdAt)}
            </p>
            <p className="description">{t.message}</p>
            <div className="message">
              <p>{t.answer}</p>
              <p className="muted small">Répondu le {dateFr.format(t.answeredAt!)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
