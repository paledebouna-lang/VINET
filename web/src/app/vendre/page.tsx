import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ListingForm } from "./listing-form";

export const instant = false;

export default async function Vendre() {
  const user = await requireUser();
  if (!(await prisma.sellerProfile.findUnique({ where: { userId: user.id } }))) redirect("/compte/identite");
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Déposer une annonce</h1>
      <p className="muted">
        Votre annonce est vérifiée par notre équipe avant d&apos;être publiée. Les acheteurs vous écrivent
        sur MonAuto : ni votre numéro ni votre e-mail ne sont affichés.
      </p>
      <ListingForm />
    </div>
  );
}
