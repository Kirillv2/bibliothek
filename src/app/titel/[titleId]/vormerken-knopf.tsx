"use client";
import { useActionState } from "react";
import { vormerkungAusloesen } from "../../aktionen/vormerkung";

/** F-10 AK-01.5: aktive Aktion „Vormerken“; nach dem Vormerken bleibt die Meldung mit dem Platz stehen. */
export function VormerkenKnopf({ titleId }: { titleId: string }) {
  const [meldung, ausfuehren, laeuft] = useActionState(vormerkungAusloesen, null);
  return (
    <form action={ausfuehren}>
      <input type="hidden" name="titleId" value={titleId} />
      {!meldung?.ok && (
        <button type="submit" disabled={laeuft}>
          Vormerken
        </button>
      )}
      {meldung && (
        <p className={meldung.ok ? "meldung erfolg" : "meldung fehler"} role={meldung.ok ? "status" : "alert"}>
          {meldung.text}
        </p>
      )}
    </form>
  );
}
