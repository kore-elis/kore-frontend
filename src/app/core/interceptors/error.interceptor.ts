import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';
import { StorageService } from '../services/storage.service';

/**
 * Gestione centralizzata degli errori HTTP. Logga sempre (così nessun errore
 * resta silenzioso anche dove il componente non lo gestisce) e poi:
 *  - 401 (fuori dal login): il token è scaduto/non valido → pulizia e ritorno al login;
 *  - 0 (rete assente) e 5xx (errore server): toast generico, casi che i componenti
 *    raramente gestiscono da soli;
 *  - 4xx restano ai gestori contestuali dei componenti (validazioni, conflitti, ecc.),
 *    per non sovrapporre toast doppi.
 * L'errore viene comunque rilanciato, così i gestori locali continuano a funzionare.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(LoggerService);
  const toast = inject(ToastService);
  const router = inject(Router);
  const storage = inject(StorageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      log.error(`[HTTP ${err.status}] ${req.method} ${req.url}`, err.error ?? err.message);

      const isAuthCall = req.url.includes('/api/auth/');

      if (err.status === 401 && !isAuthCall) {
        storage.remove('token');
        storage.remove('user');
        router.navigate(['/login']);
      } else if (err.status === 0) {
        toast.error('Connessione assente', 'Impossibile contattare il server. Riprova.');
      } else if (err.status >= 500) {
        toast.error('Errore del server', 'Si è verificato un problema. Riprova più tardi.');
      }

      return throwError(() => err);
    }),
  );
};
