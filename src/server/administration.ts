// F-12 · E06-US02 · Rollen und Systemparameter konfigurieren (Spec docs/specs/F-12_E06-US02.md)
// Nur Administrator (Rechte-Matrix). Wer ändert, kommt nur aus der Sitzung. Grenzen nur aus config/system.defaults.json (ADR 006).
import { sql } from "drizzle-orm";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { ROLLEN, type Rolle } from "./db/schema";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { erfolg, fehler, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";
import { alleEinstellungen, getSetting, istEinstellungName, type EinstellungName } from "./settings";

export type NutzerEintrag = { userId: string; email: string; role: Rolle };

/** AK-01.1: alle Konten mit E-Mail und Rolle, nach E-Mail sortiert; keine Hashes. */
export async function ladeNutzer(k: Kontext): Promise<Ergebnis<NutzerEintrag[]>> {
  const rechte = pruefeRolle(k.sitzung, "ADMINISTRATOR");
  if (rechte) return rechte;
  const liste = zeilen<{ id: string; email: string; role: Rolle }>(
    await k.db.execute(sql`SELECT id, email, role FROM users ORDER BY email, id`),
  );
  return erfolg(liste.map((z) => ({ userId: z.id, email: z.email, role: z.role })));
}

function istRolle(wert: unknown): wert is Rolle {
  return typeof wert === "string" && (ROLLEN as readonly string[]).includes(wert);
}

/** E06-US02-FR01: genau eine Rolle je Konto (OF-D7); gilt sofort, weil jede Anfrage die Rolle neu liest (ADR 003). */
export async function rolleZuweisen(
  k: Kontext,
  eingabe: { userId: string; role: Rolle } & MitWeiterenFeldern,
): Promise<Ergebnis<{ userId: string; role: Rolle }>> {
  const rechte = pruefeRolle(k.sitzung, "ADMINISTRATOR");
  if (rechte) return rechte;
  const userId = eingabe?.userId;
  if (!istUuid(userId)) return fehler("NICHT_GEFUNDEN");
  const role = eingabe.role;
  // AK-01.4
  if (!istRolle(role)) return fehler("VALIDIERUNG", { role: "Rolle muss Mitglied, Bibliothekar oder Administrator sein." });
  // AK-01.5, OF-F12-1: nicht die eigene Rolle, damit sich der letzte Administrator nicht aussperrt
  if (userId === k.sitzung!.userId) return fehler("EIGENE_ROLLE");
  // AK-01.6, OF-F12-2: nur die Rolle ändert sich; Ausleihen, Vormerkungen und Mahnungen bleiben
  const geaendert = zeilen<{ id: string }>(
    await k.db.execute(sql`UPDATE users SET role = ${role} WHERE id = ${userId} RETURNING id`),
  );
  if (geaendert.length === 0) return fehler("NICHT_GEFUNDEN");
  return erfolg({ userId, role });
}

export type Systemparameter = { name: EinstellungName; wert: number; standard: number; min: number; max: number; quelle: string };

/** AK-02.1, OF-F12-3: alle Werte der Konfiguration mit aktuellem Wert (über getSetting, ADR 006). */
export async function ladeSystemparameter(k: Kontext): Promise<Ergebnis<Systemparameter[]>> {
  const rechte = pruefeRolle(k.sitzung, "ADMINISTRATOR");
  if (rechte) return rechte;
  const liste: Systemparameter[] = [];
  for (const e of alleEinstellungen()) liste.push({ ...e, wert: await getSetting(k.db, e.name) });
  return erfolg(liste);
}

/** OF-F12-4: Tage, Stunden und Anzahlen ganzzahlig; Tagessatz in Euro mit höchstens zwei Nachkommastellen (Cent). */
function hatErlaubteGenauigkeit(name: EinstellungName, wert: number): boolean {
  if (name === "mahnTagessatzEuro") return Math.abs(Math.round(wert * 100) - wert * 100) < 1e-9;
  return Number.isInteger(wert);
}

export async function systemparameterAendern(
  k: Kontext,
  eingabe: { name: string; wert: number } & MitWeiterenFeldern,
): Promise<Ergebnis<{ name: EinstellungName; wert: number }>> {
  const rechte = pruefeRolle(k.sitzung, "ADMINISTRATOR");
  if (rechte) return rechte;
  const name = eingabe?.name;
  // AK-02.8
  if (!istEinstellungName(name)) return fehler("VALIDIERUNG", { name: "Diesen Systemparameter gibt es nicht." });
  const grenzen = alleEinstellungen().find((e) => e.name === name)!;
  const wert = eingabe.wert;
  // AK-02.7: Grenzen nur aus der Konfiguration, nie aus der Eingabe
  if (
    typeof wert !== "number" ||
    !Number.isFinite(wert) ||
    wert < grenzen.min ||
    wert > grenzen.max ||
    !hatErlaubteGenauigkeit(name, wert)
  ) {
    const art = name === "mahnTagessatzEuro" ? "eine Zahl mit höchstens zwei Nachkommastellen" : "eine ganze Zahl";
    return fehler("VALIDIERUNG", { wert: `Bitte ${art} von ${grenzen.min} bis ${grenzen.max} eingeben.` });
  }
  // AK-02.2, AK-02.9: Wert, Zeitpunkt und Administrator aus der Sitzung
  await k.db.execute(sql`
    INSERT INTO system_settings (key, value, updated_at, updated_by_id)
    VALUES (${name}, ${wert}, ${k.uhr.jetzt()}, ${k.sitzung!.userId})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by_id = EXCLUDED.updated_by_id`);
  return erfolg({ name, wert });
}
