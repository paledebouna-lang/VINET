import { setRole, toggleSuspension } from "../../admin-actions";
import { prisma } from "@/lib/db";
import { matriculeOf, parseMatricule } from "@/lib/listing";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const roles = { particulier: "Particulier", agence: "Agence", admin: "Administrateur" };
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function Utilisateurs({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const admin = await requireAdmin();
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, 80);
  const memberNumber = parseMatricule(q);
  const contains = { contains: q, mode: "insensitive" as const };

  const users = await prisma.user.findMany({
    where: !q
      ? undefined
      : memberNumber !== null
        ? { memberNumber }
        : { OR: [{ email: contains }, { phoneNumber: contains }, { sellerProfile: { fullName: contains } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sellerProfile: true, _count: { select: { listings: true, bookings: true } } },
  });

  return (
    <div className="section wrap">
      <h1 className="page-title">Utilisateurs</h1>
      <form className="search card">
        <div className="field grow">
          <label htmlFor="q">Nom, téléphone, e-mail ou matricule</label>
          <input id="q" name="q" defaultValue={q} placeholder="MA-P-000042" />
        </div>
        <button className="btn btn-primary">Rechercher</button>
      </form>
      <p className="muted" role="status">
        {users.length === 50 ? "Les 50 comptes les plus récents." : `${users.length} compte${users.length > 1 ? "s" : ""}`}
      </p>

      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">Compte</th>
              <th scope="col">Activité</th>
              <th scope="col">Rôle</th>
              <th scope="col">État</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === admin.id;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.sellerProfile?.fullName ?? "Identité non renseignée"}</strong>
                    <br />
                    {matriculeOf(u.memberNumber, u.sellerProfile?.company)} · {contactOf(u)}
                    <br />
                    <span className="muted small">Inscrit le {dateFr.format(u.createdAt)}</span>
                  </td>
                  <td>
                    {u._count.listings} annonce{u._count.listings > 1 ? "s" : ""}
                    <br />
                    {u._count.bookings} location{u._count.bookings > 1 ? "s" : ""}
                  </td>
                  <td>
                    {self ? (
                      roles.admin
                    ) : (
                      <form action={setRole} className="row start">
                        <input type="hidden" name="userId" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Rôle de {contactOf(u)}
                        </label>
                        <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="inline-select">
                          {Object.entries(roles).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-ghost">Enregistrer</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {self ? (
                      "Votre compte"
                    ) : (
                      <form action={toggleSuspension} className="row start">
                        <input type="hidden" name="userId" value={u.id} />
                        <span className={u.suspendedAt ? "status status-rejected" : "status status-published"}>
                          {u.suspendedAt ? "Suspendu" : "Actif"}
                        </span>
                        <button className="btn btn-ghost">{u.suspendedAt ? "Réactiver" : "Suspendre"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Suspendre un compte le déconnecte partout, l&apos;empêche de se reconnecter et retire ses annonces. Elles ne
        reviennent pas d&apos;elles-mêmes à la réactivation.
      </p>
    </div>
  );
}
