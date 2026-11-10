import { IdentityForm } from "./identity-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Identite() {
  const user = await requireUser();
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="narrow">
      <h1>Identité du vendeur</h1>
      <p className="muted">
        {profile?.verifiedAt
          ? "Votre identité est vérifiée. Une modification entraîne une nouvelle vérification."
          : "Pour vendre sur MonAuto, présentez-vous. Les acheteurs voient qui vous êtes."}
      </p>
      <IdentityForm
        initial={
          profile
            ? {
                fullName: profile.fullName,
                company: profile.company,
                position: profile.position,
                yearsExperience: String(profile.yearsExperience),
                matricule: profile.matricule,
              }
            : {}
        }
      />
    </div>
  );
}
