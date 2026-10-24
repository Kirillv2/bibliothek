// F-07 · E03-US03 · Mahngebühr = überschrittene Tage × mahnTagessatzEuro, in Cent (E04-US02-FR02, ADR 006, ADR 008)
// Der Tagessatz ist ein Parameter; die Testwerte kommen aus config/system.defaults.json.
import { describe, expect, it } from "vitest";
import { berechneMahngebuehrCents } from "@/lib/mahngebuehr";
import { gebuehrCents, grenzen, standardWert } from "../../tests/helpers/konfiguration";
import { plusTage } from "../../tests/helpers/uhr";

const T = standardWert("mahnTagessatzEuro");
const { min, max } = grenzen("mahnTagessatzEuro");
const FAELLIG = "2026-11-05";

describe("E03-US03-FR02 Mahngebühr bei Rückgabe nach der Fälligkeit (gemäß E04-US02-FR02)", () => {
  it("AK-02.1 Rückgabe am Fälligkeitstag: keine Gebühr", () => {
    expect(berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag: FAELLIG, tagessatzEuro: T })).toBe(0);
  });

  it("AK-02.1 Rückgabe vor der Fälligkeit: keine Gebühr", () => {
    expect(berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag: plusTage(FAELLIG, -3), tagessatzEuro: T })).toBe(0);
  });

  it.each([1, 2, 7, 30])("AK-02.2 %i Tage nach der Fälligkeit: Tage × Tagessatz in Cent", (k) => {
    expect(berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag: plusTage(FAELLIG, k), tagessatzEuro: T })).toBe(
      gebuehrCents(k, T),
    );
  });

  it("AK-02.2 das Ergebnis ist eine ganze Zahl in Cent", () => {
    for (const satz of [min, T, max]) {
      const cents = berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag: plusTage(FAELLIG, 3), tagessatzEuro: satz });
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBe(gebuehrCents(3, satz));
    }
  });

  it("AK-02.2 Kalendertage über Monatsende und Zeitumstellung (ADR 008)", () => {
    expect(berechneMahngebuehrCents({ dueDate: "2026-10-20", stichtag: "2026-11-02", tagessatzEuro: T })).toBe(gebuehrCents(13, T));
    expect(berechneMahngebuehrCents({ dueDate: "2026-03-27", stichtag: "2026-03-30", tagessatzEuro: T })).toBe(gebuehrCents(3, T));
  });

  it("AK-02.2 die Gebühr folgt dem Tagessatz (kleinster und größter erlaubter Wert)", () => {
    const stichtag = plusTage(FAELLIG, 4);
    expect(berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag, tagessatzEuro: min })).toBe(gebuehrCents(4, min));
    expect(berechneMahngebuehrCents({ dueDate: FAELLIG, stichtag, tagessatzEuro: max })).toBe(gebuehrCents(4, max));
  });
});
