import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Subscription, UserManagementMode } from '../../shared/models/dashboard.model';

export type PaymentFrequency = 'UNICA_SOLUZIONE' | 'RATE_MENSILI';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  activateSubscription(planId: number, paymentFrequency: PaymentFrequency): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.apiUrl}/api/subscriptions/activate`, { planId, paymentFrequency });
  }

  getAllSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.apiUrl}/api/admin/subscriptions`);
  }

  getInsuranceSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.apiUrl}/api/insurance/subscriptions`);
  }

  private usersBaseByMode(mode: UserManagementMode): string {
    return mode === 'moderator'
      ? `${this.apiUrl}/api/moderator/users`
      : `${this.apiUrl}/api/admin/users`;
  }

  getAllSubscriptionsByMode(mode: UserManagementMode): Observable<Subscription[]> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions`;
    return this.http.get<Subscription[]>(url);
  }

  updateSubscriptionCredits(mode: UserManagementMode, subscriptionId: number, creditsPT: number, creditsNutri: number): Observable<void> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions/${subscriptionId}/credits`;
    return this.http.put<void>(url, { creditsPT, creditsNutri });
  }
}
