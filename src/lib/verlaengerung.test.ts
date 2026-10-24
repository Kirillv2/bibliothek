// F-06 · E03-US02 · Neue Fälligkeit bei Verlängerung (AK-03.1, AK-03.2, OF-F06-2)
// Neue Fälligkeit = Tag der Verlängerung + leihfristTage, aber nie früher als die alte Fälligkeit.
import { describe, expect, it } from "vitest";
import { berechneNeueFaelligkeit } from "@/lib/verlaengerung";
import { grenzen, standardWert } from "../../tests/helpers/konfiguration";
import { plusTage } from "../../tests/helpers/uhr";

const L = standardWert("leihfristTage");
const { min, max } = grenzen("leihfristTage");

describe("E03-US02-FR03 Neue Fälligkeit auf Basis der konfigurierten Frist", () => {
  it("AK-03.1 Verlängerung vor der Fälligkeit: Verlängerungstag + Leihfrist", () => {
    const alteFaelligkeit = "2026-11-29";
    const verlaengerungstag = plusTage(alteFaelligkeit, -3);

    expect(berechneNeueFaelligkeit({ alteFaelligkeit, verlaengerungstag, leihfristTage: L })).toBe(
      plusTage(verlaengerungstag, L),
    );
  });

  it("AK-03.1 Verlängerung am Fälligkeitstag: Fälligkeitstag + Leihfrist", () => {
    expect(berechneNeueFaelligkeit({ alteFaelligkeit: "2026-11-29", verlaengerungstag: "2026-11-29", leihfristTage: L })).toBe(
      plusTage("2026-11-29", L),
    );
  });

  it("AK-03.1 Verlängerung nach der Fälligkeit: Verlängerungstag + Leihfrist", () => {
    expect(berechneNeueFaelligkeit({ alteFaelligkeit: "2026-11-29", verlaengerungstag: "2026-12-04", leihfristTage: L })).toBe(
      plusTage("2026-12-04", L),
    );
  });

  it("AK-03.1 über das Jahresende in Kalendertagen", () => {
    expect(berechneNeueFaelligkeit({ alteFaelligkeit: "2026-12-30", verlaengerungstag: "2026-12-28", leihfristTage: min })).toBe(
      plusTage("2026-12-28", min),
    );
  });

  it("AK-03.2 läge Verlängerungstag + Leihfrist vor der alten Fälligkeit, bleibt die alte Fälligkeit", () => {
    const verlaengerungstag = "2026-11-10";
    const alteFaelligkeit = plusTage(verlaengerungstag, max);

    expect(berechneNeueFaelligkeit({ alteFaelligkeit, verlaengerungstag, leihfristTage: min })).toBe(alteFaelligkeit);
  });

  it("AK-03.2 Grenzfall: Verlängerungstag + Leihfrist gleich alter Fälligkeit", () => {
    const verlaengerungstag = "2026-11-10";
    const alteFaelligkeit = plusTage(verlaengerungstag, L);

    expect(berechneNeueFaelligkeit({ alteFaelligkeit, verlaengerungstag, leihfristTage: L })).toBe(alteFaelligkeit);
  });

  it("AK-03.2 die neue Fälligkeit ist für jede gültige Leihfrist nie früher als die alte", () => {
    const alteFaelligkeit = "2026-12-15";
    for (const tage of [min, L, max]) {
      for (const verlaengerungstag of ["2026-11-01", "2026-12-01", "2026-12-15", "2026-12-20"]) {
        const neu = berechneNeueFaelligkeit({ alteFaelligkeit, verlaengerungstag, leihfristTage: tage });
        expect(neu >= alteFaelligkeit, `${verlaengerungstag} + ${tage}`).toBe(true);
      }
    }
  });
});
