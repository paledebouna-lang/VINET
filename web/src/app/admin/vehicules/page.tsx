import Link from "next/link";
import { reviewSighting, verifyVehicle } from "../../vehicle-actions";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function AdminVehicules() {
  await requireAdmin();
  const person = { select: { email: true, phoneNumber: true, memberNumber: true, sellerProfile: true } } as const;
  const [toVerify, suspicions] = await Promise.all([
    prisma.vehicle.findMany({
      where: { verifiedAt: null },
      orderBy: { createdAt: "asc" },
      include: { owner: person, documents: { where: { kind: "REGISTRATION" } } },
    }),
    prisma.sighting.findMany({
      where: { kind: "SUSPECT", reviewedAt: null },
      orderBy: { createdAt: "asc" },
      include: { reporter: person, vehicle: true },
    }),
  ]);
  const who = (p: (typeof toVerify)[number]["owner"]) =>
    `${p.sellerProfile?.fullName ?? "Identité non renseignée"} · ${matriculeOf(p.memberNumber, p.sellerProfile?.company)} · ${contactOf(p)}`;

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Véhicules et passeports AVS</h1>

      <h2 className="sub-title">Passeports à vérifier ({toVerify.length})</h2>
      {toVerify.length === 0 && <p className="muted">Aucun passeport en attente.</p>}
      <div className="stack">
        {toVerify.map((v) => (
          <article key={v.id} className="card stack">
            <div>
              <h3 className="card-title">
                <Link href={`/vehicules/${v.id}`}>
                  {v.brand} {v.model} {v.year} · {v.color}
                </Link>
              </h3>
              <p className="mono">{v.avsId}</p>
              <p className="muted small">
                Numéro de série : {v.serial} · Immatriculation : {v.plate ?? "non renseignée"}
              </p>
              <p className="muted small">Propriétaire déclaré : {who(v.owner)}</p>
            </div>
            <div className="thumbs">
              {v.documents.map((doc) => (
                <a key={doc.id} href={`/documents/${doc.id}`} target="_blank">
                  <img src={`/documents/${doc.id}?s`} alt="Carte grise, ouvrir en grand" />
                </a>
              ))}
            </div>
            <form action={verifyVehicle}>
              <input type="hidden" name="id" value={v.id} />
              <button className="btn btn-primary">La carte grise correspond : vérifier le passeport</button>
            </form>
          </article>
        ))}
      </div>

      <h2 className="sub-title spaced">Véhicules signalés suspects ({suspicions.length})</h2>
      {suspicions.length === 0 && <p className="muted">Aucun signalement à examiner.</p>}
      <div className="stack">
        {suspicions.map((s) => (
          <article key={s.id} className="card stack">
            <p>
              <Link href={`/vehicules/${s.vehicleId}`}>
                {s.vehicle.brand} {s.vehicle.model} {s.vehicle.year}
              </Link>{" "}
              · <span className="mono">{s.vehicle.avsId}</span>
            </p>
            <p className="description">{s.note}</p>
            <p className="muted small">
              {dateTimeFr.format(s.createdAt)} · déclarant : {who(s.reporter)}
              {s.latitude !== null && s.longitude !== null && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    position du déclarant, à {s.accuracyM} m près
                  </a>
                </>
              )}
            </p>
            <form action={reviewSighting}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn btn-ghost">Signalement examiné</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
