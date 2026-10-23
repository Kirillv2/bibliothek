// F-02 · E01-US02 · Anzeige der Fälligkeit als TT.MM.JJJJ (ADR 008, Regel 5)
import { describe, expect, it } from "vitest";
import { formatiereDatum } from "@/lib/datum";

describe("E01-US02-FR01 Fälligkeit im Format TT.MM.JJJJ", () => {
  it("AK-01.4 2026-11-05 wird als 05.11.2026 angezeigt", () => {
    expect(formatiereDatum("2026-11-05")).toBe("05.11.2026");
  });

  it("AK-01.4 Tag und Monat sind immer zweistellig", () => {
    expect(formatiereDatum("2027-01-01")).toBe("01.01.2027");
    expect(formatiereDatum("2026-12-31")).toBe("31.12.2026");
  });

  it("AK-01.4 das Datum verschiebt sich nicht durch Zeitzonen (Tag der Zeitumstellung)", () => {
    expect(formatiereDatum("2026-03-29")).toBe("29.03.2026");
    expect(formatiereDatum("2026-10-25")).toBe("25.10.2026");
  });

  it("AK-01.4 Schalttag", () => {
    expect(formatiereDatum("2028-02-29")).toBe("29.02.2028");
  });
});
