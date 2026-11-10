import Link from "next/link";
import { requireAdmin } from "@/lib/session";

export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Every admin page sits behind this check; each page and action checks again on its own.
  await requireAdmin();
  return (
    <>
      <nav aria-label="Administration" className="admin-nav">
        <div className="wrap">
          <Link href="/admin">Modération</Link>
          <Link href="/admin/vehicules">Véhicules</Link>
          <Link href="/admin/securite">Sécurité</Link>
          <Link href="/admin/utilisateurs">Utilisateurs</Link>
          <Link href="/admin/demandes">Demandes et litiges</Link>
          <Link href="/admin/journal">Journal</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
