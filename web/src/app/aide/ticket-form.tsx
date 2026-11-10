"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";
import { answerTicket, openTicket } from "../admin-actions";
import { FieldError } from "../field-error";

/** Writes to the MonAuto team; with a bookingId, about that rental. */
export function TicketForm({ bookingId, label }: { bookingId?: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(openTicket, {});
  if (state.ok) {
    return (
      <p className="notice" role="status">
        Demande envoyée. L&apos;équipe MonAuto vous répond ici et par e-mail.
      </p>
    );
  }
  return (
    <form action={action} className="stack">
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      <div className="field">
        <label htmlFor="message">{label}</label>
        <textarea id="message" name="message" rows={4} required aria-describedby="message-error" />
        <FieldError state={state} name="message" />
        {bookingId && (
          <small>
            Pour traiter un litige, l&apos;équipe MonAuto consulte le contrat, les états des lieux et vos échanges
            avec l&apos;autre partie sur cette location.
          </small>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Envoyer à l&apos;équipe MonAuto
      </button>
    </form>
  );
}

export function AnswerForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(answerTicket, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`answer-${id}`}>Réponse</label>
        <textarea id={`answer-${id}`} name="answer" rows={3} required aria-describedby="answer-error" />
        <FieldError state={state} name="answer" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Répondre et clore
      </button>
    </form>
  );
}
