import { IdentityForm } from "./identity-form";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Identite() {
  const user = await requireUser();
  const { memberNumber, sellerProfile: profile } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { memberNumber: true, sellerProfile: true },
  });

  return (
    <div className="narrow">
      <h1>Identité du vendeur</h1>
      <p className="muted">
        {profile?.verifiedAt
          ? "Votre identité est vérifiée. Une modification entraîne une nouvelle vérification."
          : "Pour vendre sur MonAuto, présentez-vous. Les acheteurs voient qui vous êtes."}
      </p>
      <p>
        Votre matricule MonAuto : <strong>{matriculeOf(memberNumber, profile?.company)}</strong>
        <br />
        <span className="muted small">
          Attribué automatiquement. Il commence par MA-E pour un vendeur rattaché à une entreprise, par MA-P
          pour un particulier.
        </span>
      </p>
      <IdentityForm
        initial={
          profile
            ? {
                fullName: profile.fullName,
                company: profile.company ?? "",
                position: profile.position ?? "",
                yearsExperience: profile.yearsExperience?.toString() ?? "",
              }
            : {}
        }
      />
    </div>
  );
}
