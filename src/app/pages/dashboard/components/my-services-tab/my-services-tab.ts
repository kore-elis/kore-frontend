import { Component, Input, inject, ChangeDetectorRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService, ClientDocument } from '../../../../core/services/document.service';
import { AuthUser } from '../../../../shared/models/dashboard.model';
import { PdfViewerComponent } from '../../../../shared/components/ui/pdf-viewer/pdf-viewer';
import { formatLongDate } from '../../../../shared/utils/date.util';

@Component({
  selector: 'app-my-services-tab',
  standalone: true,
  imports: [CommonModule, PdfViewerComponent],
  templateUrl: './my-services-tab.html'
})
export class MyServicesTabComponent implements OnInit {
  private documentService = inject(DocumentService);
  private cdr = inject(ChangeDetectorRef);

  @Input() currentUser: AuthUser | null = null;

  @ViewChild('pdfViewer') pdfViewer!: PdfViewerComponent;

  activeTab: string = 'scheda';
  docs: ClientDocument[] = [];
  loading: boolean = false;
  private loadedType: string = '';

  ngOnInit(): void {
    this.loadDocs('scheda');
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.loadedType = ''; // Forza ricaricamento
    this.loadDocs(tab);
  }

  loadDocs(tab: string): void {
    if (!this.currentUser) return;
    const typeMap: Record<string, string> = { scheda: 'WORKOUT_PLAN', dieta: 'DIET_PLAN', polizza: 'INSURANCE_POLICE' };
    const type = typeMap[tab];
    if (!type || this.loadedType === type) return;
    this.loading = true;
    this.loadedType = type;
    this.documentService.getClientDocumentsByType(this.currentUser.id, type).subscribe({
      next: (docs) => { this.docs = docs ?? []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.docs = []; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  viewPdf(doc: ClientDocument): void {
    this.pdfViewer.view(doc.fileName, this.documentService.downloadDocument(doc.id));
  }

  formatDate(d: string): string {
    return formatLongDate(d);
  }

  getTabIcon(tab: string): string {
    switch (tab) { case 'scheda': return '💪'; case 'dieta': return '🥗'; case 'polizza': return '🛡️'; default: return '📄'; }
  }

  getTabLabel(tab: string): string {
    switch (tab) { case 'scheda': return 'Scheda'; case 'dieta': return 'Dieta'; case 'polizza': return 'Polizza'; default: return tab; }
  }
}

