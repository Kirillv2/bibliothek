// Passwort-Hash mit scrypt aus node:crypto (ADR 003, NFR03): zufälliges Salt je Passwort,
// zeitkonstanter Vergleich. Kostenparameter: Standardwerte von Node (technische Konfiguration).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (passwort: string, salt: Buffer, laenge: number) => Promise<Buffer>;
const SCHLUESSEL_LAENGE = 64;

/** Hash im Format `scrypt$<salt>$<hash>` (Base64). Der Klartext wird nie gespeichert. */
export async function hashePasswort(passwort: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(passwort, salt, SCHLUESSEL_LAENGE);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function pruefePasswort(passwort: string, gespeichert: string): Promise<boolean> {
  const [verfahren, saltText, hashText] = gespeichert.split("$");
  if (verfahren !== "scrypt" || !saltText || !hashText) return false;
  const erwartet = Buffer.from(hashText, "base64");
  const berechnet = await scryptAsync(passwort, Buffer.from(saltText, "base64"), erwartet.length);
  return erwartet.length === berechnet.length && timingSafeEqual(erwartet, berechnet);
}
