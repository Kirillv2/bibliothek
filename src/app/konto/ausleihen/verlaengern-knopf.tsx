"use client";
import { useActionState } from "react";
import { verlaengerungAusloesen } from "../../aktionen/verlaengerung";

export function VerlaengernKnopf({ loanId, titel }: { loanId: string; titel: string }) {
  const [meldung, ausfuehren, laeuft] = useActionState(verlaengerungAusloesen, null);
  return (
    <form action={ausfuehren} className="aktionen eng">
      <input type="hidden" name="loanId" value={loanId} />
      {!meldung?.ok && (
        <button type="submit" disabled={laeuft} aria-label={`${titel} verlängern`}>
          Verlängern
        </button>
      )}
      {meldung && (
        <span className={meldung.ok ? "hinweis" : "feldfehler"} role={meldung.ok ? "status" : "alert"}>
          {meldung.text}
        </span>
      )}
    </form>
  );
}
