import { Component, inject, ChangeDetectorRef } from '@angular/core';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';

/**
 * Visualizzatore PDF inline riusabile.
 *
 * Prima questo identico blocco — overlay, scarico del blob, branch desktop/mobile e gestione
 * del sanitizer — era copiaincollato in quattro tab (schede, polizze, documenti cliente e admin).
 * Adesso vive qui: il componente ospite si limita a chiamare `open(nomeFile, download$)` passando
 * l'observable di download del suo service, e a tutto il resto (loading, errori, revoca dell'URL,
 * apertura in nuova scheda su mobile) pensa questo componente.
 */
@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [],
  templateUrl: './pdf-viewer.html'
})
export class PdfViewerComponent {
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  open = false;
  url: SafeResourceUrl | null = null;
  fileName = '';
  loading = false;
  private blobUrl: string | null = null;

  /**
   * Apre il viewer per un documento. `download$` è l'observable che restituisce il blob
   * (es. `documentService.downloadDocument(id)`); l'eventuale `onError` serve a chi vuole
   * mostrare un proprio toast oltre alla semplice chiusura.
   */
  view(fileName: string, download$: Observable<Blob>, onError?: () => void): void {
    this.loading = true;
    this.fileName = fileName;
    this.open = true;
    this.cdr.detectChanges();

    download$.subscribe({
      next: (blob) => {
        if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = URL.createObjectURL(blob);
        // Mostriamo sempre il documento nella cornice inline, anche su mobile: l'overlay è già
        // responsive. Per chi preferisce la scheda intera resta il bottone "Apri in nuova tab".
        this.url = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl + '#view=FitH&zoom=page-width');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.open = false;
        this.loading = false;
        this.cdr.detectChanges();
        onError?.();
      }
    });
  }

  close(): void {
    this.open = false;
    this.url = null;
    this.fileName = '';
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  openInNewTab(): void {
    if (this.blobUrl) window.open(this.blobUrl, '_blank');
  }
}
