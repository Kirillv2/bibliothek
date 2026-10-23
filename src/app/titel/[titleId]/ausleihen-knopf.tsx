"use client";
import { useActionState } from "react";
import { ausleiheAusloesen } from "../../aktionen/ausleihe";

/** Die Meldung bleibt stehen, auch wenn nach der Ausleihe kein Exemplar mehr verfügbar ist. */
export function AusleihenKnopf({ titleId, angeboten }: { titleId: string; angeboten: boolean }) {
  const [meldung, ausfuehren, laeuft] = useActionState(ausleiheAusloesen, null);
  if (!angeboten && meldung === null) return null;
  return (
    <form action={ausfuehren}>
      <input type="hidden" name="titleId" value={titleId} />
      {angeboten && !meldung?.ok ? (
        <button type="submit" disabled={laeuft}>
          Ausleihen
        </button>
      ) : null}
      {meldung && (
        <p className={meldung.ok ? "meldung erfolg" : "meldung fehler"} role={meldung.ok ? "status" : "alert"}>
          {meldung.text}
        </p>
      )}
    </form>
  );
}
