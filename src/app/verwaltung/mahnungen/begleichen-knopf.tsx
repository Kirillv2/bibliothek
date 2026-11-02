"use client";
import { useActionState } from "react";
import { mahnungBegleichenAusloesen } from "../../aktionen/mahnungen";

export function BegleichenKnopf({ dunningId, titel }: { dunningId: string; titel: string }) {
  const [meldung, ausfuehren, laeuft] = useActionState(mahnungBegleichenAusloesen, null);
  return (
    <form action={ausfuehren} className="aktionen eng">
      <input type="hidden" name="dunningId" value={dunningId} />
      {!meldung?.ok && (
        <button type="submit" disabled={laeuft} aria-label={`Mahnung zu ${titel} als beglichen markieren`}>
          Als beglichen markieren
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
