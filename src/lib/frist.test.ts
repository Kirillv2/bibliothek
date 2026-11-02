// F-08 · E04-US01 · Fristregeln als reine Funktionen (ADR 004, ADR 008, OF-Z2, OF-F08-1 … OF-F08-3)
import { describe, expect, it } from "vitest";
import { erinnerungFaellig, istUeberfaellig, ueberfaelligSeit } from "./frist";

describe("E04-US01-FR02 Erinnerung im Vorlauf", () => {
  it("AK-02.1 von F − V bis F (beide eingeschlossen)", () => {
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-10", vorlaufTage: 2 })).toBe(true);
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-11", vorlaufTage: 2 })).toBe(true);
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-12", vorlaufTage: 2 })).toBe(true);
  });

  it("AK-02.2 vor dem Vorlauf nicht", () => {
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-09", vorlaufTage: 2 })).toBe(false);
  });

  it("AK-02.4 nach der Fälligkeit nicht mehr", () => {
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-13", vorlaufTage: 2 })).toBe(false);
  });

  it("AK-02.1 Vorlauf 0 nur am Fälligkeitstag; über Monats- und Jahresgrenze", () => {
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-12", vorlaufTage: 0 })).toBe(true);
    expect(erinnerungFaellig({ dueDate: "2026-11-12", stichtag: "2026-11-11", vorlaufTage: 0 })).toBe(false);
    expect(erinnerungFaellig({ dueDate: "2027-01-01", stichtag: "2026-12-30", vorlaufTage: 2 })).toBe(true);
    expect(erinnerungFaellig({ dueDate: "2026-03-01", stichtag: "2026-02-27", vorlaufTage: 2 })).toBe(true);
  });
});

describe("E04-US01-FR03 Überfällig ab dem Tag nach der Fälligkeit", () => {
  it("AK-03.2 am Fälligkeitstag nicht überfällig, am Tag danach schon", () => {
    expect(istUeberfaellig("2026-11-10", "2026-11-10")).toBe(false);
    expect(istUeberfaellig("2026-11-10", "2026-11-11")).toBe(true);
    expect(istUeberfaellig("2026-11-10", "2026-11-09")).toBe(false);
  });

  it("AK-03.1 overdueSince = Fälligkeit + 1 Tag, auch über Monats- und Jahresende und Zeitumstellung", () => {
    expect(ueberfaelligSeit("2026-11-10")).toBe("2026-11-11");
    expect(ueberfaelligSeit("2026-12-31")).toBe("2027-01-01");
    expect(ueberfaelligSeit("2026-10-24")).toBe("2026-10-25");
    expect(ueberfaelligSeit("2028-02-28")).toBe("2028-02-29");
  });
});
