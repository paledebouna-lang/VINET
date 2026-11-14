import Link from "next/link";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { requireUser } from "@/lib/session";
import { EmailForm } from "./email-form";
import { SignOutButton } from "./sign-out-button";

// Reads the session cookie on every request, so this page cannot be prerendered.
export const instant = false;

const roleLabels: Record<string, string> = {
  particulier: "Particulier",
  agence: "Agence",
  admin: "Administrateur",
};

export default async function Compte() {
  const user = await requireUser();
  const { memberNumber, sellerProfile } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { memberNumber: true, sellerProfile: { select: { company: true } } },
  });
  // Accounts created by phone carry a placeholder address until a real one is added.
  const hasEmail = !user.email.endsWith(".invalid");

  return (
    <div className="narrow">
      <h1>Mon compte</h1>
      <div className="card stack">
        <dl className="facts">
          <div>
            <dt>Matricule</dt>
            <dd>{matriculeOf(memberNumber, sellerProfile?.company)}</dd>
          </div>
          {user.phoneNumber && (
            <div>
              <dt>Téléphone</dt>
              <dd>{user.phoneNumber}</dd>
            </div>
          )}
          {hasEmail && (
            <div>
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
            </div>
          )}
          <div>
            <dt>Profil</dt>
            <dd>{user.adminPending ? "Administrateur (double vérification à faire)" : (roleLabels[user.role] ?? user.role)}</dd>
          </div>
        </dl>
        {!hasEmail && <EmailForm />}
        <Link href="/messages" className="btn btn-ghost">
          Messages
        </Link>
        <Link href="/suivi" className="btn btn-ghost">
          Suivi GPS de mon parc
        </Link>
        <Link href="/vehicules" className="btn btn-ghost">
          Mes véhicules et passeports AVS
        </Link>
        <Link href="/locations" className="btn btn-ghost">
          Mes locations
        </Link>
        <Link href="/mes-annonces" className="btn btn-ghost">
          Mes annonces
        </Link>
        <Link href="/compte/identite" className="btn btn-ghost">
          Identité du vendeur
        </Link>
        {user.adminPending && (
          <Link href="/compte/securite" className="btn btn-primary">
            Double vérification pour ouvrir l&apos;administration
          </Link>
        )}
        {user.role === "admin" && (
          <>
            <Link href="/admin" className="btn btn-ghost">
              Modération
            </Link>
            <Link href="/compte/securite" className="btn btn-ghost">
              Double vérification
            </Link>
          </>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
