import Link from "next/link";
import { connection } from "next/server";
import QRCode from "qrcode";
import { disableSecondFactor, verifySecondFactor } from "../../mfa-actions";
import { SubmitButton, SubmitForm } from "../../submit-form";
import { prisma } from "@/lib/db";
import { contactOf, requireSecondFactorSession } from "@/lib/session";
import { base32, newTotpSecret, otpauthUri } from "@/lib/totp";
import { openKey, sealKey } from "@/lib/vinet";

export const instant = false;

function CodeForm({ label }: { label: string }) {
  return (
    <SubmitForm action={verifySecondFactor} fields={{}}>
      <div className="field">
        <label htmlFor="code">Code à 6 chiffres affiché par l&apos;application</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="mono" />
      </div>
      <SubmitButton>{label}</SubmitButton>
    </SubmitForm>
  );
}

/** An admin or an agency sets up, then uses, the second factor their account requires. */
export default async function Securite() {
  await connection();
  const { user, session } = await requireSecondFactorSession();
  const isAdmin = user.role === "admin";
  const [mfa, current] = await Promise.all([
    prisma.adminMfa.findUnique({ where: { userId: user.id } }),
    prisma.session.findUnique({ where: { id: session.id }, select: { mfaVerifiedAt: true } }),
  ]);

  if (mfa?.sealedSecret) {
    return (
      <div className="narrow stack">
        <h1>Double vérification</h1>
        {current?.mfaVerifiedAt ? (
          <>
            <p className="notice">Double vérification active, et faite pour cette session.</p>
            <Link href={isAdmin ? "/admin" : "/compte"} className="btn btn-primary">
              {isAdmin ? "Aller à l'administration" : "Aller à mon compte"}
            </Link>
            {!isAdmin && (
              <SubmitForm action={disableSecondFactor} fields={{}}>
                <SubmitButton className="btn btn-ghost">Désactiver la double vérification</SubmitButton>
              </SubmitForm>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              {isAdmin ? "Pour ouvrir l'administration" : "Pour accéder à votre compte agence"}, tapez le code affiché
              pour MonAuto dans votre application d&apos;authentification.
            </p>
            <CodeForm label="Vérifier" />
          </>
        )}
        <p className="muted small">
          {isAdmin
            ? "Téléphone perdu ou changé ? Un responsable technique peut réinitialiser la double vérification depuis le serveur (docs/MISE_EN_LIGNE.md)."
            : "Téléphone perdu ou changé ? Contactez l'équipe MonAuto : elle peut réinitialiser votre double vérification."}
        </p>
      </div>
    );
  }

  // First visit: a secret is drawn once and kept, sealed, until the first correct code confirms it.
  if (!mfa?.pendingSecret) {
    const sealed = sealKey(newTotpSecret());
    await prisma.adminMfa.upsert({ where: { userId: user.id }, create: { userId: user.id, pendingSecret: sealed }, update: {} });
    await prisma.adminMfa.updateMany({ where: { userId: user.id, pendingSecret: null }, data: { pendingSecret: sealed } });
  }
  const { pendingSecret } = await prisma.adminMfa.findUniqueOrThrow({ where: { userId: user.id } });
  const secret = openKey(pendingSecret!);
  const qr = await QRCode.toDataURL(otpauthUri(secret, contactOf(user)), { margin: 1, width: 240 });

  return (
    <div className="narrow stack">
      <h1>Double vérification</h1>
      <p>
        {isAdmin
          ? "Un compte administrateur voit les documents privés et, pendant un vol, les positions des véhicules. En plus du code reçu par e-mail, il demande un code donné par une application sur votre téléphone."
          : "Facultative mais recommandée : votre compte agence donne accès aux positions de votre flotte et aux documents de vos clients (permis, contrats). Une fois activée, chaque nouvelle connexion demandera, en plus du code reçu par e-mail, un code donné par une application sur votre téléphone."}
      </p>
      <ol className="stack tight">
        <li>
          Installez une application d&apos;authentification : Google Authenticator, Microsoft Authenticator ou une
          autre.
        </li>
        <li>Dans l&apos;application, ajoutez un compte en scannant ce QR code :</li>
      </ol>
      <img src={qr} alt="QR code à scanner avec l'application d'authentification" width={240} height={240} />
      <p className="muted small">
        Impossible de scanner ? Saisissez cette clé dans l&apos;application :{" "}
        <span className="mono wrap-anywhere">{base32(secret).match(/.{1,4}/g)!.join(" ")}</span>
      </p>
      <p>3. Tapez le code que l&apos;application affiche maintenant pour MonAuto :</p>
      <CodeForm label="Activer la double vérification" />
      <p className="muted small">Ne montrez ni ce QR code ni cette clé : ils donnent accès à vos codes.</p>
    </div>
  );
}
