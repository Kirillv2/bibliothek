// F-06 · E03-US02-FR03 · Neue Fälligkeit bei Verlängerung (AK-03.1, AK-03.2, OF-F06-2)
import { plusTage, type Datum } from "./datum";

/** Verlängerungstag + Leihfrist, aber nie früher als die alte Fälligkeit. */
export function berechneNeueFaelligkeit(eingabe: {
  alteFaelligkeit: Datum;
  verlaengerungstag: Datum;
  leihfristTage: number;
}): Datum {
  const neu = plusTage(eingabe.verlaengerungstag, eingabe.leihfristTage);
  // JJJJ-MM-TT lässt sich als Text vergleichen
  return neu > eingabe.alteFaelligkeit ? neu : eingabe.alteFaelligkeit;
}
