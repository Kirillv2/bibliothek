"use client";
import { useActionState } from "react";
import { systemparameterAusloesen } from "../../aktionen/administration";

export function ParameterFormular({
  name,
  bezeichnung,
  wert,
  min,
  max,
  schritt,
}: {
  name: string;
  bezeichnung: string;
  wert: number;
  min: number;
  max: number;
  schritt: string;
}) {
  const [meldung, ausfuehren, laeuft] = useActionState(systemparameterAusloesen, null);
  const id = `wert-${name}`;
  return (
    <form action={ausfuehren} className="aktionen eng">
      <input type="hidden" name="name" value={name} />
      <input
        id={id}
        name="wert"
        type="text"
        inputMode="decimal"
        defaultValue={String(wert).replace(".", ",")}
        aria-label={`Neuer Wert für ${bezeichnung} (${min} bis ${max}, Schritt ${schritt})`}
        size={6}
        required
      />
      <button type="submit" disabled={laeuft}>
        Speichern
      </button>
      {meldung && (
        <span className={meldung.ok ? "hinweis" : "feldfehler"} role={meldung.ok ? "status" : "alert"}>
          {meldung.text}
        </span>
      )}
    </form>
  );
}
