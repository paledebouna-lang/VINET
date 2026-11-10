import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { addOwnerNote } from "../../../security-actions";
import { SubmitButton, SubmitForm } from "../../../submit-form";
import { TheftForm } from "./theft-form";
import { prisma } from "@/lib/db";
import { CASE_OUTCOME, CASE_STATUS, caseReference, dateTimeLocalNow } from "@/lib/security";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

export default async function Vol({ params }: PageProps<"/vehicules/[id]/vol">) {
  await connection();
  const { id } = await params;
  const user = await requireUser();
  const vehicle = await prisma.vehicle.findFirst({
    // A theft is declared by the vehicle's owner, and the case is theirs alone to see here.
    where: { id, ownerId: user.id },
    include: {
      theftCases: {
        orderBy: { createdAt: "desc" },
        // The owner sees what they wrote; the team's working notes stay with the team.
        include: { events: { where: { kind: { in: ["OWNER_NOTE", "OWNER_FOUND"] } }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!vehicle) notFound();

  const open = vehicle.theftCases.find((c) => c.status === "DECLARED" || c.status === "ACTIVE");
  const past = vehicle.theftCases.filter((c) => c !== open);
  const reportedFound = open?.events.some((e) => e.kind === "OWNER_FOUND");

  return (
    <div className="section wrap medium">
      <p>
        <Link href={`/vehicules/${id}`}>Passeport du véhicule</Link>
      </p>
      <h1 className="page-title">
        Vol : {vehicle.brand} {vehicle.model} {vehicle.year}
      </h1>

      {open ? (
        <>
          <section className="card stack">
            <div className="row">
              <h2 className="sub-title">Dossier {caseReference(open.number)}</h2>
              <span className={open.status === "ACTIVE" ? "status status-rejected" : "status status-pending"}>
                {CASE_STATUS[open.status]}
              </span>
            </div>
            <p>
              {open.status === "ACTIVE"
                ? `Recherche active depuis le ${dateTimeFr.format(open.decidedAt!)}. La page de vérification du véhicule indique qu'il est déclaré volé, et vous êtes prévenu de chaque observation.`
                : "Votre déclaration est en cours de vérification par l'équipe MonAuto. Tant qu'elle n'est pas confirmée, le véhicule n'est pas signalé volé."}
            </p>
            <dl className="facts">
              <div>
                <dt>Vol constaté</dt>
                <dd>{dateTimeFr.format(open.stolenAt)}</dd>
              </div>
              <div>
                <dt>Lieu</dt>
                <dd>{open.place}</dd>
              </div>
              <div>
                <dt>Plainte</dt>
                <dd>{open.policeReference ?? "Référence non fournie"}</dd>
              </div>
            </dl>
            <p className="description">{open.circumstances}</p>
            <p className="alert">
              Ne tentez pas de récupérer le véhicule vous-même et ne confrontez personne. Transmettez toute information
              aux autorités.
            </p>
            <div className="row start">
              <Link href={`/vehicules/${id}/suivi`} className="btn btn-ghost">
                Suivi GPS
              </Link>
              <Link href={`/vehicules/${id}`} className="btn btn-ghost">
                Observations après un scan
              </Link>
            </div>
          </section>

          <section className="card stack">
            <h2 className="sub-title">Compléter le dossier</h2>
            {open.events.map((e) => (
              <div key={e.id} className="message">
                <p>{e.text}</p>
                <p className="muted small">{dateTimeFr.format(e.createdAt)}</p>
              </div>
            ))}
            <SubmitForm action={addOwnerNote} fields={{ id: open.id }}>
              <div className="field">
                <label htmlFor="text">Nouvelle information : numéro de plainte, témoin, détail utile</label>
                <textarea id="text" name="text" rows={3} required />
              </div>
              <SubmitButton>Ajouter au dossier</SubmitButton>
            </SubmitForm>
            {reportedFound ? (
              <p className="muted">Vous avez signalé avoir retrouvé le véhicule. L&apos;équipe MonAuto va clore le dossier.</p>
            ) : (
              <SubmitForm action={addOwnerNote} fields={{ id: open.id, found: "on" }}>
                <SubmitButton className="btn btn-ghost">Le véhicule est retrouvé</SubmitButton>
              </SubmitForm>
            )}
          </section>
        </>
      ) : (
        <>
          <p className="muted">
            Déclarez ici le vol de ce véhicule. Une fois la déclaration confirmée par l&apos;équipe MonAuto, toute
            personne qui scanne son étiquette QR voit qu&apos;il est déclaré volé et peut signaler où elle l&apos;a vu.
          </p>
          <TheftForm vehicleId={id} now={dateTimeLocalNow()} />
        </>
      )}

      {past.length > 0 && (
        <section className="stack">
          <h2 className="sub-title spaced">Dossiers précédents</h2>
          {past.map((c) => (
            <article key={c.id} className="card stack tight">
              <div className="row">
                <strong>{caseReference(c.number)}</strong>
                <span className="status">{c.outcome ? CASE_OUTCOME[c.outcome] : CASE_STATUS[c.status]}</span>
              </div>
              <p className="muted small">Déclaré le {dateTimeFr.format(c.createdAt)}</p>
              {(c.rejectionReason || c.closingNote) && <p className="description">{c.rejectionReason ?? c.closingNote}</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
