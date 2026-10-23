"use client";
// F-07 · E03-US03 · Eingabe der Inventarnummer; das Feld ist danach sofort wieder bereit für das nächste Exemplar
import { useActionState } from "react";
import { rueckgabeAusFormular, type RueckgabeZustand } from "../../aktionen/rueckgabe";

const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function RueckgabeFormular() {
  const [zustand, ausfuehren, laeuft] = useActionState<RueckgabeZustand, FormData>(rueckgabeAusFormular, { art: "leer" });

  return (
    <>
      <form action={ausfuehren} className="aktionen">
        <label>
          Inventarnummer
          <input
            key={zustand.art === "fehler" ? zustand.eingabe : "neu"}
            name="inventoryNumber"
            defaultValue={zustand.art === "fehler" ? zustand.eingabe : ""}
            placeholder="INV-000123"
            autoComplete="off"
            autoFocus
            required
          />
        </label>
        <button type="submit" disabled={laeuft}>
          Rückgabe erfassen
        </button>
      </form>

      {zustand.art === "fehler" && (
        <p className="meldung fehler" role="alert">
          {zustand.text}
        </p>
      )}
      {zustand.art === "erfolg" && (
        // AK-01.6: Titel, Inventarnummer, Mitglied, ggf. Mahngebühr und Zuordnung an eine Vormerkung
        <div className="meldung erfolg" role="status">
          <p>
            Rückgabe erfasst: „{zustand.daten.title}“, Exemplar {zustand.daten.inventoryNumber}, von {zustand.daten.mitgliedEmail}.
          </p>
          {zustand.daten.mahngebuehrCents !== undefined && (
            <p>Verspätet zurückgegeben: Mahngebühr {euro(zustand.daten.mahngebuehrCents)}. Die Mahnung bleibt offen, bis sie beglichen ist.</p>
          )}
          {zustand.daten.zugeordneteVormerkungId ? (
            <p>
              <strong>Vorgemerkt:</strong> Das Exemplar bitte zurücklegen, es ist für die nächste vorgemerkte Person abholbereit.
            </p>
          ) : (
            <p>Das Exemplar kann zurück ins Regal.</p>
          )}
        </div>
      )}
    </>
  );
}
