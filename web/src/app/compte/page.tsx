import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

// Reads the session cookie on every request, so this page cannot be prerendered.
export const instant = false;

const roleLabels: Record<string, string> = {
  particulier: "Particulier",
  agence: "Agence",
  admin: "Administrateur",
};

export default async function Compte() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");
  const { user } = session;

  return (
    <div className="narrow">
      <h1>Mon compte</h1>
      <div className="card stack">
        <dl className="facts">
          {user.phoneNumber ? (
            <div>
              <dt>Téléphone</dt>
              <dd>{user.phoneNumber}</dd>
            </div>
          ) : (
            <div>
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
            </div>
          )}
          <div>
            <dt>Profil</dt>
            <dd>{roleLabels[user.role] ?? user.role}</dd>
          </div>
        </dl>
        <Link href="/messages" className="btn btn-ghost">
          Messages
        </Link>
        <Link href="/mes-annonces" className="btn btn-ghost">
          Mes annonces
        </Link>
        <Link href="/compte/identite" className="btn btn-ghost">
          Identité du vendeur
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className="btn btn-ghost">
            Modération
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
