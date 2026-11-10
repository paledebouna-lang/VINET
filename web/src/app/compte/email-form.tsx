"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Lets an account created by phone add a verified e-mail address, used for notifications and sign-in. */
export function EmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = sentTo
      ? await authClient.emailOtp.changeEmail({ newEmail: sentTo, otp: code })
      : await authClient.emailOtp.requestEmailChange({ newEmail: email.trim().toLowerCase() });
    setBusy(false);
    if (res.error) {
      setError(
        sentTo
          ? "Code incorrect ou expiré. Vérifiez-le ou recommencez."
          : "Cette adresse n'a pas pu être utilisée. Vérifiez-la et réessayez.",
      );
    } else if (sentTo) {
      router.refresh();
    } else {
      setSentTo(email.trim().toLowerCase());
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {sentTo ? (
        <div className="field">
          <label htmlFor="email-code">Code reçu par e-mail</label>
          <input
            id="email-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {/* The server answers the same way for an address already in use, so nothing is confirmed here. */}
          <small>Si l&apos;adresse {sentTo} est libre, un code à 6 chiffres vient d&apos;y être envoyé.</small>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="new-email">Recevoir mes notifications par e-mail</label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <small>Nouveaux messages, baisses de prix, décisions sur vos annonces.</small>
        </div>
      )}
      <button className="btn btn-ghost" disabled={busy}>
        {sentTo ? "Valider le code" : "Ajouter cette adresse"}
      </button>
      <div aria-live="polite">{error && <p className="alert">{error}</p>}</div>
    </form>
  );
}
