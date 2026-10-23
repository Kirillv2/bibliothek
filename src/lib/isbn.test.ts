// F-03 · E02-US01 · Formprüfung der ISBN (AK-01.6, OF-F03-2)
// Nach Entfernen von Bindestrichen und Leerzeichen: 10 Zeichen (Ziffern, letztes auch X) oder 13 Ziffern.
// Keine Prüfziffer.
import { describe, expect, it } from "vitest";
import { istGueltigeIsbnForm } from "@/lib/isbn";

describe("E02-US01-FR01 ISBN: nur Formprüfung (AK-01.6)", () => {
  it.each([
    "3161484100",
    "316148410X",
    "3-16-148410-X",
    "3 16 148410 X",
    "9783161484100",
    "978-3-16-148410-0",
    "978 3 16 148410 0",
  ])("gültige Form: %s", (isbn) => {
    expect(istGueltigeIsbnForm(isbn)).toBe(true);
  });

  it("die Prüfziffer wird nicht geprüft", () => {
    expect(istGueltigeIsbnForm("3161484101")).toBe(true);
    expect(istGueltigeIsbnForm("9783161484101")).toBe(true);
  });

  it.each([
    ["zu kurz", "12345"],
    ["9 Ziffern", "316148410"],
    ["11 Ziffern", "31614841000"],
    ["12 Ziffern", "978316148410"],
    ["14 Ziffern", "97831614841000"],
    ["X nicht am Ende", "31614841X0"],
    ["X in ISBN-13", "978316148410X"],
    ["Buchstaben", "ABCDEFGHIJ"],
    ["andere Trennzeichen", "978.3.16.148410.0"],
    ["leer", ""],
    ["nur Bindestriche", "----------"],
  ])("ungültige Form (%s): %s", (_grund, isbn) => {
    expect(istGueltigeIsbnForm(isbn)).toBe(false);
  });
});
