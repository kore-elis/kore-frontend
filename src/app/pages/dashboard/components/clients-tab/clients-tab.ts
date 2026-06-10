import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, ClientDocument } from '../../../../core/services/document.service';
import { ClientBasicInfo, AuthUser } from '../../../../shared/models/dashboard.model';
import { PdfViewerComponent } from '../../../../shared/components/ui/pdf-viewer/pdf-viewer';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog';
import { formatLongDate } from '../../../../shared/utils/date.util';
import { validatePdfFile } from '../../../../shared/utils/file.util';

@Component({
  selector: 'app-clients-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfViewerComponent, ConfirmDialogComponent],
  templateUrl: './clients-tab.html',
  styleUrls: ['./clients-tab.css']
})
export class ClientsTabComponent {
  private authService = inject(DocumentService);
  private cdr = inject(ChangeDetectorRef);

  @Input() myClients: ClientBasicInfo[] = [];
  @Input() currentUser: AuthUser | null = null;
  @Output() showPopup = new EventEmitter<{title: string, message: string, type: 'success' | 'error' | 'warning'}>();

  @ViewChild('pdfViewer') pdfViewer!: PdfViewerComponent;

  selectedClient: ClientBasicInfo | null = null;
  clientDocuments: ClientDocument[] = [];
  clientDocsLoading: boolean = false;
  docFilterType: string = 'ALL';
  isUploading: boolean = false;

  // Trascina e rilascia
  isDragOver: boolean = false;
  dragCounter: number = 0;

  // Notes editing
  editingNotesDocId: number | null = null;
  editingNotesText: string = '';
  savingNotes: boolean = false;

  // Modale conferma eliminazione documento
  showDeleteModal: boolean = false;
  docToDelete: ClientDocument | null = null;
  deletingDoc: boolean = false;

  openClientDetail(client: ClientBasicInfo): void {
    this.selectedClient = client;
    this.clientDocuments = [];
    this.docFilterType = 'ALL';
    this.loadClientDocuments();
  }

  closeClientDetail(): void {
    this.selectedClient = null;
    this.clientDocuments = [];
  }

  loadClientDocuments(): void {
    if (!this.selectedClient) return;
    this.clientDocsLoading = true;
    const clientId = this.selectedClient.id;
    const obs = this.docFilterType === 'ALL'
      ? this.authService.getClientDocuments(clientId)
      : this.authService.getClientDocumentsByType(clientId, this.docFilterType);
    obs.subscribe({
      next: (docs) => { this.clientDocuments = docs; this.clientDocsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.clientDocsLoading = false; this.cdr.detectChanges(); }
    });
  }

  onDocFilterChange(type: string): void {
    this.docFilterType = type;
    this.loadClientDocuments();
  }

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.selectedClient) return;
    const file = input.files[0];
    const check = validatePdfFile(file);
    if (!check.valid) { this.showPopup.emit({title: 'Errore', message: check.error!, type: 'error'}); input.value = ''; return; }
    this.isUploading = true;
    this.authService.uploadDocument(file, this.selectedClient.id, type).subscribe({
      next: () => { this.isUploading = false; this.showPopup.emit({title: 'Caricato!', message: `${type === 'WORKOUT_PLAN' ? 'Scheda' : 'Dieta'} caricata con successo.`, type: 'success'}); this.loadClientDocuments(); input.value = ''; },
      error: () => { this.isUploading = false; this.showPopup.emit({title: 'Errore', message: 'Impossibile caricare il file. Riprova.', type: 'error'}); input.value = ''; }
    });
  }

  // Trascina e rilascia

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter++;
    if (event.dataTransfer?.types.includes('Files')) {
      this.isDragOver = true;
      this.cdr.detectChanges();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.isDragOver = false;
      this.cdr.detectChanges();
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    this.dragCounter = 0;
    this.cdr.detectChanges();

    if (this.isUploading || !this.selectedClient) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const check = validatePdfFile(file);
    if (!check.valid) {
      this.showPopup.emit({ title: 'Errore', message: check.error!, type: 'error' });
      return;
    }

    // Determina il tipo di documento in base al ruolo
    const type = this.getUploadType();
    if (!type) return;

    this.isUploading = true;
    this.cdr.detectChanges();
    this.authService.uploadDocument(file, this.selectedClient.id, type).subscribe({
      next: () => {
        this.isUploading = false;
        this.showPopup.emit({ title: 'Caricato!', message: `${type === 'WORKOUT_PLAN' ? 'Scheda' : 'Dieta'} caricata con successo.`, type: 'success' });
        this.loadClientDocuments();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isUploading = false;
        this.showPopup.emit({ title: 'Errore', message: 'Impossibile caricare il file. Riprova.', type: 'error' });
        this.cdr.detectChanges();
      }
    });
  }

  getUploadType(): string | null {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return 'DIET_PLAN';
    return null;
  }

  getDropzoneLabel(): string {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return 'Trascina qui una scheda PDF';
    if (this.currentUser?.role === 'NUTRITIONIST') return 'Trascina qui una dieta PDF';
    return 'Trascina qui un PDF';
  }

  viewDocument(doc: ClientDocument): void {
    this.pdfViewer.view(
      doc.fileName,
      this.authService.downloadDocument(doc.id),
      () => this.showPopup.emit({ title: 'Errore', message: 'Impossibile aprire il documento.', type: 'error' })
    );
  }

  openDeleteModal(doc: ClientDocument): void {
    this.docToDelete = doc;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.docToDelete = null;
    this.deletingDoc = false;
  }

  confirmDeleteDoc(): void {
    if (!this.docToDelete) return;
    const doc = this.docToDelete;
    this.deletingDoc = true;
    this.authService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.showPopup.emit({title: 'Eliminato', message: 'Documento eliminato con successo.', type: 'success'});
        this.loadClientDocuments();
      },
      error: () => {
        this.closeDeleteModal();
        this.showPopup.emit({title: 'Errore', message: 'Impossibile eliminare il documento.', type: 'error'});
      }
    });
  }

  getDocTypeLabel(type: string): string {
    switch (type) { case 'WORKOUT_PLAN': return 'Scheda'; case 'DIET_PLAN': return 'Dieta'; case 'MEDICAL_CERT': return 'Certificato'; case 'INSURANCE_POLICE': return 'Polizza'; default: return type; }
  }

  getDocTypeIcon(type: string): string {
    switch (type) { case 'WORKOUT_PLAN': return '💪'; case 'DIET_PLAN': return '🥗'; case 'MEDICAL_CERT': return '🏥'; case 'INSURANCE_POLICE': return '📋'; default: return '📄'; }
  }

  formatDocDate(dateStr: string): string {
    return formatLongDate(dateStr);
  }

  // Il personal trainer carica solo schede di allenamento.
  canUploadWorkout(): boolean {
    return this.currentUser?.role === 'PERSONAL_TRAINER';
  }

  // Il nutrizionista carica solo diete.
  canUploadDiet(): boolean {
    return this.currentUser?.role === 'NUTRITIONIST';
  }

  // Ognuno può cancellare solo il tipo di documento che gli compete caricare.
  canDeleteDoc(doc: ClientDocument): boolean {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return doc.type === 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return doc.type === 'DIET_PLAN';
    return false;
  }

  // Stessa regola per le note: si toccano solo sui documenti del proprio ruolo.
  canEditNotes(doc: ClientDocument): boolean {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return doc.type === 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return doc.type === 'DIET_PLAN';
    return false;
  }

  toggleNotesEdit(doc: ClientDocument): void {
    if (this.editingNotesDocId === doc.id) {
      this.editingNotesDocId = null;
      this.editingNotesText = '';
    } else {
      this.editingNotesDocId = doc.id;
      this.editingNotesText = doc.notes || '';
    }
  }

  saveNotes(doc: ClientDocument): void {
this.authService.updateDocumentNotes(this.editingNotesDocId!, this.editingNotesText).subscribe({
      next: () => {
        const found = this.clientDocuments.find(d => d.id === this.editingNotesDocId);
        if (found) found.notes = this.editingNotesText;
        if (doc) doc.notes = this.editingNotesText;
        this.editingNotesDocId = null;
        this.editingNotesText = '';
        this.savingNotes = false;
        this.showPopup.emit({ title: 'Salvato!', message: 'Appunti aggiornati con successo.', type: 'success' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingNotes = false;
        this.showPopup.emit({ title: 'Errore', message: 'Impossibile salvare gli appunti.', type: 'error' });
        this.cdr.detectChanges();
      }
    });
  }
}
