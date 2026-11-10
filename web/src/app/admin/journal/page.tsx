import { prisma } from "@/lib/db";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "UTC" });

export default async function Journal({ searchParams }: PageProps<"/admin/journal">) {
  await requireAdmin();
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, 60);

  const entries = await prisma.auditLog.findMany({
    where: q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { target: { contains: q } }] } : undefined,
    orderBy: { at: "desc" },
    take: 200,
  });
  // The log keeps ids, which outlive accounts; names are looked up for display only.
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(entries.flatMap((e) => (e.actorId ? [e.actorId] : [])))] } },
    select: { id: true, email: true, phoneNumber: true },
  });
  const who = new Map(actors.map((a) => [a.id, contactOf(a)]));

  return (
    <div className="section wrap">
      <h1 className="page-title">Journal d&apos;audit</h1>
      <form className="search card">
        <div className="field grow">
          <label htmlFor="q">Action ou identifiant concerné</label>
          <input id="q" name="q" defaultValue={q} placeholder="rental, listing.published, user.suspended…" />
        </div>
        <button className="btn btn-primary">Filtrer</button>
      </form>
      <p className="muted" role="status">
        {entries.length === 200 ? "Les 200 entrées les plus récentes." : `${entries.length} entrée${entries.length > 1 ? "s" : ""}`}
      </p>
      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">Date (UTC)</th>
              <th scope="col">Action</th>
              <th scope="col">Auteur</th>
              <th scope="col">Objet</th>
              <th scope="col">Adresse</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{dateFr.format(e.at)}</td>
                <td className="wrap-anywhere">{e.action}</td>
                <td>{e.actorId ? (who.get(e.actorId) ?? "compte supprimé") : "système"}</td>
                <td className="wrap-anywhere">{e.target}</td>
                <td>{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
