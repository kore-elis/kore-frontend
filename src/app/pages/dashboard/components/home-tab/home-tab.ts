import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../../../core/services/plan.service';
import { SubscriptionService, PaymentFrequency } from '../../../../core/services/subscription.service';
import {
  Plan, Subscription, DashboardData, AuthUser, UserProfile,
  Booking, ClientBasicInfo, ProfessionalSummary, ProStats, ActivityFeedItem
} from '../../../../shared/models/dashboard.model';
import { getInitials } from '../../../../shared/utils/user.util';

@Component({
  selector: 'app-home-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-tab.html',
  styleUrls: ['./home-tab.css']
})
export class HomeTabComponent implements OnInit {
  private planService = inject(PlanService);
  private subscriptionService = inject(SubscriptionService);

  @Input() isLoading: boolean = true;
  @Input() dashboardData: DashboardData | null = null;

  private _currentUser: AuthUser | null = null;
  @Input() set currentUser(value: AuthUser | null) { this._currentUser = value; }
  get currentUser(): AuthUser { return this._currentUser!; }
  @Input() profile: UserProfile | undefined;
  @Input() subscription: Subscription | null = null;
  @Input() bookings: Booking[] = [];
  @Input() myClients: ClientBasicInfo[] = [];
  @Input() professionals: ProfessionalSummary[] = [];
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() weekBookingsCount: number = 0;

  // Statistiche professionista
  @Input() proStats: ProStats | null = null;

  // Cronologia attività
  @Input() activityFeed: ActivityFeedItem[] = [];

  // Subscription activation
  plans: Plan[] = [];
  selectedPlanId: number | null = null;
  selectedFrequency: PaymentFrequency = 'UNICA_SOLUZIONE';
  activationLoading = false;
  activationError: string | null = null;
  activationSuccess = false;

  @Output() openAvailabilityEvent = new EventEmitter<void>();
  @Output() setTabEvent = new EventEmitter<string>();
  @Output() subscriptionActivated = new EventEmitter<Subscription>();

  ngOnInit(): void {
    if (this.isClient) {
      this.planService.getPlans().subscribe({
        next: (p) => {
          this.plans = p;
          if (p.length > 0) this.selectedPlanId = p[0].id;
        },
        error: () => {}
      });
    }
  }

  activatePlan(): void {
    if (!this.selectedPlanId) return;
    this.activationLoading = true;
    this.activationError = null;
    this.subscriptionService.activateSubscription(this.selectedPlanId, this.selectedFrequency).subscribe({
      next: (sub) => {
        this.activationLoading = false;
        this.activationSuccess = true;
        this.subscriptionActivated.emit(sub);
      },
      error: (err) => {
        this.activationLoading = false;
        this.activationError = err?.error?.message || 'Impossibile attivare il piano. Riprova.';
      }
    });
  }

  getInstallmentLabel(plan: Plan): string {
    return plan.duration === 'SEMESTRALE'
      ? `${plan.monthlyInstallmentPrice.toFixed(2)} €/mese × 6`
      : `${plan.monthlyInstallmentPrice.toFixed(2)} €/mese × 12`;
  }

  getInitials(): string {
    return getInitials(this.currentUser);
  }

  getSubscriptionDaysLeft(): number {
    if (!this.subscription?.endDate) return 0;
    const end = new Date(this.subscription.endDate);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  toDate(dateStr: string): Date { return new Date(dateStr + 'T00:00:00'); }
  getDayNumber(date: Date): number { return date.getDate(); }
  getMonthShort(date: Date): string { return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); }

  getBookingLabel(b: Booking): string {
    if (this.isClient) {
      const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
  }

  getDocTypeLabel(): string {
    return this.currentUser?.role === 'PERSONAL_TRAINER' ? 'scheda' : 'dieta';
  }
}
