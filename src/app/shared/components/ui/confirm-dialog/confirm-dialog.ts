import { Component, Input, Output, EventEmitter } from '@angular/core';

/**
 * Modale di conferma riutilizzabile (stesso stile dell'eliminazione utente).
 * Il corpo del messaggio si passa via content projection (<ng-content>) così
 * ogni chiamante può evidenziare in grassetto il nome del documento.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() loading = false;
  @Input() confirmLabel = 'Elimina';
  @Input() loadingLabel = 'Eliminazione...';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    if (this.loading) return;
    this.confirmed.emit();
  }

  onCancel(): void {
    if (this.loading) return;
    this.cancelled.emit();
  }
}
