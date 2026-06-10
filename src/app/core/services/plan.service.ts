import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Plan } from '../../shared/models/dashboard.model';

/**
 * Dati inviati dai form admin per creare/aggiornare un piano. `duration` qui è
 * una stringa grezza (valore della select) e viene validata lato backend.
 */
export interface PlanPayload {
  name: string;
  duration: string;
  fullPrice: number;
  monthlyInstallmentPrice: number;
  monthlyCreditsPT: number;
  monthlyCreditsNutri: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Piani visibili a clienti e pubblico (solo quelli attivi).
  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/api/plans`);
  }

  // Vista admin: ci sono anche i piani disabilitati.
  getAdminPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/api/admin/plans`);
  }

  createPlan(data: PlanPayload): Observable<Plan> {
    return this.http.post<Plan>(`${this.apiUrl}/api/admin/plans`, data);
  }

  // Disabilita un piano senza cancellarlo: resta in DB, sparisce solo dal pubblico.
  disablePlan(planId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/api/admin/plans/${planId}/disable`, {});
  }

  enablePlan(planId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/api/admin/plans/${planId}/enable`, {});
  }

  updatePlan(planId: number, data: PlanPayload): Observable<Plan> {
    return this.http.put<Plan>(`${this.apiUrl}/api/admin/plans/${planId}`, data);
  }
}

