// Verständliche Texte zu den Fehlercodes der Anwendungsschicht (docs/architektur/schnittstellen.md).
import type { Fehlercode } from "@/server/ergebnis";

export const FEHLERTEXTE: Record<Fehlercode, string> = {
  NICHT_ANGEMELDET: "Bitte melde dich zuerst an.",
  KEINE_BERECHTIGUNG: "Dafür fehlt dir die Berechtigung.",
  NICHT_GEFUNDEN: "Der Eintrag wurde nicht gefunden.",
  VALIDIERUNG: "Die Eingaben sind nicht gültig.",
  KEIN_EXEMPLAR_VERFUEGBAR: "Gerade ist kein Exemplar verfügbar.",
  AUSLEIHLIMIT_ERREICHT: "Du hast bereits die höchste Zahl an Ausleihen erreicht.",
  OFFENE_MAHNUNG: "Ausleihen ist erst wieder möglich, wenn deine offene Mahnung beglichen ist.",
  TITEL_ARCHIVIERT: "Der Titel ist archiviert.",
  VORMERKUNG_VORHANDEN: "Für diesen Titel gibt es eine Vormerkung, deshalb ist keine Verlängerung möglich.",
  MAX_VERLAENGERUNGEN_ERREICHT: "Die höchste Zahl an Verlängerungen ist erreicht.",
  AUSLEIHVORGANG_ABGESCHLOSSEN: "Dieser Ausleihvorgang ist bereits abgeschlossen.",
  TITEL_NICHT_ARCHIVIERBAR: "Der Titel kann nicht archiviert werden, solange Exemplare ausgeliehen sind.",
};
