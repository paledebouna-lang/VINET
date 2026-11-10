"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** A form around a server action for one-step decisions; every error it returns is listed and announced. */
export function SubmitForm({
  action,
  fields,
  className = "stack",
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const messages = Object.values(state.errors ?? {}).flatMap((m) => m ?? []);
  return (
    <form action={formAction} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div aria-live="polite" className="full-row">
        {messages.map((m) => (
          <p key={m} className="alert">
            {m}
          </p>
        ))}
      </div>
    </form>
  );
}

/** A submit button that is disabled while its form is being sent. */
export function SubmitButton({
  className = "btn btn-primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} {...props} />;
}
