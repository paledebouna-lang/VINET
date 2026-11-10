"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { normalizeCiPhone } from "@/lib/phone";

type Channel = "phone" | "email";

export default function Connexion() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("phone");
  const [input, setInput] = useState("");
  // Set once a code has been sent: the normalized phone number or e-mail it went to.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(next: Channel = channel) {
    setChannel(next);
    setInput("");
    setSentTo(null);
    setCode("");
    setError(null);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const to = channel === "phone" ? normalizeCiPhone(input) : input.trim().toLowerCase();
    if (!to) {
      setError("Entrez un numéro de mobile ivoirien à 10 chiffres, par exemple 07 08 09 10 11.");
      return;
    }
    setBusy(true);
    const res =
      channel === "phone"
        ? await authClient.phoneNumber.sendOtp({ phoneNumber: to })
        : await authClient.emailOtp.sendVerificationOtp({ email: to, type: "sign-in" });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.status === 429
          ? "Trop de demandes. Réessayez dans une minute."
          : "Le code n'a pas pu être envoyé. Vérifiez votre saisie et réessayez.",
      );
      return;
    }
    setSentTo(to);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    const res =
      channel === "phone"
        ? await authClient.phoneNumber.verify({ phoneNumber: sentTo, code })
        : await authClient.signIn.emailOtp({ email: sentTo, otp: code });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.message === "ACCOUNT_SUSPENDED"
          ? "Ce compte est suspendu. Écrivez à l'équipe MonAuto pour en savoir plus."
          : "Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.",
      );
      return;
    }
    router.push("/compte");
    router.refresh();
  }

  return (
    <div className="narrow">
      <h1>Connexion ou inscription</h1>
      <div className="card stack">
        {sentTo ? (
          <form className="stack" onSubmit={verifyCode}>
            <div className="field">
              <label htmlFor="code">Code reçu</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <small>Code à 6 chiffres envoyé à {sentTo}. Il expire après 5 minutes.</small>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              Valider
            </button>
            <button type="button" className="btn-link" onClick={() => reset()}>
              Modifier ou renvoyer un code
            </button>
          </form>
        ) : (
          <>
            <div className="tabs" role="group" aria-label="Moyen de connexion">
              <button type="button" aria-pressed={channel === "phone"} onClick={() => reset("phone")}>
                Téléphone
              </button>
              <button type="button" aria-pressed={channel === "email"} onClick={() => reset("email")}>
                E-mail
              </button>
            </div>
            <form className="stack" onSubmit={sendCode}>
              <div className="field">
                <label htmlFor="identifiant">
                  {channel === "phone" ? "Numéro de mobile" : "Adresse e-mail"}
                </label>
                <input
                  id="identifiant"
                  key={channel}
                  type={channel === "phone" ? "tel" : "email"}
                  autoComplete={channel === "phone" ? "tel" : "email"}
                  placeholder={channel === "phone" ? "07 08 09 10 11" : "vous@exemple.com"}
                  required
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <small>Nous vous envoyons un code. Pas de mot de passe à retenir.</small>
              </div>
              <button className="btn btn-primary" disabled={busy}>
                Recevoir un code
              </button>
            </form>
          </>
        )}
        {/* Always mounted so screen readers announce errors as they appear. */}
        <div aria-live="polite">{error && <p className="alert">{error}</p>}</div>
      </div>
    </div>
  );
}
