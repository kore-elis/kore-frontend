import { Component, Input, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, ClientDocument } from '../../../../core/services/document.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthUser, Subscription, UserProfile } from '../../../../shared/models/dashboard.model';
import { PdfViewerComponent } from '../../../../shared/components/ui/pdf-viewer/pdf-viewer';
import { ConfirmDialogComponent } from '../../../../shared/components/ui/confirm-dialog/confirm-dialog';
import { formatLongDate } from '../../../../shared/utils/date.util';
import { getInitials } from '../../../../shared/utils/user.util';
import { validatePdfFile } from '../../../../shared/utils/file.util';

/** Abbonamento assicurativo arricchito col cliente coperto (risolto da userId). */
interface InsuranceCoveredClient extends Subscription {
  user: UserProfile;
  userId: number;
}

@Component({
  selector: 'app-insurance-home-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfViewerComponent, ConfirmDialogComponent],
  templateUrl: './insurance-home-tab.html'
})
export class InsuranceHomeTabComponent {
  private authService = inject(DocumentService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  @Input() currentUser: AuthUser | null = null;
  @Input() allSubscriptions: Subscription[] = [];
  @Input() allUsers: UserProfile[] = [];

  @ViewChild('pdfViewer') pdfViewer!: PdfViewerComponent;

  searchQuery: string = '';
  selectedClient: InsuranceCoveredClient | null = null;
  clientDocs: ClientDocument[] = [];
  docsLoading: boolean = false;
  isUploading: boolean = false;
  isDragOver: boolean = false;

  editingNotesDocId: number | null = null;
  editingNotes: string = '';
  savingNotes: boolean = false;

  // Modale conferma eliminazione documento
  showDeleteModal: boolean = false;
  docToDelete: ClientDocument | null = null;
  deletingDoc: boolean = false;

  get activePolicies(): number { return this.allSubscriptions.filter(s => s.active).length; }
  get expiredPolicies(): number { return this.allSubscriptions.filter(s => !s.active).length; }
  get coveredClients(): InsuranceCoveredClient[] {
    return this.allSubscriptions.map(s => ({
      ...s,
      user: this.allUsers.find(u => u.id === s.userId)
    })).filter((s): s is InsuranceCoveredClient => !!s.user);
  }
  get filteredClients(): InsuranceCoveredClient[] {
    if (!this.searchQuery.trim()) return this.coveredClients;
    const q = this.searchQuery.toLowerCase();
    return this.coveredClients.filter(c =>
      (c.user.firstName + ' ' + c.user.lastName).toLowerCase().includes(q) ||
      c.user.email?.toLowerCase().includes(q)
    );
  }

  getInitials(): string {
    return getInitials(this.currentUser);
  }

  openClientDocs(sub: InsuranceCoveredClient): void {
    this.selectedClient = sub;
    this.docsLoading = true;
    this.editingNotesDocId = null;
    this.authService.getClientPolicies(sub.userId).subscribe({
      next: (docs) => { this.clientDocs = docs; this.docsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.clientDocs = []; this.docsLoading = false; this.cdr.detectChanges(); }
    });
  }

  closeClientDocs(): void { this.selectedClient = null; this.clientDocs = []; }

  viewPdf(doc: ClientDocument): void {
    this.pdfViewer.view(doc.fileName, this.authService.downloadPolicy(doc.id));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const check = validatePdfFile(files[0]);
      if (check.valid) {
        this.uploadFile(files[0]);
      } else {
        alert(check.error);
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const check = validatePdfFile(file);
      if (check.valid) {
        this.uploadFile(file);
      } else {
        alert(check.error);
      }
    }
    input.value = ''; // Reset input per permmettere il ricaricamento dello stesso file se necessario
  }

  private uploadFile(file: File): void {
    const client = this.selectedClient;
    if (!client || !this.currentUser) return;
    this.isUploading = true;
    this.authService.uploadInsurancePolicy(file, client.userId).subscribe({
      next: () => {
        this.isUploading = false;
        this.openClientDocs(client);
      },
      error: (err) => {
        this.isUploading = false;
        console.error('Upload polizza fallito', err);
        alert('Impossibile caricare la polizza. Riprova.');
      }
    });
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
    this.authService.deletePolicy(doc.id).subscribe({
      next: () => {
        this.clientDocs = this.clientDocs.filter(d => d.id !== doc.id);
        this.closeDeleteModal();
        this.toast.success('Eliminato', 'Polizza eliminata con successo.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Eliminazione polizza fallita', err);
        this.closeDeleteModal();
        this.toast.error('Errore', 'Impossibile eliminare la polizza. Riprova.');
        this.cdr.detectChanges();
      }
    });
  }

  startEditNotes(doc: ClientDocument): void {
    this.editingNotesDocId = doc.id;
    this.editingNotes = doc.notes || '';
  }

  cancelEditNotes(): void {
    this.editingNotesDocId = null;
    this.editingNotes = '';
  }

  saveNotes(doc: ClientDocument): void {
    if (this.savingNotes) return;
    this.savingNotes = true;
    this.authService.updatePolicyNotes(doc.id, this.editingNotes).subscribe({
      next: () => {
        doc.notes = this.editingNotes;
        this.editingNotesDocId = null;
        this.editingNotes = '';
        this.savingNotes = false;
        this.cdr.detectChanges();
      },
      error: () => { this.savingNotes = false; }
    });
  }

  formatDate(d: string): string { return formatLongDate(d); }
}
