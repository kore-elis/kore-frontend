import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PlanService } from '../../../../core/services/plan.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Plan, Subscription } from '../../../../shared/models/dashboard.model';
@Component({ selector: 'app-admin-plans-tab', standalone: true, imports: [FormsModule], templateUrl: './admin-plans-tab.html' })
export class AdminPlansTabComponent {
  private authService = inject(PlanService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  @Input() allPlans: Plan[] = [];
  @Input() allSubscriptions: Subscription[] = [];
  @Output() plansChanged = new EventEmitter<void>();

  // Modale creazione piano
  showCreateModal: boolean = false;
  newPlan = { name: '', duration: 'SEMESTRALE', fullPrice: 0, monthlyInstallmentPrice: 0, monthlyCreditsPT: 0, monthlyCreditsNutri: 0 };
  createError: string = '';
  creating: boolean = false;

  // Modale modifica piano
  showEditModal: boolean = false;
  editPlan: Plan = {} as Plan;
  editError: string = '';
  editing: boolean = false;

  // Modale conferma disabilitazione
  showDisableModal: boolean = false;
  planToDisable: Plan | null = null;
  disabling: boolean = false;

  getActiveSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.active && s.planName === planName).length; }
  getTotalSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.planName === planName).length; }
  getDurationLabel(duration: string): string { switch (duration) { case 'SEMESTRALE': return '6 mesi'; case 'ANNUALE': return '12 mesi'; default: return duration; } }
  isPlanActive(plan: Plan): boolean { return plan?.active !== false; }
  canDisablePlan(plan: Plan): boolean { return this.getTotalSubsForPlan(plan.name) === 0; }

  // Creazione
  openCreateModal(): void {
    this.newPlan = { name: '', duration: 'SEMESTRALE', fullPrice: 0, monthlyInstallmentPrice: 0, monthlyCreditsPT: 0, monthlyCreditsNutri: 0 };
    this.createError = '';
    this.showCreateModal = true;
  }
  closeCreateModal(): void { this.showCreateModal = false; }

  get durationMonths(): number {
    return this.newPlan.duration === 'ANNUALE' ? 12 : 6;
  }

  onFullPriceChange(): void {
    if (this.newPlan.fullPrice > 0) {
      this.newPlan.monthlyInstallmentPrice = Math.round((this.newPlan.fullPrice / this.durationMonths) * 100) / 100;
    }
  }

  onMonthlyPriceChange(): void {
    if (this.newPlan.monthlyInstallmentPrice > 0) {
      this.newPlan.fullPrice = Math.round((this.newPlan.monthlyInstallmentPrice * this.durationMonths) * 100) / 100;
    }
  }

  onDurationChange(): void {
    if (this.newPlan.fullPrice > 0) {
      this.newPlan.monthlyInstallmentPrice = Math.round((this.newPlan.fullPrice / this.durationMonths) * 100) / 100;
    } else if (this.newPlan.monthlyInstallmentPrice > 0) {
      this.newPlan.fullPrice = Math.round((this.newPlan.monthlyInstallmentPrice * this.durationMonths) * 100) / 100;
    }
  }

  createPlan(): void {
    if (!this.newPlan.name || !this.newPlan.fullPrice || !this.newPlan.monthlyInstallmentPrice) {
      this.createError = 'Nome, prezzo totale e prezzo mensile sono obbligatori';
      return;
    }
    this.creating = true;
    this.createError = '';
    this.authService.createPlan(this.newPlan).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateModal = false;
        this.toast.success('Piano Creato', `Il piano "${this.newPlan.name}" è stato creato con successo.`);
        this.plansChanged.emit();
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.error || 'Errore nella creazione';
        this.cdr.detectChanges();
      }
    });
  }

  // Modifica
  openEditModal(plan: Plan): void {
    this.editPlan = { ...plan };
    this.editError = '';
    this.showEditModal = true;
  }
  closeEditModal(): void { this.showEditModal = false; }

  get editDurationMonths(): number {
    return this.editPlan.duration === 'ANNUALE' ? 12 : 6;
  }

  onEditFullPriceChange(): void {
    if (this.editPlan.fullPrice > 0) {
      this.editPlan.monthlyInstallmentPrice = Math.round((this.editPlan.fullPrice / this.editDurationMonths) * 100) / 100;
    }
  }

  onEditMonthlyPriceChange(): void {
    if (this.editPlan.monthlyInstallmentPrice > 0) {
      this.editPlan.fullPrice = Math.round((this.editPlan.monthlyInstallmentPrice * this.editDurationMonths) * 100) / 100;
    }
  }

  onEditDurationChange(): void {
    if (this.editPlan.fullPrice > 0) {
      this.editPlan.monthlyInstallmentPrice = Math.round((this.editPlan.fullPrice / this.editDurationMonths) * 100) / 100;
    } else if (this.editPlan.monthlyInstallmentPrice > 0) {
      this.editPlan.fullPrice = Math.round((this.editPlan.monthlyInstallmentPrice * this.editDurationMonths) * 100) / 100;
    }
  }

  saveEditPlan(): void {
    if (!this.editPlan.name || !this.editPlan.fullPrice || !this.editPlan.monthlyInstallmentPrice) {
      this.editError = 'Nome, prezzo totale e prezzo mensile sono obbligatori';
      return;
    }
    this.editing = true;
    this.editError = '';
    this.authService.updatePlan(this.editPlan.id, this.editPlan).subscribe({
      next: () => {
        this.editing = false;
        this.showEditModal = false;
        this.toast.success('Piano Aggiornato', `Il piano "${this.editPlan.name}" è stato aggiornato.`);
        this.plansChanged.emit();
      },
      error: (err) => {
        this.editing = false;
        this.editError = err.error?.error || 'Errore nell\'aggiornamento';
        this.cdr.detectChanges();
      }
    });
  }

  // Disabilita (modale di conferma)
  openDisableModal(plan: Plan): void {
    this.planToDisable = plan;
    this.showDisableModal = true;
  }
  closeDisableModal(): void { this.showDisableModal = false; this.planToDisable = null; }

  confirmDisablePlan(): void {
    if (!this.planToDisable) return;
    this.disabling = true;
    this.authService.disablePlan(this.planToDisable.id).subscribe({
      next: () => {
        this.disabling = false;
        this.showDisableModal = false;
        this.toast.success('Disabilitato', 'Piano disabilitato con successo.');
        this.planToDisable = null;
        this.plansChanged.emit();
      },
      error: (err) => {
        this.disabling = false;
        this.showDisableModal = false;
        this.toast.error('Errore', err.error?.error || 'Impossibile disabilitare il piano');
        this.planToDisable = null;
      }
    });
  }

  // Riabilita
  enablePlan(plan: Plan): void {
    this.authService.enablePlan(plan.id).subscribe({
      next: () => {
        this.toast.success('Riabilitato', `Il piano "${plan.name}" è stato riabilitato.`);
        this.plansChanged.emit();
      },
      error: (err) => {
        this.toast.error('Errore', err.error?.error || 'Impossibile riabilitare il piano');
      }
    });
  }
}
