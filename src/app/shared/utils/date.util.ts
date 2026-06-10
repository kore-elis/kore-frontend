/**
 * Formattazione date condivisa.
 * Prima questa stessa riga era copiata in mezza dashboard (schede, polizze, documenti admin...):
 * la teniamo in un solo posto così se un giorno cambiamo il formato lo cambiamo qui e basta.
 */

/** Data lunga in italiano, es. "3 giu 2026". Accetta sia stringa ISO che Date. */
export function formatLongDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}
