"use client";
import { useActionState } from "react";
import type { Rolle } from "@/server/kontext";
import { rolleZuweisenAusloesen } from "../../aktionen/administration";
import { ROLLENTEXT } from "../rollen-text";

export function RolleFormular({ userId, email, role }: { userId: string; email: string; role: Rolle }) {
  const [meldung, ausfuehren, laeuft] = useActionState(rolleZuweisenAusloesen, null);
  return (
    <form action={ausfuehren} className="aktionen eng">
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={role} aria-label={`Rolle für ${email}`}>
        {(Object.keys(ROLLENTEXT) as Rolle[]).map((r) => (
          <option key={r} value={r}>
            {ROLLENTEXT[r]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={laeuft}>
        Speichern
      </button>
      {meldung && (
        <span className={meldung.ok ? "hinweis" : "feldfehler"} role={meldung.ok ? "status" : "alert"}>
          {meldung.text}
        </span>
      )}
    </form>
  );
}
