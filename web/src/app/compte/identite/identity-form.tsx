"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState, saveSellerProfile } from "../../actions";
import { FieldError } from "../../field-error";

export function IdentityForm({ initial }: { initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSellerProfile, {});
  const v = state.values ?? initial;

  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v[name]} aria-describedby={`${name}-error`} required {...props} />
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <form action={action} className="card stack">
      {input("fullName", "Nom et prénoms", { autoComplete: "name" })}
      {input("company", "Entreprise", { autoComplete: "organization" })}
      {input("position", "Fonction", { autoComplete: "organization-title" })}
      {input("yearsExperience", "Années d'expérience", { inputMode: "numeric" })}
      {input("matricule", "Matricule")}
      <p className="muted small">
        Votre nom, votre entreprise, votre fonction et votre expérience figurent sur vos annonces. Le matricule
        sert à la vérification et n&apos;est vu que par notre équipe. Ni votre téléphone ni votre e-mail ne sont
        affichés.
      </p>
      <div aria-live="polite">
        {state.ok && (
          <p className="notice">
            Identité enregistrée. Elle sera vérifiée par notre équipe.{" "}
            <Link href="/vendre">Déposer une annonce</Link>
          </p>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Enregistrer
      </button>
    </form>
  );
}
