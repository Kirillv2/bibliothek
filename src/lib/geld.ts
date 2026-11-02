// Anzeige von Geldbeträgen (intern Cent als ganze Zahl, ADR 006 Punkt 5).
const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatiereCent(cent: number): string {
  return EURO.format(cent / 100);
}
