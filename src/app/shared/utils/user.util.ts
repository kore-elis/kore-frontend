/**
 * Helper sull'utente riusati da più tab.
 * Le iniziali (per gli avatar a cerchietto) erano calcolate allo stesso identico modo
 * in home, admin-home, insurance, documenti admin e nella dashboard: una funzione sola.
 */

/** Iniziali maiuscole da nome e cognome, es. "Mario Rossi" -> "MR". Tollera campi mancanti. */
export function getInitials(user: { firstName?: string; lastName?: string } | null | undefined): string {
  const f = (user?.firstName ?? '').charAt(0);
  const l = (user?.lastName ?? '').charAt(0);
  return (f + l).toUpperCase();
}

/**
 * Match di ricerca su nome+cognome o email: stessa logica che era copiata in
 * admin-documents, admin-users e chat (user picker). Query vuota = sempre match.
 */
export function matchesUserSearch(
  user: { firstName?: string; lastName?: string; email?: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
  return name.includes(q) || (user.email?.toLowerCase().includes(q) ?? false);
}
