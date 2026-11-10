import { requireUser } from "@/lib/session";
import { ListingForm } from "./listing-form";

export const instant = false;

export default async function Vendre() {
  await requireUser();
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Déposer une annonce</h1>
      <p className="muted">
        Votre annonce est vérifiée par notre équipe avant d&apos;être publiée. Les acheteurs vous contactent
        par MonAuto : votre numéro n&apos;est pas affiché.
      </p>
      <ListingForm />
    </div>
  );
}
