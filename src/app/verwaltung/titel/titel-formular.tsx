"use client";
// F-03 · E02-US01-FR01, FR02 · Formular zum Anlegen und Bearbeiten (NFR01: ohne Schulung bedienbar)
import { useActionState } from "react";
import { titelSpeichern, type TitelFormularWerte, type TitelFormularZustand } from "../../aktionen/titel";

type Feld = { name: keyof TitelFormularWerte; label: string; pflicht?: boolean; art?: "text" | "zahl" | "lang" };

const FELDER: Feld[] = [
  { name: "title", label: "Titel", pflicht: true },
  { name: "author", label: "Autor", pflicht: true },
  { name: "category", label: "Kategorie", pflicht: true },
  { name: "isbn", label: "ISBN (optional)" },
  { name: "publicationYear", label: "Erscheinungsjahr (optional)", art: "zahl" },
  { name: "description", label: "Beschreibung (optional)", art: "lang" },
];

export function TitelFormular({ titleId, werte }: { titleId?: string; werte: TitelFormularWerte }) {
  const [zustand, ausfuehren, laeuft] = useActionState<TitelFormularZustand, FormData>(titelSpeichern, {});
  const aktuell = zustand.werte ?? werte;

  return (
    <form action={ausfuehren} className="felder" noValidate>
      {titleId && <input type="hidden" name="titleId" value={titleId} />}
      {zustand.meldung && (
        <p className="meldung fehler breit" role="alert">
          {zustand.meldung}
        </p>
      )}
      {FELDER.map((feld) => {
        const fehler = zustand.felder?.[feld.name];
        const fehlerId = `fehler-${feld.name}`;
        const gemeinsam = {
          name: feld.name,
          defaultValue: aktuell[feld.name],
          "aria-invalid": fehler ? true : undefined,
          "aria-describedby": fehler ? fehlerId : undefined,
        };
        return (
          <label key={`${feld.name}-${aktuell[feld.name]}`} className={feld.art === "lang" ? "breit" : undefined}>
            {feld.label}
            {feld.art === "lang" ? (
              <textarea rows={4} {...gemeinsam} />
            ) : (
              <input
                type="text"
                inputMode={feld.art === "zahl" ? "numeric" : undefined}
                required={feld.pflicht}
                {...gemeinsam}
              />
            )}
            {fehler && (
              <span id={fehlerId} className="feldfehler">
                {fehler}
              </span>
            )}
          </label>
        );
      })}
      <div className="breit">
        <button type="submit" disabled={laeuft}>
          {titleId ? "Änderungen speichern" : "Titel anlegen"}
        </button>
      </div>
    </form>
  );
}
