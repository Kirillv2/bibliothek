"use client";
// NFR01, Issue #47: verständliche Fehlerseite auf Deutsch, wenn beim Anzeigen einer Seite etwas schiefgeht.
// Technische Details (Meldung, Stack) werden nicht angezeigt, nur die Kennung zum Nachschlagen im Server-Log.
import Link from "next/link";

export default function Fehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="leer-zustand" aria-labelledby="fehler-titel">
      <h1 id="fehler-titel">Da ist etwas schiefgegangen</h1>
      <p className="hinweis">
        Die Seite konnte gerade nicht angezeigt werden. Bitte versuche es noch einmal. Wenn der Fehler bleibt, wende dich an
        das Bibliotheksteam.
      </p>
      {error.digest && <p className="hinweis">Fehlerkennung: {error.digest}</p>}
      <div className="aktionen">
        <button type="button" onClick={() => reset()}>
          Erneut versuchen
        </button>
        <Link href="/" className="knopf leise">
          Zum Katalog
        </Link>
      </div>
    </section>
  );
}
