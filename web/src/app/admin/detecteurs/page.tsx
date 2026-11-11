import { connection } from "next/server";
import { SubmitButton, SubmitForm } from "../../submit-form";
import { revokeDetector } from "../../vinet-actions";
import { DetectorForm } from "./detector-form";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/mail";
import { requireAdmin } from "@/lib/session";
import { ago } from "@/lib/tracking";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function Detecteurs() {
  await connection();
  await requireAdmin();
  const [detectors, beacons] = await Promise.all([
    prisma.detector.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { detections: true } } } }),
    prisma.beacon.count(),
  ]);

  return (
    <div className="section wrap medium stack">
      <h1 className="page-title">Détecteurs VINET</h1>
      <p className="muted">
        {beacons} balise{beacons > 1 ? "s" : ""} enregistrée{beacons > 1 ? "s" : ""}. Un détecteur partenaire envoie
        les identifiants qu&apos;il capte à <span className="mono wrap-anywhere">{siteUrl}/api/vinet/detections</span>{" "}
        avec sa clé. Seuls les identifiants des balises enregistrées sont conservés ; les autres sont ignorés.
      </p>
      <DetectorForm />
      {detectors.length === 0 && <p className="muted">Aucun détecteur pour l&apos;instant.</p>}
      {detectors.map((d) => (
        <article key={d.id} className="card stack tight">
          <div className="row">
            <strong>{d.name}</strong>
            <span className={d.revokedAt ? "status status-rejected" : "status status-published"}>
              {d.revokedAt ? "Révoqué" : "Actif"}
            </span>
          </div>
          <p className="muted small">
            Ajouté le {dateFr.format(d.createdAt)} · {d._count.detections} détection{d._count.detections > 1 ? "s" : ""}{" "}
            conservée{d._count.detections > 1 ? "s" : ""} · {d.lastSeenAt ? `dernier envoi ${ago(d.lastSeenAt)}` : "aucun envoi"}
          </p>
          {!d.revokedAt && (
            <SubmitForm action={revokeDetector} fields={{ id: d.id }}>
              <SubmitButton className="btn btn-ghost">Révoquer sa clé</SubmitButton>
            </SubmitForm>
          )}
        </article>
      ))}
    </div>
  );
}
