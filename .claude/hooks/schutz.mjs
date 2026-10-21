// PreToolUse-Hook: blockiert Datei-Änderungen an geschützten Pfaden.
// Aufruf: node schutz.mjs <gruppe> [<gruppe> …]   Gruppen: tests, config
import path from "node:path";

const GRUPPEN = {
  tests: [/\.(test|spec)\.[cm]?[jt]sx?$/, /^(tests|e2e)\//, /(^|\/)__tests__\//],
  config: [/^config\//, /^\.github\//, /^\.claude\//, /^CLAUDE\.md$/, /^package(-lock)?\.json$/, /^\.env/],
};

let eingabe = "";
for await (const teil of process.stdin) eingabe += teil;

const datei = JSON.parse(eingabe || "{}").tool_input?.file_path ?? "";
const projekt = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const relativ = path.relative(projekt, path.resolve(projekt, datei)).split(path.sep).join("/");

for (const gruppe of process.argv.slice(2)) {
  if ((GRUPPEN[gruppe] ?? []).some((muster) => muster.test(relativ))) {
    console.error(`Gesperrt (${gruppe}): ${relativ} darf dieser Agent nicht ändern. Siehe CLAUDE.md, „Verboten für alle Agenten“.`);
    process.exit(2);
  }
}
