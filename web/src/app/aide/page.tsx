import Link from "next/link";
import { TicketForm } from "./ticket-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function Aide() {
  const user = await requireUser();
  const tickets = await prisma.ticket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Aide et assistance</h1>
      <p className="muted">
        Une question sur votre compte, une annonce ou le fonctionnement du site ? Pour un problème sur une
        location, écrivez depuis la page de cette location : <Link href="/locations">mes locations</Link>.
      </p>
      <div className="card">
        <TicketForm label="Votre demande" />
      </div>

      {tickets.length > 0 && <h2 className="sub-title spaced">Mes demandes</h2>}
      <div className="stack">
        {tickets.map((t) => (
          <article key={t.id} className="card stack tight">
            <p className="description">{t.message}</p>
            <p className="muted small">
              Envoyée le {dateFr.format(t.createdAt)}
              {t.bookingId && (
                <>
                  {" "}
                  · <Link href={`/locations/${t.bookingId}`}>location concernée</Link>
                </>
              )}
            </p>
            {t.answer ? (
              <div className="message">
                <p>{t.answer}</p>
                <p className="muted small">Équipe MonAuto · {dateFr.format(t.answeredAt!)}</p>
              </div>
            ) : (
              <p className="muted small">En attente de réponse.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
