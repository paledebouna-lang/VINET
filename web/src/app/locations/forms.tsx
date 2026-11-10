"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../actions";
import { FieldError } from "../field-error";
import { requestBooking, saveInspection } from "../rental-actions";
import { formatPrice } from "@/lib/listing";
import { FUEL_LEVELS, parseDay, rentalDays } from "@/lib/rental";

export function BookingForm({ listingId, pricePerDay, today }: { listingId: string; pricePerDay: number; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestBooking, {});
  const v = state.values ?? {};
  const [start, setStart] = useState(v.startDate ?? "");
  const [end, setEnd] = useState(v.endDate ?? "");
  const [from, to] = [parseDay(start), parseDay(end)];
  const days = from && to && to >= from ? rentalDays(from, to) : null;

  return (
    <form action={action} className="stack">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="form-grid two">
        <div className="field">
          <label htmlFor="startDate">Départ</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            min={today}
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-describedby="startDate-error"
          />
          <FieldError state={state} name="startDate" />
        </div>
        <div className="field">
          <label htmlFor="endDate">Retour</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            min={start || today}
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-describedby="endDate-error"
          />
          <FieldError state={state} name="endDate" />
        </div>
      </div>
      <p className="muted small" aria-live="polite">
        {days
          ? `${days} jour${days > 1 ? "s" : ""}, les deux dates comprises : ${formatPrice(days * pricePerDay)}`
          : "Le jour du départ et le jour du retour sont comptés."}
      </p>
      <div className="field">
        <label htmlFor="renterFullName">Nom et prénoms du conducteur</label>
        <input
          id="renterFullName"
          name="renterFullName"
          autoComplete="name"
          required
          defaultValue={v.renterFullName}
          aria-describedby="renterFullName-error"
        />
        <FieldError state={state} name="renterFullName" />
      </div>
      <div className="field">
        <label htmlFor="licenceNumber">Numéro du permis de conduire</label>
        <input
          id="licenceNumber"
          name="licenceNumber"
          required
          defaultValue={v.licenceNumber}
          aria-describedby="licenceNumber-error"
        />
        <FieldError state={state} name="licenceNumber" />
      </div>
      <div className="field">
        <label htmlFor="licence">Photo du permis de conduire</label>
        <input
          id="licence"
          name="licence"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-describedby="licence-error"
        />
        <FieldError state={state} name="licence" />
        <small>Vue uniquement par le loueur et par l&apos;équipe MonAuto.</small>
      </div>
      <div aria-live="polite">{state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Demander la location"}
      </button>
    </form>
  );
}

/** The owner records the vehicle's state; `deposit` words the deposit line for departure or return. */
export function InspectionForm({ bookingId, deposit }: { bookingId: string; deposit: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveInspection, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={bookingId} />
      <div className="form-grid two">
        <div className="field">
          <label htmlFor="mileageKm">Kilométrage au compteur</label>
          <input
            id="mileageKm"
            name="mileageKm"
            inputMode="numeric"
            required
            defaultValue={v.mileageKm}
            aria-describedby="mileageKm-error"
          />
          <FieldError state={state} name="mileageKm" />
        </div>
        <div className="field">
          <label htmlFor="fuelPercent">Carburant ou charge</label>
          {/* Keyed so that a failed submit keeps the chosen level (see ListingForm). */}
          <select
            key={v.fuelPercent ?? ""}
            id="fuelPercent"
            name="fuelPercent"
            required
            defaultValue={v.fuelPercent ?? ""}
            aria-describedby="fuelPercent-error"
          >
            <option value="" disabled>
              Choisir
            </option>
            {Object.entries(FUEL_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError state={state} name="fuelPercent" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="photos">Photos du véhicule (1 à 8)</label>
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
      <div className="field">
        <label htmlFor="notes">Remarques : rayures, chocs, accessoires (facultatif)</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={v.notes} aria-describedby="notes-error" />
        <FieldError state={state} name="notes" />
      </div>
      <label className="check">
        <input type="checkbox" name="depositDone" defaultChecked={v.depositDone === "on"} /> {deposit}
      </label>
      <div aria-live="polite">{state.errors?.form && <p className="alert">{state.errors.form[0]}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Enregistrer l'état des lieux"}
      </button>
    </form>
  );
}
