"use client";
// F-03 · E02-US01-FR03 · Archivieren; abgelehnt, solange ein Exemplar ausgeliehen oder vorgemerkt ist
import { useActionState } from "react";
import { titelArchivierenAusFormular, type ArchivZustand } from "../../../aktionen/titel";

export function ArchivierenKnopf({ titleId }: { titleId: string }) {
  const [zustand, ausfuehren, laeuft] = useActionState<ArchivZustand, FormData>(titelArchivierenAusFormular, {});
  return (
    <form
      action={ausfuehren}
      onSubmit={(ereignis) => {
        if (!window.confirm("Titel wirklich archivieren? Das lässt sich nicht rückgängig machen.")) ereignis.preventDefault();
      }}
    >
      <input type="hidden" name="titleId" value={titleId} />
      <button type="submit" className="leise" disabled={laeuft}>
        Titel archivieren
      </button>
      {zustand.meldung && (
        <p className="meldung fehler" role="alert">
          {zustand.meldung}
        </p>
      )}
    </form>
  );
}
