"use client";
// NFR01, Issue #47: letzte Fehlerseite, falls sogar das Grundgerüst (Layout) scheitert. Ersetzt das ganze Dokument.
import "./globals.css";

export default function GlobalerFehler({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body>
        <main id="inhalt">
          <section className="leer-zustand" aria-labelledby="fehler-titel">
            <h1 id="fehler-titel">Die Bibliothek ist gerade nicht erreichbar</h1>
            <p className="hinweis">Bitte lade die Seite in einem Moment neu.</p>
            <div className="aktionen">
              <button type="button" onClick={() => reset()}>
                Erneut versuchen
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
