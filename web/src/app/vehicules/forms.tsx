"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../actions";
import { FieldError } from "../field-error";
import { createVehicle, reportSighting } from "../vehicle-actions";
import { VEHICLE_CATEGORIES } from "@/lib/listing";

export function VehicleForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createVehicle, {});
  const v = state.values ?? {};
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v[name]} aria-describedby={`${name}-error`} required {...props} />
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <form action={action} className="card stack">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="category">Catégorie</label>
          {/* Keyed so that a failed submit keeps the choice (see ListingForm). */}
          <select
            key={v.category ?? ""}
            id="category"
            name="category"
            defaultValue={v.category ?? ""}
            aria-describedby="category-error"
            required
          >
            <option value="" disabled>
              Choisir
            </option>
            {Object.entries(VEHICLE_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError state={state} name="category" />
        </div>
        {input("brand", "Marque", { placeholder: "Toyota" })}
        {input("model", "Modèle", { placeholder: "Corolla" })}
        {input("year", "Année", { inputMode: "numeric", placeholder: "2020" })}
        {input("color", "Couleur", { placeholder: "Grise" })}
        {input("serial", "Numéro de série (VIN ou numéro de cadre)")}
        {input("plate", "Immatriculation (facultatif)", { required: false })}
      </div>
      <div className="field">
        <label htmlFor="registration">Photo de la carte grise</label>
        <input
          id="registration"
          name="registration"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-describedby="registration-error"
        />
        <FieldError state={state} name="registration" />
        <small>Vue uniquement par l&apos;équipe MonAuto, pour vérifier que le véhicule est bien le vôtre.</small>
      </div>
      <div aria-live="polite">{state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Créer le passeport AVS"}
      </button>
    </form>
  );
}

type Position = { latitude: number; longitude: number; accuracy: number };

/** Shown after a scan. The phone's position is attached only if the reporter ticks the box and the browser agrees. */
export function SightingForm({ avsId }: { avsId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportSighting, {});
  const [position, setPosition] = useState<Position | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const v = state.values ?? {};

  function togglePosition(e: React.ChangeEvent<HTMLInputElement>) {
    setGeoError(null);
    if (!e.target.checked) return setPosition(null);
    const box = e.target;
    if (!navigator.geolocation) {
      box.checked = false;
      return setGeoError("Cet appareil ne donne pas sa position.");
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      () => {
        box.checked = false;
        setGeoError("Position non obtenue. Votre signalement peut être envoyé sans elle.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  if (state.ok) {
    return (
      <p className="notice" role="status">
        Signalement enregistré. Merci.
      </p>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="avsId" value={avsId} />
      <fieldset className="group">
        <legend>Que voulez-vous signaler ?</legend>
        <label className="check">
          <input type="radio" name="kind" value="OBSERVATION" defaultChecked={v.kind !== "SUSPECT"} /> J&apos;ai vu ce
          véhicule ici
        </label>
        <label className="check">
          <input type="radio" name="kind" value="SUSPECT" defaultChecked={v.kind === "SUSPECT"} /> Ce véhicule me paraît
          suspect
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor="note">Ce que vous avez vu</label>
        <textarea id="note" name="note" rows={3} required defaultValue={v.note} aria-describedby="note-error" />
        <FieldError state={state} name="note" />
      </div>

      <label className="check top">
        <input type="checkbox" name="sharePosition" onChange={togglePosition} />
        <span>
          <strong>Joindre la position de mon téléphone</strong>
          <br />
          <span className="muted small">
            Facultatif. Elle est enregistrée comme un signalement, pas comme une position certifiée du véhicule. Le
            propriétaire ne connaît pas votre identité.
          </span>
        </span>
      </label>
      {position && (
        <>
          <input type="hidden" name="latitude" value={position.latitude.toFixed(7)} />
          <input type="hidden" name="longitude" value={position.longitude.toFixed(7)} />
          <input type="hidden" name="accuracyM" value={Math.round(position.accuracy)} />
        </>
      )}
      <p className="muted small" aria-live="polite">
        {position ? `Position obtenue, précise à ${Math.round(position.accuracy)} m près.` : geoError}
      </p>

      <label className="check top">
        <input type="checkbox" name="sincere" required aria-describedby="sincere-error" />
        <span>
          Je déclare que ce signalement est sincère. Un signalement volontairement faux peut entraîner la suspension
          de mon compte.
        </span>
      </label>
      <FieldError state={state} name="sincere" />
      <div aria-live="polite">{state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>
        Envoyer le signalement
      </button>
    </form>
  );
}
