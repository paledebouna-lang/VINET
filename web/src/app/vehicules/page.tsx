import Link from "next/link";
import { VehicleForm } from "./forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Vehicules() {
  const user = await requireUser();
  const vehicles = await prisma.vehicle.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Mes véhicules</h1>
      <p className="muted">
        Le passeport AVS donne à votre véhicule une identité vérifiable et une étiquette QR à coller sur le
        pare-brise. Il ne remplace ni la carte grise, ni le titre de propriété, ni l&apos;assurance.
      </p>
      <div className="stack">
        {vehicles.map((v) => (
          <Link key={v.id} href={`/vehicules/${v.id}`} className="card conversation">
            <div className="row">
              <strong>
                {v.brand} {v.model} {v.year}
              </strong>
              <span className={v.verifiedAt ? "status status-published" : "status status-pending"}>
                {v.verifiedAt ? "Passeport vérifié" : "Vérification en cours"}
              </span>
            </div>
            <p className="mono">{v.avsId}</p>
          </Link>
        ))}
      </div>

      <h2 className="sub-title spaced">Ajouter un véhicule</h2>
      <VehicleForm />
    </div>
  );
}
