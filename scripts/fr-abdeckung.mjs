// Zeigt, welche Anforderungen (Enn-USnn-FRnn) mindestens einen Test haben.
// Quelle der IDs: docs/anforderungen.txt. Gesucht wird in allen Testdateien.
// Optional: --pflicht E01,E02,E03  → Exit-Code 1, wenn eine FR dieser Epics keinen Test hat.
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ID = /E\d{2}-US\d{2}-FR\d{2}/g;
const TESTDATEI = /\.(test|spec)\.[cm]?[jt]sx?$/;
const IGNORIERT = new Set(["node_modules", ".next", ".git", "coverage", "playwright-report", "test-results"]);

const alle = readFileSync("docs/anforderungen.txt", "utf8")
  .split("\n").map((z) => z.trim()).filter((z) => z && !z.startsWith("#"));

const fundstellen = new Map(alle.map((id) => [id, []]));
function durchsuche(ordner) {
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    if (IGNORIERT.has(eintrag.name)) continue;
    const pfad = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) durchsuche(pfad);
    else if (TESTDATEI.test(eintrag.name)) {
      for (const id of new Set(readFileSync(pfad, "utf8").match(ID) ?? [])) fundstellen.get(id)?.push(pfad);
    }
  }
}
durchsuche(".");

const offen = alle.filter((id) => fundstellen.get(id).length === 0);
const zeilen = [
  `## Testabdeckung der Anforderungen: ${alle.length - offen.length} von ${alle.length} FRs haben einen Test`,
  "",
  "| FR | Tests |",
  "|---|---|",
  ...alle.map((id) => `| ${id} | ${fundstellen.get(id).join(", ") || "– kein Test –"} |`),
];
const bericht = zeilen.join("\n") + "\n";
console.log(bericht);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, bericht);

const i = process.argv.indexOf("--pflicht");
if (i > -1) {
  const epics = (process.argv[i + 1] ?? "").split(",");
  const fehlend = offen.filter((id) => epics.some((e) => id.startsWith(e + "-")));
  if (fehlend.length) {
    console.error(`Ohne Test (Pflicht für ${epics.join(", ")}): ${fehlend.join(", ")}`);
    process.exit(1);
  }
}
