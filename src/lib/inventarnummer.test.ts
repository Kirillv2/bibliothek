// F-04 · E02-US02 · Format der Inventarnummer (AK-01.1, OF-D6): "INV-" + sechs Ziffern
import { describe, expect, it } from "vitest";
import { formatiereInventarnummer } from "@/lib/inventarnummer";

describe("E02-US02-FR01 Inventarnummer im Format INV- + sechs Ziffern", () => {
  it.each([
    [1, "INV-000001"],
    [42, "INV-000042"],
    [123456, "INV-123456"],
    [999999, "INV-999999"],
  ])("AK-01.1 %i wird zu %s", (zahl, nummer) => {
    expect(formatiereInventarnummer(zahl)).toBe(nummer);
  });

  it("AK-01.1 das Ergebnis passt immer auf das Muster", () => {
    for (const zahl of [1, 9, 10, 99, 100, 1000, 10000, 100000]) {
      expect(formatiereInventarnummer(zahl)).toMatch(/^INV-\d{6}$/);
    }
  });

  it.each([0, -1, 1.5, 1_000_000])("AK-01.1 %s lässt sich nicht als sechsstellige Nummer darstellen und wird abgelehnt", (zahl) => {
    expect(() => formatiereInventarnummer(zahl)).toThrow();
  });
});
