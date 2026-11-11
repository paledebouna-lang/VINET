"use client";

import { useActionState } from "react";
import type { FormState } from "../../../actions";
import { FieldError } from "../../../field-error";
import { SubmitButton, SubmitForm } from "../../../submit-form";
import { type TrackerState, saveTracker, saveZone } from "../../../tracking-actions";
import { registerBeacon, removeBeacon } from "../../../vinet-actions";

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

/** Registers a VINET beacon with the four values its configuration tool shows at one moment. */
export function BeaconForm({ vehicleId, registered }: { vehicleId: string; registered: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerBeacon, {});
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <>
      <form action={action} className="stack" key={state.ok ? "done" : "form"}>
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="identityKey">Clé d&apos;identité (32 caractères)</label>
            <input id="identityKey" name="identityKey" className="mono" autoComplete="off" spellCheck={false} defaultValue={v.identityKey} required aria-describedby="identityKey-error" />
            <FieldError state={state} name="identityKey" />
          </div>
          <div className="field">
            <label htmlFor="rotationExponent">Exposant de rotation</label>
            <select id="rotationExponent" name="rotationExponent" key={v.rotationExponent ?? "10"} defaultValue={v.rotationExponent ?? "10"} aria-describedby="rotationExponent-error">
              {[8, 9, 10, 11, 12, 13, 14, 15].map((k) => (
                <option key={k} value={k}>
                  {k} : nouvel identifiant toutes les {2 ** k < 3600 ? `${Math.round(2 ** k / 60)} min` : `${(2 ** k / 3600).toFixed(1).replace(".", ",")} h`}
                </option>
              ))}
            </select>
            <FieldError state={state} name="rotationExponent" />
          </div>
          <div className="field">
            <label htmlFor="counter">Compteur de la balise (secondes)</label>
            <input id="counter" name="counter" inputMode="numeric" defaultValue={v.counter} required aria-describedby="counter-error" />
            <FieldError state={state} name="counter" />
          </div>
          <div className="field">
            <label htmlFor="eid">Identifiant diffusé à cet instant (16 caractères)</label>
            <input id="eid" name="eid" className="mono" autoComplete="off" spellCheck={false} defaultValue={v.eid} required aria-describedby="eid-error" />
            <FieldError state={state} name="eid" />
          </div>
        </div>
        <div aria-live="polite">
          {state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}
          {state.ok && <p className="notice">Balise VINET enregistrée.</p>}
        </div>
        <button className="btn btn-primary" disabled={pending}>
          {registered ? "Remplacer la balise VINET" : "Enregistrer la balise VINET"}
        </button>
      </form>
      {registered && (
        <SubmitForm action={removeBeacon} fields={{ vehicleId }}>
          <SubmitButton className="btn btn-ghost">Retirer la balise VINET et effacer ses détections</SubmitButton>
        </SubmitForm>
      )}
    </>
  );
}
