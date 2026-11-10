"use client";

import { useActionState } from "react";
import type { FormState } from "../../../actions";
import { FieldError } from "../../../field-error";
import { declareTheft } from "../../../security-actions";
import { UNDERTAKINGS } from "@/lib/security";

export function TheftForm({ vehicleId, now }: { vehicleId: string; now: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(declareTheft, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="card stack">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="field">
        <label htmlFor="stolenAt">Date et heure du vol, ou du dernier moment où vous avez vu le véhicule</label>
        <input
          id="stolenAt"
          name="stolenAt"
          type="datetime-local"
          max={now}
          required
          defaultValue={v.stolenAt}
          aria-describedby="stolenAt-error"
        />
        <FieldError state={state} name="stolenAt" />
      </div>
      <div className="field">
        <label htmlFor="place">Où se trouvait le véhicule</label>
        <input id="place" name="place" required defaultValue={v.place} aria-describedby="place-error" />
        <FieldError state={state} name="place" />
      </div>
      <div className="field">
        <label htmlFor="circumstances">Circonstances</label>
        <textarea
          id="circumstances"
          name="circumstances"
          rows={4}
          required
          defaultValue={v.circumstances}
          aria-describedby="circumstances-error"
        />
        <FieldError state={state} name="circumstances" />
      </div>
      <div className="field">
        <label htmlFor="policeReference">Numéro de plainte ou de procès-verbal (si vous l&apos;avez)</label>
        <input id="policeReference" name="policeReference" defaultValue={v.policeReference} aria-describedby="policeReference-error" />
        <FieldError state={state} name="policeReference" />
      </div>
      <div className="field">
        <label htmlFor="complaint">Photo du récépissé de plainte (facultatif)</label>
        <input id="complaint" name="complaint" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="complaint-error" />
        <FieldError state={state} name="complaint" />
      </div>

      <fieldset className="group">
        <legend>Mes engagements</legend>
        {UNDERTAKINGS.map((undertaking, i) => (
          <label key={undertaking} className="check top">
            <input type="checkbox" name={`u${i}`} required defaultChecked={v[`u${i}`] === "on"} aria-describedby="undertakings-error" />
            <span>{undertaking}</span>
          </label>
        ))}
        <FieldError state={state} name="undertakings" />
      </fieldset>

      <div aria-live="polite">{state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Déclarer le vol"}
      </button>
      <p className="muted small">
        Votre déclaration est vérifiée par l&apos;équipe MonAuto avant que le véhicule soit signalé volé. Déposez
        aussi plainte auprès des autorités : MonAuto ne les remplace pas.
      </p>
    </form>
  );
}
