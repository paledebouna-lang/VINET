"use client";

import { useActionState } from "react";
import { type FormState, createListing } from "../actions";
import { FieldError } from "../field-error";
import { CATEGORIES, COMMUNES, FUELS, TRANSMISSIONS } from "@/lib/listing";

export function ListingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createListing, {});
  const v = state.values ?? {};

  // One labelled text input wired to its server-side error.
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v[name]} aria-describedby={`${name}-error`} required {...props} />
      <FieldError state={state} name={name} />
    </div>
  );
  const select = (name: string, label: string, options: readonly (string | [string, string])[]) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={v[name] ?? ""} aria-describedby={`${name}-error`} required>
        <option value="" disabled>
          Choisir
        </option>
        {options.map((o) => {
          const [value, text] = typeof o === "string" ? [o, o] : o;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <form action={action} className="card stack">
      <div className="form-grid">
        {select("category", "Catégorie", Object.entries(CATEGORIES))}
        {input("brand", "Marque", { placeholder: "Toyota" })}
        {input("model", "Modèle", { placeholder: "Corolla" })}
        {input("year", "Année", { inputMode: "numeric", placeholder: "2020" })}
        {input("mileageKm", "Kilométrage (km)", { inputMode: "numeric", placeholder: "48 000" })}
        {select("fuel", "Énergie", FUELS)}
        {select("transmission", "Boîte de vitesses", TRANSMISSIONS)}
        {input("priceFcfa", "Prix (FCFA)", { inputMode: "numeric", placeholder: "9 800 000" })}
        {select("commune", "Commune", COMMUNES)}
        {input("vin", "Numéro de série (VIN), facultatif", { required: false, maxLength: 17 })}
      </div>
      <p className="muted small">
        Seule la commune est affichée. Le numéro de série n&apos;apparaît jamais en entier sur l&apos;annonce.
      </p>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={v.description}
          aria-describedby="description-error"
          required
        />
        <FieldError state={state} name="description" />
      </div>

      <div className="field">
        <label htmlFor="photos">Photos (1 à 8, 8 Mo chacune au maximum)</label>
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          aria-describedby="photos-error"
        />
        <FieldError state={state} name="photos" />
      </div>

      <div aria-live="polite">
        {state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}
        {state.errors && !state.errors.form && Object.keys(state.errors).length > 0 && (
          <p className="alert">Corrigez les champs signalés, puis rajoutez vos photos.</p>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Envoyer pour validation"}
      </button>
    </form>
  );
}
