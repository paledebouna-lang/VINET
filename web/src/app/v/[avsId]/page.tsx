import type { Metadata } from "next";
import Link from "next/link";
import { SightingForm } from "../../vehicules/forms";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/listing";
import { getUser } from "@/lib/session";
import { maskMiddle, parseAvsId } from "@/lib/vehicle";

export const instant = false;
// A vehicle's identity page is reached by scanning its sticker, not through a search engine.
export const metadata: Metadata = { title: "Vérification AVS — MonAuto", robots: { index: false, follow: false } };

export default async function Verification({ params }: PageProps<"/v/[avsId]">) {
  const { avsId: raw } = await params;
  const avsId = parseAvsId(decodeURIComponent(raw));
  // Public fields only: nothing about the owner leaves the database here.
  const vehicle = avsId
    ? await prisma.vehicle.findUnique({
        where: { avsId },
        select: {
          avsId: true,
          ownerId: true,
          category: true,
          brand: true,
          model: true,
          year: true,
          color: true,
          serial: true,
          plate: true,
          verifiedAt: true,
          // Only the fact that a confirmed search is under way: nothing else of the case is public.
          theftCases: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      })
    : null;

  if (!vehicle) {
    return (
      <div className="narrow">
        <h1>QR non reconnu</h1>
        <p className="alert">
          Cette étiquette n&apos;a pas été délivrée par MonAuto. Ne vous fiez pas aux informations qui l&apos;accompagnent.
        </p>
      </div>
    );
  }

  const user = await getUser();
  const stolen = vehicle.theftCases.length > 0;
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Vérification AVS</h1>
      {stolen && (
        <div className="stolen" role="alert">
          <p className="stolen-title">Ce véhicule est déclaré volé</p>
          <p>
            Son propriétaire a déclaré le vol et MonAuto l&apos;a confirmé. Ne l&apos;achetez pas et ne le louez pas.
            N&apos;intervenez pas et ne confrontez personne : éloignez-vous, puis signalez ci-dessous où vous
            l&apos;avez vu, ou prévenez la police.
          </p>
        </div>
      )}
      <section className="passport">
        <p className="passport-title">Identité AVS authentique</p>
        <p className="small">Cette étiquette a été délivrée par MonAuto pour le véhicule décrit ci-dessous.</p>
        <dl className="facts">
          <div>
            <dt>Véhicule</dt>
            <dd>
              {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.color}
            </dd>
          </div>
          <div>
            <dt>Catégorie</dt>
            <dd>{CATEGORIES[vehicle.category]}</dd>
          </div>
          <div>
            <dt>Identifiant AVS</dt>
            <dd className="mono">{vehicle.avsId}</dd>
          </div>
          <div>
            <dt>Numéro de série</dt>
            <dd className="mono">{maskMiddle(vehicle.serial, 4)}</dd>
          </div>
          {vehicle.plate && (
            <div>
              <dt>Immatriculation</dt>
              <dd className="mono">{maskMiddle(vehicle.plate)}</dd>
            </div>
          )}
          <div>
            <dt>Propriété</dt>
            <dd>{vehicle.verifiedAt ? "Vérifiée par MonAuto" : "En cours de vérification"}</dd>
          </div>
        </dl>
      </section>
      <p className="muted small">
        Comparez cette description avec le véhicule devant vous : si elle ne correspond pas, l&apos;étiquette a pu être
        copiée. Les informations sur le propriétaire et la position du véhicule ne sont jamais affichées ici.
      </p>

      <section className="card stack">
        <h2 className="sub-title">Signaler ce véhicule</h2>
        {!user ? (
          <Link href="/connexion" className="btn btn-primary">
            Se connecter pour faire un signalement
          </Link>
        ) : user.id === vehicle.ownerId ? (
          <p className="muted">Ce véhicule est le vôtre : voici la page que voient ceux qui scannent son étiquette.</p>
        ) : (
          <SightingForm avsId={vehicle.avsId} />
        )}
      </section>
      <p className="alert">Ne confrontez jamais un suspect. En cas de danger, contactez les autorités.</p>
    </div>
  );
}
