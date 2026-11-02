// F-13 · E07-US01-FR03 · CSV-Format des Bestandsexports (AK-03.4, AK-03.5, Spec docs/specs/F-13_E07-US01.md)
// Vertrag: `@/lib/csv` exportiert `csvFeld(wert)` und `erstelleCsv(zeilen)`.
import { describe, expect, it } from "vitest";
import { csvFeld, erstelleCsv } from "@/lib/csv";

describe("E07-US01-FR03 CSV-Format", () => {
  it("AK-03.4 einfache Werte bleiben unverändert, Zahlen als Text, leer für null", () => {
    expect(csvFeld("Faust")).toBe("Faust");
    expect(csvFeld(3)).toBe("3");
    expect(csvFeld(0)).toBe("0");
    expect(csvFeld(null)).toBe("");
  });

  it.each([
    ["Semikolon", "A; B", '"A; B"'],
    ["Anführungszeichen", 'Der "Prozess"', '"Der ""Prozess"""'],
    ["Zeilenumbruch LF", "Zeile 1\nZeile 2", '"Zeile 1\nZeile 2"'],
    ["Zeilenumbruch CRLF in der Mitte", "a\r\nb", '"a\r\nb"'],
  ])("AK-03.4 Feld mit %s steht in Anführungszeichen, innere verdoppelt", (_name, wert, erwartet) => {
    expect(csvFeld(wert)).toBe(erwartet);
  });

  it.each([
    ["=", "=SUMME(A1:A2)", "'=SUMME(A1:A2)"],
    ["+", "+49 123", "'+49 123"],
    ["-", "-1+2", "'-1+2"],
    ["@", "@cmd", "'@cmd"],
    ["Tabulator", "\tx", "'\tx"],
  ])("AK-03.5 Wert beginnt mit %s → vorangestelltes '", (_name, wert, erwartet) => {
    expect(csvFeld(wert)).toBe(erwartet);
  });

  it("AK-03.5 Wagenrücklauf am Anfang: entschärft und in Anführungszeichen", () => {
    expect(csvFeld("\rx")).toBe("\"'\rx\"");
  });

  it("AK-03.5 entschärft und zusätzlich in Anführungszeichen, wenn nötig", () => {
    expect(csvFeld('=HYPERLINK("x";"y")')).toBe('"\'=HYPERLINK(""x"";""y"")"');
  });

  it("AK-03.5 Zeichen in der Mitte werden nicht entschärft", () => {
    expect(csvFeld("A=B")).toBe("A=B");
    expect(csvFeld("978-3-16-148410-0")).toBe("978-3-16-148410-0");
  });

  it("AK-03.4 Datei: UTF-8-BOM, Semikolon, jede Zeile mit CRLF", () => {
    const text = erstelleCsv([
      ["Titel", "gesamt"],
      ["Äpfel; Birnen", 2],
    ]);
    expect(text).toBe('﻿Titel;gesamt\r\n"Äpfel; Birnen";2\r\n');
  });
});
