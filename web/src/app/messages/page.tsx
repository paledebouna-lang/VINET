import Link from "next/link";
import { prisma } from "@/lib/db";
import { listingTitle, titleSelect } from "@/lib/listing";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export default async function Messages() {
  const user = await requireUser();
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      listing: { select: titleSelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Messages</h1>
      {conversations.length === 0 && (
        <p className="muted">Aucune conversation. Écrivez à un vendeur depuis la page d&apos;une annonce.</p>
      )}
      <div className="stack">
        {conversations.map((c) => {
          const isBuyer = c.buyerId === user.id;
          const readAt = isBuyer ? c.buyerReadAt : c.sellerReadAt;
          const unread = !readAt || readAt < c.lastMessageAt;
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className="card conversation">
              <div className="row">
                <strong>
                  {listingTitle(c.listing)}
                </strong>
                {unread && <span className="status status-pending">Nouveau</span>}
              </div>
              <p>{c.messages[0]?.body}</p>
              <p className="muted small">
                {isBuyer ? "Vous achetez" : "Vous vendez"} · {dateFr.format(c.lastMessageAt)}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
