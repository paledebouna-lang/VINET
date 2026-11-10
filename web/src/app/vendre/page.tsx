import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ListingForm } from "./listing-form";

export const instant = false;

export default async function Vendre() {
  const user = await requireUser();
  if (!(await prisma.sellerProfile.findUnique({ where: { userId: user.id } }))) redirect("/compte/identite");
  const vehicles = await prisma.vehicle.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } });
  const passports = vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} ${v.year} · ${v.avsId}` }));
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Publier une annonce de vente ou de location</h1>
      <p className="muted">
        Votre annonce est vérifiée par notre équipe avant d&apos;être publiée. Les acheteurs vous écrivent
        sur MonAuto : ni votre numéro ni votre e-mail ne sont affichés.
      </p>
      <ListingForm passports={passports} />
      {passports.length === 0 && (
        <p className="muted small">
          Donnez d&apos;abord un <Link href="/vehicules">passeport AVS</Link> à votre véhicule pour que les acheteurs
          puissent vérifier son identité.
        </p>
      )}
    </div>
  );
}
