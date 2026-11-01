// F-09 · E04-US02-FR02 · Gesamtgebühr einer Mahnung: festgehaltene Gebühr + laufende Überschreitung (OF-F09-1)
import { describe, expect, it } from "vitest";
import { gesamtgebuehrCents, ueberschritteneTage } from "./mahngebuehr";

describe("E04-US02-FR02 Gesamtgebühr", () => {
  it("AK-02.1 ohne Festgehaltenes: laufende Tage × Tagessatz", () => {
    expect(gesamtgebuehrCents({ festgehaltenCents: null, laufend: { dueDate: "2026-11-06", stichtag: "2026-11-10" }, tagessatzEuro: 0.5 })).toBe(200);
  });

  it("AK-02.3 abgeschlossen: nur Festgehaltenes", () => {
    expect(gesamtgebuehrCents({ festgehaltenCents: 150, laufend: null, tagessatzEuro: 0.5 })).toBe(150);
    expect(gesamtgebuehrCents({ festgehaltenCents: null, laufend: null, tagessatzEuro: 0.5 })).toBe(0);
  });

  it("AK-02.4 frühere plus laufende Überschreitung", () => {
    expect(gesamtgebuehrCents({ festgehaltenCents: 150, laufend: { dueDate: "2026-12-06", stichtag: "2026-12-08" }, tagessatzEuro: 0.5 })).toBe(250);
  });

  it("AK-02.1 am Fälligkeitstag läuft noch nichts", () => {
    expect(gesamtgebuehrCents({ festgehaltenCents: 150, laufend: { dueDate: "2026-11-10", stichtag: "2026-11-10" }, tagessatzEuro: 0.5 })).toBe(150);
  });

  it("überschrittene Tage: nie negativ", () => {
    expect(ueberschritteneTage("2026-11-06", "2026-11-10")).toBe(4);
    expect(ueberschritteneTage("2026-11-10", "2026-11-06")).toBe(0);
  });
});
