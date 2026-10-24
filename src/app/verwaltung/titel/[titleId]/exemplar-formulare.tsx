"use client";
// F-04 · E02-US02-FR01, FR02 · Exemplar anlegen und Zustand ändern
import { useActionState } from "react";
import { exemplarAnlegenAusFormular, zustandAendernAusFormular, type ExemplarMeldung } from "../../../aktionen/exemplare";
import { ZUSTAND_TEXT } from "../../../exemplarstatus-text";

function Meldung({ meldung }: { meldung: ExemplarMeldung }) {
  if (!meldung) return null;
  return (
    <span className={meldung.ok ? "hinweis" : "feldfehler"} role={meldung.ok ? "status" : "alert"}>
      {meldung.text}
    </span>
  );
}

function ZustandAuswahl({ name, wert, label }: { name: string; wert: string; label: string }) {
  return (
    <select name={name} defaultValue={wert} aria-label={label}>
      {Object.entries(ZUSTAND_TEXT).map(([zustand, text]) => (
        <option key={zustand} value={zustand}>
          {text}
        </option>
      ))}
    </select>
  );
}

export function ExemplarAnlegen({ titleId }: { titleId: string }) {
  const [meldung, ausfuehren, laeuft] = useActionState(exemplarAnlegenAusFormular, null);
  return (
    <form action={ausfuehren} className="aktionen">
      <input type="hidden" name="titleId" value={titleId} />
      <ZustandAuswahl name="condition" wert="GUT" label="Zustand des neuen Exemplars" />
      <button type="submit" disabled={laeuft}>
        Exemplar anlegen
      </button>
      <Meldung meldung={meldung} />
    </form>
  );
}

export function ZustandAendern({
  titleId,
  copyId,
  inventoryNumber,
  condition,
}: {
  titleId: string;
  copyId: string;
  inventoryNumber: string;
  condition: string;
}) {
  const [meldung, ausfuehren, laeuft] = useActionState(zustandAendernAusFormular, null);
  return (
    <form action={ausfuehren} className="aktionen eng">
      <input type="hidden" name="titleId" value={titleId} />
      <input type="hidden" name="copyId" value={copyId} />
      <ZustandAuswahl key={condition} name="condition" wert={condition} label={`Zustand von ${inventoryNumber}`} />
      <button type="submit" className="leise" disabled={laeuft}>
        Speichern
      </button>
      <Meldung meldung={meldung} />
    </form>
  );
}
