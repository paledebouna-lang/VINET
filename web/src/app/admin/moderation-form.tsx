"use client";

import { useActionState } from "react";
import { type FormState, moderateListing } from "../actions";
import { FieldError } from "../field-error";

export function ModerationForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(moderateListing, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`reason-${id}`}>Motif, en cas de refus (transmis au vendeur)</label>
        <input id={`reason-${id}`} name="reason" aria-describedby="reason-error" />
        <FieldError state={state} name="reason" />
      </div>
      <div className="row start">
        <button className="btn btn-primary" name="decision" value="publish" disabled={pending}>
          Publier
        </button>
        <button className="btn btn-ghost" name="decision" value="reject" disabled={pending}>
          Refuser
        </button>
      </div>
    </form>
  );
}
