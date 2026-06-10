import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Documento/polizza così come arriva dal backend. I campi opzionali non sono
 * sempre valorizzati (es. le note sono vuote finché un professionista non le scrive).
 */
export interface ClientDocument {
  id: number;
  fileName: string;
  type: string;
  uploadDate: string;
  notes?: string;
  uploadedByName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  uploadDocument(file: File, clientId: number, type: string): Observable<ClientDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId.toString());
    formData.append('type', type);
    return this.http.post<ClientDocument>(`${this.apiUrl}/api/documents/upload`, formData);
  }

  getClientDocuments(clientId: number): Observable<ClientDocument[]> {
    return this.http.get<ClientDocument[]>(`${this.apiUrl}/api/documents/user/${clientId}`);
  }

  getClientDocumentsByType(clientId: number, type: string): Observable<ClientDocument[]> {
    return this.http.get<ClientDocument[]>(`${this.apiUrl}/api/documents/user/${clientId}/type/${type}`);
  }

  downloadDocument(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/documents/download/${documentId}`, { responseType: 'blob' });
  }

  deleteDocument(documentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/documents/${documentId}`);
  }

  updateDocumentNotes(documentId: number, notes: string): Observable<ClientDocument> {
    return this.http.put<ClientDocument>(`${this.apiUrl}/api/documents/${documentId}/notes`, { notes });
  }

  // Polizze assicurative: vivono su endpoint a parte (/api/insurance) ma la
  // logica di upload/download è la stessa dei documenti normali.

  uploadInsurancePolicy(file: File, clientId: number): Observable<ClientDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ClientDocument>(`${this.apiUrl}/api/insurance/clients/${clientId}/policy`, formData);
  }

  getClientPolicies(clientId: number): Observable<ClientDocument[]> {
    return this.http.get<ClientDocument[]>(`${this.apiUrl}/api/insurance/clients/${clientId}/policies`);
  }

  downloadPolicy(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/insurance/policies/${documentId}/download`, { responseType: 'blob' });
  }

  deletePolicy(documentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/insurance/policies/${documentId}`);
  }

  updatePolicyNotes(documentId: number, notes: string): Observable<ClientDocument> {
    return this.http.put<ClientDocument>(`${this.apiUrl}/api/insurance/policies/${documentId}/notes`, { notes });
  }
}

