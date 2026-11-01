// F-08 · E04-US01 · Fristregeln (ADR 008, OF-Z1, OF-Z2). Reine Funktionen ohne I/O (ADR 004).
import { plusTage, tageZwischen, type Datum } from "./datum";

/** E04-US01-FR02, OF-F08-1: Erinnerung, wenn der Stichtag im Vorlauf liegt (F − V ≤ S ≤ F). */
export function erinnerungFaellig(eingabe: { dueDate: Datum; stichtag: Datum; vorlaufTage: number }): boolean {
  const tageBisFaellig = tageZwischen(eingabe.stichtag, eingabe.dueDate);
  return tageBisFaellig >= 0 && tageBisFaellig <= eingabe.vorlaufTage;
}

/** OF-Z2: überfällig erst ab dem Tag nach der Fälligkeit. */
export function istUeberfaellig(dueDate: Datum, stichtag: Datum): boolean {
  return stichtag > dueDate;
}

/** E04-US01-FR03, OF-F08-3: erster überfälliger Tag, unabhängig vom Lauftag (NFR04). */
export function ueberfaelligSeit(dueDate: Datum): Datum {
  return plusTage(dueDate, 1);
}

/** Letzter Tag, an dem bei Stichtag S und Vorlauf V eine Fälligkeit noch eine Erinnerung auslöst (S + V). */
export function letzteFaelligkeitImVorlauf(stichtag: Datum, vorlaufTage: number): Datum {
  return plusTage(stichtag, vorlaufTage);
}
