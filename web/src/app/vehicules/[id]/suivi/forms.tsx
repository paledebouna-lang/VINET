"use client";

import { useActionState } from "react";
import type { FormState } from "../../../actions";
import { FieldError } from "../../../field-error";
import { type TrackerState, saveTracker, saveZone } from "../../../tracking-actions";

export function TrackerForm({ vehicleId, current }: { vehicleId: string; current?: { model: string; serial: string } }) {
  const [state, action, pending] = useActionState<TrackerState, FormData>(saveTracker, {});
  const v = state.values ?? current ?? {};
  return (
    <form action={action} className="stack">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="model">Balise : marque et modèle</label>
          <input id="model" name="model" defaultValue={v.model} required aria-describedby="model-error" />
          <FieldError state={state} name="model" />
        </div>
        <div className="field">
          <label htmlFor="serial">Numéro de série ou IMEI</label>
          <input id="serial" name="serial" defaultValue={v.serial} required aria-describedby="serial-error" />
          <FieldError state={state} name="serial" />
        </div>
      </div>
      <div aria-live="polite">
        {state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}
        {state.deviceKey && (
          <div className="notice">
            <p>Clé de la balise. Copiez-la maintenant : elle ne sera plus jamais affichée.</p>
            <p className="mono">{state.deviceKey}</p>
          </div>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {current ? "Remplacer la clé de la balise" : "Déclarer la balise et obtenir sa clé"}
      </button>
      {current && <p className="muted small">Remplacer la clé rend l&apos;ancienne inutilisable immédiatement.</p>}
    </form>
  );
}

type ZoneValues = { zoneLat: string; zoneLng: string; zoneRadiusKm: string };

export function ZoneForm({ vehicleId, current, hasZone }: { vehicleId: string; current: ZoneValues; hasZone: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveZone, {});
  const v = { ...current, ...state.values };
  const field = (name: keyof ZoneValues, label: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} inputMode="decimal" defaultValue={v[name]} required aria-describedby={`${name}-error`} />
      <FieldError state={state} name={name} />
    </div>
  );
  return (
    <form action={action} className="stack">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="form-grid">
        {field("zoneLat", "Centre : latitude")}
        {field("zoneLng", "Centre : longitude")}
        {field("zoneRadiusKm", "Rayon (km)")}
      </div>
      <p className="muted small">
        {hasZone
          ? "Une sortie de cette zone déclenche une alerte."
          : "Le centre proposé est la dernière position du véhicule. Une sortie de cette zone déclenche une alerte."}
      </p>
      <div aria-live="polite">
        {state.ok && <p className="notice">{state.values?.cleared ? "Zone supprimée." : "Zone enregistrée."}</p>}
      </div>
      <div className="row start">
        <button className="btn btn-primary" disabled={pending}>
          Enregistrer la zone
        </button>
        {hasZone && (
          <button className="btn btn-ghost" name="clear" value="on" formNoValidate disabled={pending}>
            Supprimer la zone
          </button>
        )}
      </div>
    </form>
  );
}
