/**
 * Validazione dei file caricati, condivisa dai vari upload (schede, diete, polizze).
 * Ogni tab mostrava l'errore a modo suo (chi con un toast, chi con un alert): qui centralizziamo
 * solo *le regole* (dev'essere un PDF, max 10MB) e lasciamo a ciascun componente come comunicarle.
 */

/** Limite di default per gli upload di documenti: 10MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/** Verifica che il file sia un PDF entro il limite di dimensione. */
export function validatePdfFile(file: File, maxBytes: number = MAX_PDF_BYTES): FileValidationResult {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Puoi caricare solo file PDF.' };
  }
  if (file.size > maxBytes) {
    return { valid: false, error: 'Il file non può superare i 10MB.' };
  }
  return { valid: true };
}
