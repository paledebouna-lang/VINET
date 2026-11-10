"use client";

import { useActionState } from "react";
import { type FormState, reportListing, sendMessage } from "../../actions";
import { FieldError } from "../../field-error";

/** Opens the conversation with the seller; on success the server redirects to it. */
export function MessageForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="field">
        <label htmlFor="body">Votre message au vendeur</label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          aria-describedby="body-error"
          placeholder="Bonjour, votre véhicule m'intéresse. Est-il toujours disponible ?"
        />
        <FieldError state={state} name="body" />
        <small>
          Les échanges se font sur MonAuto. Les numéros de téléphone et les e-mails écrits dans un message sont
          masqués.
        </small>
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Écrire au vendeur
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
