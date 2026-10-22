// F-05 · E03-US01 · Fälligkeit = Startdatum + leihfristTage Kalendertage (AK-01.4, ADR 008, OF-Z1)
// Die Leihfrist ist ein Parameter; die Testwerte kommen aus config/system.defaults.json (ADR 006).
import { describe, expect, it } from "vitest";
import { berechneFaelligkeit } from "@/lib/faelligkeit";
import { grenzen, standardWert } from "../../tests/helpers/konfiguration";
import { plusTage } from "../../tests/helpers/uhr";

const L = standardWert("leihfristTage");
const { min, max } = grenzen("leihfristTage");

describe("E03-US01-FR01 Fälligkeit aus Startdatum und Leihfrist", () => {
  it("AK-01.4 Startdatum plus Leihfrist in Kalendertagen", () => {
    expect(berechneFaelligkeit("2026-11-10", L)).toBe(plusTage("2026-11-10", L));
  });

  it("AK-01.4 über Monats- und Jahresende", () => {
    expect(berechneFaelligkeit("2026-12-20", L)).toBe(plusTage("2026-12-20", L));
    expect(berechneFaelligkeit("2026-01-31", min)).toBe(plusTage("2026-01-31", min));
  });

  it("AK-01.4 Wochenenden und Feiertage zählen mit (OF-Z1)", () => {
    // 24.12.2026 ist ein Donnerstag; Feiertage und Wochenende verschieben nichts
    expect(berechneFaelligkeit("2026-12-24", min)).toBe(plusTage("2026-12-24", min));
  });

  it("AK-01.4 über die Zeitumstellung (März und Oktober) ohne Verschiebung um einen Tag", () => {
    expect(berechneFaelligkeit("2026-03-20", L)).toBe(plusTage("2026-03-20", L));
    expect(berechneFaelligkeit("2026-10-20", L)).toBe(plusTage("2026-10-20", L));
  });

  it("AK-01.4 Schaltjahr", () => {
    expect(berechneFaelligkeit("2028-02-20", min)).toBe(plusTage("2028-02-20", min));
  });
});

describe("E03-US01-FR02 Leihfrist ist ein Parameter, kein fester Wert", () => {
  it("AK-02.1 / AK-02.5 die Fälligkeit folgt jeder gültigen Leihfrist (min, Standard, max)", () => {
    for (const tage of [min, L, max]) {
      expect(berechneFaelligkeit("2026-11-10", tage)).toBe(plusTage("2026-11-10", tage));
    }
  });
});
