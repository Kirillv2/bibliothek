// NFR01, Issue #47: eigene Seite „nicht gefunden“ auf Deutsch statt der englischen Standardseite.
// Gilt auch für unbekannte oder archivierte Titel (F-02 AK-01.8, AK-01.9; Antwort bleibt HTTP 404).
import Link from "next/link";

export default function NichtGefunden() {
  return (
    <section className="leer-zustand" aria-labelledby="nicht-gefunden-titel">
      <p className="leer-zeichen" aria-hidden="true">
        404
      </p>
      <h1 id="nicht-gefunden-titel">Seite nicht gefunden</h1>
      <p className="hinweis">
        Diese Seite gibt es nicht oder nicht mehr. Vielleicht wurde der Titel archiviert oder die Adresse ist falsch geschrieben.
      </p>
      <p>
        <Link href="/" className="knopf">
          Zum Katalog
        </Link>
      </p>
    </section>
  );
}
