import { anmelden } from "../aktionen/anmeldung";

export const instant = false;

export default async function AnmeldenSeite({ searchParams }: PageProps<"/anmelden">) {
  const { fehler, weiter } = await searchParams;
  const ziel = typeof weiter === "string" ? weiter : "/";
  return (
    <>
      <h1>Anmelden</h1>
      {fehler && (
        <p className="meldung fehler" role="alert">
          E-Mail oder Passwort ist nicht korrekt.
        </p>
      )}
      <form action={anmelden} className="felder">
        <input type="hidden" name="weiter" value={ziel} />
        <label>
          E-Mail
          <input type="email" name="email" autoComplete="username" required />
        </label>
        <label>
          Passwort
          <input type="password" name="passwort" autoComplete="current-password" required />
        </label>
        <div>
          <button type="submit">Anmelden</button>
        </div>
      </form>
    </>
  );
}
