import type { FormState } from "./actions";

/** The server's message for one field. Its id pairs with aria-describedby on the input. */
export function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state.errors?.[name]?.[0];
  return (
    <small id={`${name}-error`} className="field-error" aria-live="polite">
      {message}
    </small>
  );
}
