"use server";
// F-08 · Benachrichtigungen als gelesen markieren. Prüfung in src/server/benachrichtigungen.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { benachrichtigungenGelesen } from "@/server/benachrichtigungen";

export async function alleGelesenMarkieren(): Promise<void> {
  const ergebnis = await benachrichtigungenGelesen(await erstelleKontext());
  if (!ergebnis.ok) redirect("/anmelden?weiter=%2Fkonto%2Fbenachrichtigungen");
  revalidatePath("/", "layout");
}
