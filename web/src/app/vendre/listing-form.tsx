"use client";

import { useActionState, useState } from "react";
import { type FormState, createListing, updateListing } from "../actions";
import { FieldError } from "../field-error";
import { CATEGORIES, COMMUNES, FUELS, KINDS, PART_CONDITIONS, TRANSMISSIONS } from "@/lib/listing";

type Existing = { id: string; values: Record<string, string>; photoIds: string[]; hasInsurance: boolean };

/** Creates a listing, or edits `existing` when given. */
type Passport = { id: string; label: string };

export function ListingForm({ existing, passports }: { existing?: Existing; passports: Passport[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    existing ? updateListing : createListing,
    {},
  );
  const v = state.values ?? existing?.values ?? {};
  const [kind, setKind] = useState(v.kind ?? "SALE");
  const [category, setCategory] = useState(v.category ?? "");
  const isPart = category === "PIECE";
  // A spare part is only ever sold.
  const isRent = kind === "RENT" && !isPart;

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
      {/* The key remounts the select with the submitted choice: after a failed submit the browser
          resets the form, and a select, unlike an input, would fall back to its very first default. */}
      <select
        key={v[name] ?? ""}
        id={name}
        name={name}
        defaultValue={v[name] ?? ""}
        aria-describedby={`${name}-error`}
        required
      >
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
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="field">
        <label htmlFor="category">Catégorie</label>
        <select
          key={category}
          id="category"
          name="category"
          defaultValue={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-describedby="category-error"
          required
        >
          <option value="" disabled>
            Choisir
          </option>
          {Object.entries(CATEGORIES).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <FieldError state={state} name="category" />
      </div>
      {isPart ? (
        <>
          <input type="hidden" name="kind" value="SALE" />
          <FieldError state={state} name="kind" />
        </>
      ) : (
        <div className="field">
          <label htmlFor="kind">Type d&apos;annonce</label>
          <select key={kind} id="kind" name="kind" defaultValue={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KINDS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <FieldError state={state} name="kind" />
        </div>
      )}
      {!isPart && passports.length > 0 && (
        <div className="field">
          <label htmlFor="vehicleId">Passeport AVS de ce véhicule (facultatif)</label>
          <select key={v.vehicleId ?? ""} id="vehicleId" name="vehicleId" defaultValue={v.vehicleId ?? ""}>
            <option value="">Aucun</option>
            {passports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <small>L&apos;annonce affichera l&apos;identifiant AVS du véhicule et un lien pour le vérifier.</small>
        </div>
      )}
      {isPart ? (
        <div className="form-grid">
          {input("partName", "Désignation de la pièce", { placeholder: "Phare avant gauche" })}
          {select("partCondition", "État", PART_CONDITIONS)}
          {input("brand", "Marque du véhicule compatible", { placeholder: "Toyota" })}
          {input("model", "Modèles et années compatibles", { placeholder: "Corolla 2015 à 2019" })}
          {input("partReference", "Référence constructeur, facultative", { required: false, maxLength: 40 })}
          {input("priceFcfa", "Prix (FCFA)", { inputMode: "numeric", placeholder: "35 000" })}
          {select("commune", "Commune", COMMUNES)}
        </div>
      ) : (
        <div className="form-grid">
          {input("brand", "Marque", { placeholder: "Toyota" })}
          {input("model", "Modèle", { placeholder: "Corolla" })}
          {input("year", "Année", { inputMode: "numeric", placeholder: "2020" })}
          {input("mileageKm", "Kilométrage (km)", { inputMode: "numeric", placeholder: "48 000" })}
          {select("fuel", "Énergie", FUELS)}
          {select("transmission", "Boîte de vitesses", TRANSMISSIONS)}
          {input("priceFcfa", isRent ? "Prix par jour (FCFA)" : "Prix (FCFA)", {
            inputMode: "numeric",
            placeholder: isRent ? "45 000" : "9 800 000",
          })}
          {select("commune", "Commune", COMMUNES)}
          {input("vin", "Numéro de série (VIN), facultatif", { required: false, maxLength: 17 })}
        </div>
      )}
      <p className="muted small">
        {isPart
          ? "Seule la commune est affichée. La référence aide l'acheteur à vérifier la compatibilité."
          : "Seule la commune est affichée. Le numéro de série n'apparaît jamais en entier sur l'annonce."}
      </p>

      {isRent && (
        <fieldset className="group">
          <legend>Conditions de location</legend>
          <div className="form-grid">
            {input("depositFcfa", "Dépôt de garantie (FCFA)", { inputMode: "numeric", placeholder: "200 000" })}
            {input("kmPerDay", "Kilomètres inclus par jour", { inputMode: "numeric", placeholder: "200" })}
            {input("zone", "Zone de circulation autorisée", { placeholder: "Grand Abidjan" })}
            {input("gpsModel", "GPS installé : marque et modèle")}
            {input("gpsSerial", "GPS : numéro de série ou IMEI")}
          </div>
          <div className="field">
            <label htmlFor="insurance">
              Photo de l&apos;attestation d&apos;assurance{existing?.hasInsurance ? " (pour la remplacer)" : ""}
            </label>
            <input
              id="insurance"
              name="insurance"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={!existing?.hasInsurance}
              aria-describedby="insurance-error"
            />
            <FieldError state={state} name="insurance" />
          </div>
          <p className="muted small">
            Un véhicule ne peut être loué que s&apos;il porte un GPS installé par son propriétaire et s&apos;il est
            assuré. Le numéro du GPS et l&apos;attestation ne sont vus que par notre équipe.
          </p>
        </fieldset>
      )}

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

      {existing && existing.photoIds.length > 0 && (
        <fieldset className="keep-photos">
          <legend>Photos actuelles : décochez celles à supprimer</legend>
          {existing.photoIds.map((id, i) => (
            <label key={id}>
              <img src={`/photos/${id}?s`} alt={`Photo ${i + 1}`} />
              <span>
                <input type="checkbox" name="keep" value={id} defaultChecked /> Conserver
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="photos">
          {existing ? "Ajouter des photos" : "Photos"} (8 au total, 8 Mo chacune au maximum)
        </label>
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required={!existing}
          aria-describedby="photos-error"
        />
        <FieldError state={state} name="photos" />
      </div>

      <div aria-live="polite">
        {state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}
        {state.errors && !state.errors.form && Object.values(state.errors).some(Boolean) && (
          <p className="alert">Corrigez les champs signalés, puis rajoutez vos nouvelles photos.</p>
        )}
      </div>
      {existing && (
        <p className="muted small">
          Une annonce modifiée repasse par la validation avant d&apos;être de nouveau en ligne.
        </p>
      )}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : existing ? "Enregistrer et renvoyer en validation" : "Envoyer pour validation"}
      </button>
    </form>
  );
}
