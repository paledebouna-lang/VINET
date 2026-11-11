"use client";

import { useActionState } from "react";
import { FieldError } from "../../field-error";
import { type DetectorState, createDetector } from "../../vinet-actions";

export function DetectorForm() {
  const [state, action, pending] = useActionState<DetectorState, FormData>(createDetector, {});
  return (
    <form action={action} className="card stack">
      <div className="field">
        <label htmlFor="name">Nom du détecteur : partenaire et emplacement</label>
        <input id="name" name="name" required aria-describedby="name-error" placeholder="Station Total Riviera 2, passerelle n° 1" />
        <FieldError state={state} name="name" />
      </div>
      <div aria-live="polite">
        {state.detectorKey && (
          <div className="notice">
            <p>Clé du détecteur. Transmettez-la au partenaire maintenant : elle ne sera plus jamais affichée.</p>
            <p className="mono wrap-anywhere">{state.detectorKey}</p>
          </div>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Ajouter le détecteur et obtenir sa clé
      </button>
    </form>
  );
}
