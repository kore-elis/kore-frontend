import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UserService } from '../../../../core/services/user.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { ManagedUserPayload, UserProfile, Plan, Subscription, AuthUser } from '../../../../shared/models/dashboard.model';
import { ToastService } from '../../../../core/services/toast.service';
import { RoleService } from '../../../../core/services/role.service';
import { matchesUserSearch } from '../../../../shared/utils/user.util';

/** Stato del form di creazione utente: i campi opzionali partono a null (non ancora scelti). */
interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  planId: number | null;
  paymentFrequency: string;
  assignedPTId: number | null;
  assignedNutritionistId: number | null;
}

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrls: ['./admin-users-tab.css']
})
export class AdminUsersTabComponent {
  private authService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private roleService = inject(RoleService);

  @Input() allUsers: UserProfile[] = [];
  @Input() allPlans: Plan[] = [];
  @Input() allSubscriptions: Subscription[] = [];
  @Input() mode: 'admin' | 'moderator' = 'admin';
  @Input() currentUser: AuthUser | null = null;
  @Output() usersChanged = new EventEmitter<void>();

  // Mostriamo solo i piani attivi: quelli disabilitati non si assegnano a nuovi clienti.
  get activePlans(): Plan[] { return (this.allPlans || []).filter(p => p.active !== false); }

  searchQuery: string = '';
  roleFilter: string = 'ALL';
  showFilterDropdown: boolean = false;

  // Modale creazione utente
  showCreateModal: boolean = false;
  currentStep: number = 1;
  newUser: NewUserForm = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT', planId: null, paymentFrequency: 'UNICA_SOLUZIONE', assignedPTId: null, assignedNutritionistId: null };
  createError: string = '';
  creating: boolean = false;
  showPassword: boolean = false;

  // Modale modifica utente
  showEditModal: boolean = false;
  editUser: UserProfile = {} as UserProfile;
  editPassword: string = '';
  editError: string = '';
  editingUser: boolean = false;
  showEditPassword: boolean = false;

  // Modale cancellazione utente
  showDeleteModal: boolean = false;
  userToDelete: UserProfile | null = null;
  deletingUser: boolean = false;

  // Modale info
  showInfoModal: boolean = false;
  selectedUserInfo: UserProfile | null = null;
  selectedSubscription: Subscription | null = null;

  // Modale crediti
  showCreditsModal: boolean = false;
  updatingCredits: boolean = false;
  creditsForm = this.fb.group({
    creditsPT: [0, [Validators.required, Validators.min(0)]],
    creditsNutri: [0, [Validators.required, Validators.min(0)]]
  });

  private readonly moderatorAllowedRoles = ['CLIENT', 'PERSONAL_TRAINER', 'NUTRITIONIST'];

  private getErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string; error?: string }; message?: string };
    return e?.error?.message || e?.error?.error || e?.message || fallback;
  }

  isAdminMode(): boolean {
    return this.mode === 'admin';
  }

  canFilterRole(role: string): boolean {
    if (role === 'ALL') return true;
    return this.isAdminMode() || this.moderatorAllowedRoles.includes(role);
  }

  get creatableRoles(): string[] {
    return this.isAdminMode()
      ? ['CLIENT', 'PERSONAL_TRAINER', 'NUTRITIONIST', 'MODERATOR', 'INSURANCE_MANAGER']
      : this.moderatorAllowedRoles;
  }

  getFilterLabelPlural(role: string): string {
    switch (role) {
      case 'ALL': return 'Tutti i ruoli';
      case 'CLIENT': return 'Clienti';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionisti';
      case 'ADMIN': return 'Amministratori';
      case 'MODERATOR': return 'Moderatori';
      case 'INSURANCE_MANAGER': return 'Assicuratori';
      default: return 'Tutti';
    }
  }

  // Filtra gli utenti in base alla query di ricerca e al filtro di ruolo
  get filteredUsers(): UserProfile[] {
    let users = this.allUsers;
    if (!this.canFilterRole(this.roleFilter)) {
      this.roleFilter = 'ALL';
    }
    if (this.roleFilter !== 'ALL') {
      users = users.filter(u => u.role === this.roleFilter);
    }
    if (this.searchQuery.trim()) {
      users = users.filter(u => matchesUserSearch(u, this.searchQuery));
    }
    return users;
  }

  get availablePTs(): UserProfile[] {
    return this.allUsers.filter(u => u.role === 'PERSONAL_TRAINER');
  }

  get availableNutritionists(): UserProfile[] {
    return this.allUsers.filter(u => u.role === 'NUTRITIONIST');
  }

  get isClientRole(): boolean {
    return this.newUser.role === 'CLIENT';
  }

  get totalSteps(): number {
    return this.isClientRole ? 2 : 1;
  }

  openCreateModal(): void {
    this.newUser = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT', planId: null, paymentFrequency: 'UNICA_SOLUZIONE', assignedPTId: null, assignedNutritionistId: null };
    this.createError = '';
    this.currentStep = 1;
    this.showCreateModal = true;
    this.showPassword = false;
  }

  closeCreateModal(): void { this.showCreateModal = false; }

  nextStep(): void {
    if (!this.newUser.firstName || !this.newUser.lastName || !this.newUser.email || !this.newUser.password) {
      this.createError = 'Tutti i campi sono obbligatori';
      return;
    }
    this.createError = '';
    if (this.isClientRole && this.currentStep < this.totalSteps) {
      this.currentStep = 2;
    } else {
      this.createUser();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.createError = '';
    }
  }

  createUser(): void {
    if (this.isClientRole && (!this.newUser.planId || !this.newUser.assignedPTId || !this.newUser.assignedNutritionistId)) {
      this.createError = 'Seleziona Piano, Personal Trainer e Nutrizionista';
      return;
    }
    this.creating = true;
    this.createError = '';

    if (!this.isAdminMode() && !this.moderatorAllowedRoles.includes(this.newUser.role)) {
      this.creating = false;
      this.createError = 'Il moderatore puo creare solo clienti, personal trainer e nutrizionisti';
      return;
    }

    const payload: ManagedUserPayload = {
      firstName: this.newUser.firstName,
      lastName: this.newUser.lastName,
      email: this.newUser.email,
      password: this.newUser.password,
      role: this.newUser.role
    };

    if (this.isClientRole) {
      if (this.newUser.planId) payload.planId = this.newUser.planId;
      if (this.newUser.paymentFrequency) payload.paymentFrequency = this.newUser.paymentFrequency;
      if (this.newUser.assignedPTId) payload.assignedPTId = this.newUser.assignedPTId;
      if (this.newUser.assignedNutritionistId) payload.assignedNutritionistId = this.newUser.assignedNutritionistId;
    }

    this.authService.createUserByMode(this.mode, payload).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateModal = false;
        this.toast.success('Utente Creato', `${this.newUser.firstName} ${this.newUser.lastName} e stato creato con successo.`);
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.creating = false;
        this.createError = this.getErrorMessage(err, 'Errore nella creazione');
        this.cdr.detectChanges();
      }
    });
  }

  // Eliminazione utente
  openDeleteModal(user: UserProfile): void {
    if (this.currentUser && user.id === this.currentUser.id) {
      this.toast.warning('Operazione non consentita', 'Non puoi eliminare il tuo stesso account.');
      return;
    }
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
    this.deletingUser = false;
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) return;
    this.deletingUser = true;

    this.authService.deleteUserByMode(this.mode, this.userToDelete.id).subscribe({
      next: () => {
        this.deletingUser = false;
        this.closeDeleteModal();
        this.toast.success('Eliminato', 'Utente eliminato con successo.');
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.deletingUser = false;
        this.closeDeleteModal();
        this.toast.error('Errore', this.getErrorMessage(err, 'Errore nell\'eliminazione'));
      }
    });
  }

  // Info e Crediti Abbonamento
  openInfoModal(user: UserProfile): void {
    this.selectedUserInfo = user;
    // Utilizziamo == invece di === per gestire eventuali mismatch tra stringa e numero (Long di Java)
    this.selectedSubscription = (this.allSubscriptions || []).find(s => s.userId == user.id && s.active) ?? null;
    this.showInfoModal = true;
  }

  closeInfoModal(): void {
    this.showInfoModal = false;
    this.selectedUserInfo = null;
    this.selectedSubscription = null;
  }

  openCreditsModal(user: UserProfile): void {
    const sub = this.allSubscriptions.find(s => s.userId === user.id && s.active);
    if (sub) {
      this.selectedSubscription = sub;
      this.creditsForm.patchValue({
        creditsPT: sub.currentCreditsPT || 0,
        creditsNutri: sub.currentCreditsNutri || 0
      });
      this.showCreditsModal = true;
    } else {
      this.toast.error('Ops', 'Questo utente non ha un abbonamento attivo.');
    }
  }

  closeCreditsModal(): void {
    this.showCreditsModal = false;
    this.selectedSubscription = null;
    this.creditsForm.reset();
  }

  saveCredits(): void {
    const sub = this.selectedSubscription;
    if (this.creditsForm.invalid || !sub) return;
    this.updatingCredits = true;

    const pt = this.creditsForm.value.creditsPT || 0;
      const nutri = this.creditsForm.value.creditsNutri || 0;

      this.subscriptionService.updateSubscriptionCredits(this.mode, sub.id, pt, nutri).subscribe({
        next: () => {
        this.updatingCredits = false;
        this.closeCreditsModal();
        this.toast.success('Fatto', 'Crediti aggiornati con successo.');

        sub.currentCreditsPT = pt;
        sub.currentCreditsNutri = nutri;
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.updatingCredits = false;
        this.toast.error('Errore', this.getErrorMessage(err, 'Errore nell\'aggiornamento crediti'));
      }
    });
  }

  // Modifica utente
  openEditModal(user: UserProfile): void {
    this.editUser = { ...user };
    this.editPassword = '';
    this.editError = '';
    this.showEditModal = true;
    this.showEditPassword = false;
  }

  closeEditModal(): void { this.showEditModal = false; }

  saveEditUser(): void {
    if (!this.editUser.firstName || !this.editUser.lastName || !this.editUser.email) {
      this.editError = 'Nome, cognome e email sono obbligatori';
      return;
    }
    this.editingUser = true;
    this.editError = '';
    const payload: Partial<ManagedUserPayload> = {
      firstName: this.editUser.firstName,
      lastName: this.editUser.lastName,
      email: this.editUser.email,
    };
    if (this.editPassword.trim()) {
      payload.password = this.editPassword;
    }
    this.authService.updateUserByMode(this.mode, this.editUser.id, payload).subscribe({
      next: () => {
        this.editingUser = false;
        this.showEditModal = false;
        this.toast.success('Utente Aggiornato', `${this.editUser.firstName} ${this.editUser.lastName} aggiornato con successo.`);
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.editingUser = false;
        this.editError = this.getErrorMessage(err, 'Errore nell\'aggiornamento');
        this.cdr.detectChanges();
      }
    });
  }

  canEditUser(user: UserProfile): boolean {
    if (this.mode === 'moderator') {
      return this.moderatorAllowedRoles.includes(user.role);
    }
    // Admin mode: può editare tutti gli utenti tranne gli altri amministratori
    return user.role !== 'ADMIN';
  }

  getRoleLabel(role: string | undefined): string {
    return this.roleService.getRoleLabel(role ?? '');
  }

  getRoleBadgeClass(role: string | undefined): string {
    return this.roleService.getRoleBadgeClass(role ?? '');
  }

  getRoleEmoji(role: string | undefined): string {
    switch (role) {
      case 'CLIENT': return '🧑';
      case 'PERSONAL_TRAINER': return '💪';
      case 'NUTRITIONIST': return '🥗';
      case 'ADMIN': return '🛡️';
      case 'MODERATOR': return '🧭';
      case 'INSURANCE_MANAGER': return '📋';
      default: return '👤';
    }
  }

  getSelectedPlanName(): string {
    if (!this.newUser.planId) return 'Non selezionato';
    const plan = this.allPlans.find(p => p.id === this.newUser.planId);
    return plan?.name ?? 'Non selezionato';
  }
  getSelectedPTName(): string {
    if (!this.newUser.assignedPTId) return 'Non selezionato';
    const pt = this.allUsers.find(u => u.id === this.newUser.assignedPTId);
    return pt ? `${pt.firstName} ${pt.lastName}` : 'Non selezionato';
  }
  getSelectedNutriName(): string {
    if (!this.newUser.assignedNutritionistId) return 'Non selezionato';
    const n = this.allUsers.find(u => u.id === this.newUser.assignedNutritionistId);
    return n ? `${n.firstName} ${n.lastName}` : 'Non selezionato';
  }
}
