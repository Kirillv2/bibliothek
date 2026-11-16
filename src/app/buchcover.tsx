// NFR01, Issue #47: Platzhalter-Cover für einen Titel (rein dekorativ, für Vorleser ausgeblendet).
// Farbe hängt nur von der Kategorie ab, damit Titel einer Kategorie gleich aussehen; dazu die Anfangsbuchstaben.
import type { CSSProperties } from "react";

function farbtonFuer(text: string): number {
  let h = 0;
  for (const zeichen of text) h = (h * 31 + zeichen.codePointAt(0)!) % 360;
  return h;
}

function initialen(titel: string): string {
  const woerter = titel
    .split(/[\s.:,;–-]+/)
    .filter((w) => /^\p{L}/u.test(w) && !["der", "die", "das", "ein", "eine", "the", "a"].includes(w.toLowerCase()));
  const auswahl = (woerter.length > 0 ? woerter : [titel]).slice(0, 2);
  return auswahl.map((w) => w.charAt(0).toUpperCase()).join("");
}

export function Buchcover({ titel, kategorie, gross = false }: { titel: string; kategorie: string; gross?: boolean }) {
  const stil = { "--farbton": farbtonFuer(kategorie) } as CSSProperties;
  return (
    <div className={gross ? "buchcover gross" : "buchcover"} style={stil} aria-hidden="true">
      <span className="buchcover-initialen">{initialen(titel)}</span>
      <span className="buchcover-kategorie">{kategorie}</span>
    </div>
  );
}
