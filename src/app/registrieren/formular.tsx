"use client";
import { useActionState } from "react";
import { registrierungAbsenden } from "../aktionen/registrierung";

/** AK-01.5: Fehler am Feld; die eingegebene E-Mail bleibt stehen, das Passwort nicht. */
export function RegistrierungFormular({ ziel }: { ziel: string }) {
  const [stand, absenden, laeuft] = useActionState(registrierungAbsenden, null);
  const felder = stand?.felder ?? {};
  return (
    <form action={absenden} className="felder schmal">
      <input type="hidden" name="weiter" value={ziel} />
      {stand && !stand.felder && (
        <p className="meldung fehler" role="alert">
          {stand.text}
        </p>
      )}
      <label>
        E-Mail
        <input
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          required
          defaultValue={stand?.email ?? ""}
          aria-invalid={felder.email ? true : undefined}
          aria-describedby={felder.email ? "fehler-email" : undefined}
        />
      </label>
      {felder.email && (
        <p id="fehler-email" className="feldfehler" role="alert">
          {felder.email}
        </p>
      )}
      <label>
        Passwort
        <input
          type="password"
          name="passwort"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          required
          aria-invalid={felder.passwort ? true : undefined}
          aria-describedby={felder.passwort ? "fehler-passwort" : "hinweis-passwort"}
        />
      </label>
      <p id="hinweis-passwort" className="hinweis">
        8 bis 200 Zeichen.
      </p>
      {felder.passwort && (
        <p id="fehler-passwort" className="feldfehler" role="alert">
          {felder.passwort}
        </p>
      )}
      <div>
        <button type="submit" disabled={laeuft}>
          Registrieren
        </button>
      </div>
    </form>
  );
}
