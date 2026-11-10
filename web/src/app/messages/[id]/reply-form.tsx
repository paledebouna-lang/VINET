"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type FormState, sendMessage } from "../../actions";
import { FieldError } from "../../field-error";

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage, {});
  const router = useRouter();

  // shortcut: replies appear by reloading the thread every 15 s; move to a live connection if chat gets busy.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="field">
        <label htmlFor="body">Votre message</label>
        <textarea id="body" name="body" rows={3} required aria-describedby="body-error" />
        <FieldError state={state} name="body" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Envoyer
      </button>
    </form>
  );
}
