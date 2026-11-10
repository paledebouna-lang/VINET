"use client";

import { useActionState } from "react";
import { type FormState, reportListing, sendInquiry } from "../../actions";
import { FieldError } from "../../field-error";

export function InquiryForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendInquiry, {});
  if (state.ok) {
    return (
      <p className="notice" role="status">
        Demande envoyée. Le vendeur vous recontactera directement.
      </p>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="field">
        <label htmlFor="message">Votre message au vendeur</label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          aria-describedby="message-error"
          defaultValue="Bonjour, votre véhicule m'intéresse. Est-il toujours disponible ? Je souhaite le voir."
        />
        <FieldError state={state} name="message" />
        <small>Votre numéro ou votre e-mail est transmis au vendeur avec ce message.</small>
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Contacter le vendeur
      </button>
    </form>
  );
}

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportListing, {});
  if (state.ok) {
    return (
      <p className="notice" role="status">
        Signalement reçu. Notre équipe va vérifier cette annonce.
      </p>
    );
  }
  return (
    <details>
      <summary>Signaler cette annonce</summary>
      <form action={action} className="stack">
        <input type="hidden" name="listingId" value={listingId} />
        <div className="field">
          <label htmlFor="reason">Quel est le problème ?</label>
          <textarea id="reason" name="reason" rows={3} required aria-describedby="reason-error" />
          <FieldError state={state} name="reason" />
        </div>
        <button className="btn btn-ghost" disabled={pending}>
          Envoyer le signalement
        </button>
      </form>
    </details>
  );
}
