// F-02 · E01-US02 · Ableitung des Exemplarstatus (ADR 005, Reihenfolge der Regeln)
import { describe, expect, it } from "vitest";
import { leiteExemplarstatusAb } from "@/lib/exemplarstatus";

type Eingabe = Parameters<typeof leiteExemplarstatusAb>[0];

function exemplar(teil: Partial<Eingabe> = {}): Eingabe {
  return { condition: "GUT", offeneAusleihe: null, abholbereitZugeordnet: false, ...teil } as Eingabe;
}

describe("E01-US02-FR01 Status je Exemplar: verfügbar / ausgeliehen bis / vorgemerkt", () => {
  it("AK-01.3 ohne offenen Ausleihvorgang und ohne Zuordnung: VERFUEGBAR", () => {
    expect(leiteExemplarstatusAb(exemplar()).status).toBe("VERFUEGBAR");
  });

  it("AK-01.4 mit offenem Ausleihvorgang: AUSGELIEHEN mit Fälligkeit", () => {
    const status = leiteExemplarstatusAb(exemplar({ offeneAusleihe: { dueDate: "2026-11-05" } }));
    expect(status).toEqual({ status: "AUSGELIEHEN", faelligAm: "2026-11-05" });
  });

  it("AK-01.5 einer abholbereiten Vormerkung zugeordnet: VORGEMERKT", () => {
    expect(leiteExemplarstatusAb(exemplar({ abholbereitZugeordnet: true })).status).toBe("VORGEMERKT");
  });

  it("AK-01.6 Zustand VERLOREN: GESPERRT (angezeigt als „nicht verfügbar“)", () => {
    expect(leiteExemplarstatusAb(exemplar({ condition: "VERLOREN" })).status).toBe("GESPERRT");
  });

  it("AK-01.3 Zustand BESCHAEDIGT ohne Ausleihe: VERFUEGBAR (OF-D2)", () => {
    expect(leiteExemplarstatusAb(exemplar({ condition: "BESCHAEDIGT" })).status).toBe("VERFUEGBAR");
  });

  it("nur AUSGELIEHEN hat eine Fälligkeit", () => {
    expect(leiteExemplarstatusAb(exemplar()).faelligAm).toBeUndefined();
    expect(leiteExemplarstatusAb(exemplar({ abholbereitZugeordnet: true })).faelligAm).toBeUndefined();
    expect(leiteExemplarstatusAb(exemplar({ condition: "VERLOREN" })).faelligAm).toBeUndefined();
  });
});

describe("E01-US02-FR01 Reihenfolge der Regeln (ADR 005): ausgeliehen vor vorgemerkt vor gesperrt", () => {
  it("ausgeliehen und verloren: AUSGELIEHEN (OF-F04-1)", () => {
    const status = leiteExemplarstatusAb(exemplar({ condition: "VERLOREN", offeneAusleihe: { dueDate: "2026-12-01" } }));
    expect(status).toEqual({ status: "AUSGELIEHEN", faelligAm: "2026-12-01" });
  });

  it("ausgeliehen und abholbereit zugeordnet: AUSGELIEHEN", () => {
    const status = leiteExemplarstatusAb(
      exemplar({ abholbereitZugeordnet: true, offeneAusleihe: { dueDate: "2026-12-01" } }),
    );
    expect(status.status).toBe("AUSGELIEHEN");
  });

  it("abholbereit zugeordnet und verloren: VORGEMERKT", () => {
    expect(leiteExemplarstatusAb(exemplar({ condition: "VERLOREN", abholbereitZugeordnet: true })).status).toBe(
      "VORGEMERKT",
    );
  });
});
