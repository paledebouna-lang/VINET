import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplyForm } from "./reply-form";
import { prisma } from "@/lib/db";
import { listingTitle } from "@/lib/listing";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export default async function Conversation({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const conversation = await prisma.conversation.findFirst({
    // Only the two parties can read a conversation.
    where: { id, OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }] },
    include: {
      listing: { include: { seller: { select: { sellerProfile: { select: { fullName: true } } } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) notFound();

  const isBuyer = conversation.buyerId === user.id;
  await prisma.conversation.update({
    where: { id },
    data: { [isBuyer ? "buyerReadAt" : "sellerReadAt"]: new Date() },
  });

  const { listing } = conversation;
  // The other side is named by role, or by the seller's public identity: never by phone or e-mail.
  const other = isBuyer ? (listing.seller.sellerProfile?.fullName ?? "Le vendeur") : "L'acheteur";

  return (
    <div className="section wrap medium">
      <p>
        <Link href="/messages">Tous les messages</Link>
      </p>
      <h1 className="page-title">
        <Link href={`/annonces/${listing.id}`}>
          {listingTitle(listing)}
        </Link>
      </h1>
      <ol className="thread">
        {conversation.messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <li key={m.id} className={mine ? "mine" : undefined}>
              <p>{m.body}</p>
              <p className="muted small">
                {mine ? "Vous" : other} · {dateFr.format(m.createdAt)}
              </p>
            </li>
          );
        })}
      </ol>
      <ReplyForm conversationId={id} />
      <p className="muted small">
        Vos coordonnées ne sont pas communiquées, et les numéros ou e-mails écrits dans un message sont masqués.
        Poursuivez vos échanges ici jusqu&apos;à la visite du véhicule.
      </p>
    </div>
  );
}
