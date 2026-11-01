// F-08 / F-10 · Eigene Benachrichtigungen: Erinnerung, Mahnung, abholbereit (OF-D8, OF-F08-5)
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { ladeMeineBenachrichtigungen, type Benachrichtigung } from "@/server/benachrichtigungen";
import { alleGelesenMarkieren } from "../../aktionen/benachrichtigungen";
import { Zugriffsfehler } from "../../zugriff";

export const instant = false;

const ZEIT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

function text(b: Benachrichtigung): string {
  const titel = b.title ? `„${b.title}“` : "Ein Exemplar";
  const nummer = b.inventoryNumber ? ` (${b.inventoryNumber})` : "";
  switch (b.type) {
    case "ERINNERUNG":
      return `${titel}${nummer} ist am ${b.dueDate ? formatiereDatum(b.dueDate) : "–"} fällig.`;
    case "MAHNUNG":
      return `Die Frist für ${titel}${nummer} ist überschritten. Es wurde eine Mahnung erstellt.`;
    case "ABHOLBEREIT":
      return `${titel}${nummer} liegt für dich bereit. Abholen bis einschließlich ${b.pickupDeadline ? formatiereDatum(b.pickupDeadline) : "–"}.`;
  }
}

const ART: Record<Benachrichtigung["type"], string> = {
  ERINNERUNG: "Erinnerung",
  MAHNUNG: "Mahnung",
  ABHOLBEREIT: "Abholbereit",
};

export default async function Benachrichtigungen() {
  const ergebnis = await ladeMeineBenachrichtigungen(await erstelleKontext());
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/konto/benachrichtigungen" />;
  const liste = ergebnis.daten;
  const ungelesen = liste.filter((b) => !b.gelesen).length;

  return (
    <>
      <h1>Benachrichtigungen</h1>
      {liste.length === 0 ? (
        <p className="meldung" role="status">
          Du hast keine Benachrichtigungen.
        </p>
      ) : (
        <>
          {ungelesen > 0 && (
            <form action={alleGelesenMarkieren} className="aktionen">
              <button type="submit" className="leise">
                Alle als gelesen markieren ({ungelesen})
              </button>
            </form>
          )}
          <ul className="liste-benachrichtigungen">
            {liste.map((b) => (
              <li key={b.notificationId} className={b.gelesen ? "gelesen" : "ungelesen"}>
                <span className={`marke-art art-${b.type.toLowerCase()}`}>{ART[b.type]}</span>
                <span>{text(b)}</span>
                <time dateTime={b.createdAt} className="hinweis">
                  {ZEIT.format(new Date(b.createdAt))}
                  {!b.gelesen && " · neu"}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
