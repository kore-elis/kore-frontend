import { Injectable, isDevMode } from '@angular/core';

/**
 * Logger centralizzato: in produzione silenzia debug e warn (che servono solo
 * in sviluppo) e tiene attivi gli error, utili per il reporting. Così evitiamo
 * `console.*` sparsi che inquinano la console in produzione.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly dev = isDevMode();

  debug(...args: unknown[]): void {
    if (this.dev) console.log(...args);
  }

  warn(...args: unknown[]): void {
    if (this.dev) console.warn(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}
