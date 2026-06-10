import {
  Component, inject, OnInit, OnDestroy, HostListener, ViewChild, DestroyRef,
  signal, ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, forkJoin, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { PlanService } from '../../core/services/plan.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ChatService } from '../../core/services/chat.service';
import { AvailabilityService } from '../../core/services/availability.service';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { ToastService } from '../../core/services/toast.service';
import { RoleService } from '../../core/services/role.service';
import { StorageService } from '../../core/services/storage.service';
import { getInitials } from '../../shared/utils/user.util';

import { HomeTabComponent } from './components/home-tab/home-tab';
import { CalendarTabComponent } from './components/calendar-tab/calendar-tab';
import { ChatTabComponent } from './components/chat-tab/chat-tab';
import { ClientsTabComponent } from './components/clients-tab/clients-tab';
import { AdminHomeTabComponent } from './components/admin-home-tab/admin-home-tab';
import { AdminUsersTabComponent } from './components/admin-users-tab/admin-users-tab';
import { AdminPlansTabComponent } from './components/admin-plans-tab/admin-plans-tab';
import { InsuranceHomeTabComponent } from './components/insurance-home-tab/insurance-home-tab';
import { MyProfessionalsTabComponent } from './components/my-professionals-tab/my-professionals-tab';
import { MyServicesTabComponent } from './components/my-services-tab/my-services-tab';
import { AdminStatsTabComponent } from './components/admin-stats-tab/admin-stats-tab';
import { AdminDocumentsTabComponent } from './components/admin-documents-tab/admin-documents-tab';
import { ToastComponent } from '../../shared/components/ui/toast/toast';
import { PullToRefreshDirective } from '../../shared/directives/pull-to-refresh.directive';
import { ProfileEditModalComponent } from '../../shared/components/ui/profile-edit-modal/profile-edit-modal';

import {
  AuthUser,
  DashboardData,
  ClientBasicInfo,
  UserProfile,
  Plan,
  Subscription,
  ProStats,
  ActivityFeedItem,
  ProfessionalSlot,
  Booking,
  ProfessionalSummary,
  ApiErrorResponse,
  TabId,
  UserRole
} from '../../shared/models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, HomeTabComponent, CalendarTabComponent, ChatTabComponent,
    ClientsTabComponent, AdminHomeTabComponent, AdminUsersTabComponent, AdminPlansTabComponent,
    InsuranceHomeTabComponent, MyProfessionalsTabComponent, MyServicesTabComponent,
    AdminStatsTabComponent, AdminDocumentsTabComponent, ToastComponent, PullToRefreshDirective,
    ProfileEditModalComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(ChatTabComponent)
  set chatTabComponent(content: ChatTabComponent | undefined) {
    this._chatTabComponent = content;
    if (content) {
      const pendingUser = this.dashboardFacade.currentPendingChatUser;
      if (pendingUser) {
        const wasExisting = content.startConversationWith(pendingUser);
        if (wasExisting) {
          this.toast.success('Chat Supporto', 'Hai già una conversazione aperta con il supporto. Ti abbiamo reindirizzato alla chat esistente.');
        }
        this.dashboardFacade.clearPendingChatUser();
      }
    }
  }

  get chatTabComponent(): ChatTabComponent | undefined {
    return this._chatTabComponent;
  }
  private _chatTabComponent?: ChatTabComponent;

  @ViewChild(ProfileEditModalComponent) profileModal!: ProfileEditModalComponent;

  private authService = inject(AuthService);
  private userService = inject(UserService);
  private planService = inject(PlanService);
  private subscriptionService = inject(SubscriptionService);
  private chatService = inject(ChatService);
  private availabilityService = inject(AvailabilityService);
  public dashboardFacade = inject(DashboardFacadeService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private roleService = inject(RoleService);
  private storageService = inject(StorageService);
  private destroyRef = inject(DestroyRef);

  private _currentUser = signal<AuthUser | null>(null);
  get currentUser(): AuthUser | null { return this._currentUser(); }

  private _dashboardData = signal<DashboardData | null>(null);
  get dashboardData(): DashboardData | null { return this._dashboardData(); }

  private _isLoading = signal(true);
  get isLoading(): boolean { return this._isLoading(); }

  private _isProfileOpen = signal(false);
  get isProfileOpen(): boolean { return this._isProfileOpen(); }

  private _myClients = signal<ClientBasicInfo[]>([]);
  get myClients(): ClientBasicInfo[] { return this._myClients(); }

  private _allUsers = signal<UserProfile[]>([]);
  get allUsers(): UserProfile[] { return this._allUsers(); }

  private _chatUsers = signal<UserProfile[]>([]);
  get chatUsers(): UserProfile[] { return this._chatUsers(); }

  private _allPlans = signal<Plan[]>([]);
  get allPlans(): Plan[] { return this._allPlans(); }

  private _allSubscriptions = signal<Subscription[]>([]);
  get allSubscriptions(): Subscription[] { return this._allSubscriptions(); }

  private _activeTab = signal<TabId>('home');
  get activeTab(): TabId { return this._activeTab(); }

  private _globalUnreadCount = signal(0);
  get globalUnreadCount(): number { return this._globalUnreadCount(); }

  private _proStats = signal<ProStats | null>(null);
  get proStats(): ProStats | null { return this._proStats(); }

  private _activityFeed = signal<ActivityFeedItem[]>([]);
  get activityFeed(): ActivityFeedItem[] { return this._activityFeed(); }

  private _professionalBookings = signal<Booking[]>([]);
  get professionalBookings(): Booking[] { return this._professionalBookings(); }

  private _weekDays = signal<Date[]>([]);
  get weekDays(): Date[] { return this._weekDays(); }

  private _showCancelBookingModal = signal(false);
  get showCancelBookingModal(): boolean { return this._showCancelBookingModal(); }

  private _isPopupOpen = signal(false);
  get isPopupOpen(): boolean { return this._isPopupOpen(); }

  private _popupTitle = signal('');
  get popupTitle(): string { return this._popupTitle(); }

  private _popupMessage = signal('');
  get popupMessage(): string { return this._popupMessage(); }

  // Indicatori interni per non ricaricare i dati admin già scaricati: non servono nel
  // template, quindi restano boolean normali e non signal.
  private usersLoaded = false;
  private plansLoaded = false;
  private subsLoaded = false;


  calendarState$ = this.dashboardFacade.calendarState$;
  bookingState$ = this.dashboardFacade.bookingState$;

  currentWeekStart: Date = new Date();
  visibleDayCount: number = 7;
  dayOffset: number = 0;

  openPopup(title: string, message: string): void {
    this._popupTitle.set(title);
    this._popupMessage.set(message);
    this._isPopupOpen.set(true);
  }

  closePopup(): void {
    this._isPopupOpen.set(false);
  }

  showPopupMessage(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    if (type === 'error') {
      this.toast.error(title, message);
    } else if (type === 'warning') {
      this.toast.warning(title, message);
    } else {
      this.toast.success(title, message);
    }
  }

  openProfileEditModal(): void { this.profileModal.open(); }
  closeProfileEditModal(): void { this.profileModal.close(); }

  contactAdmin(): void {
    this.closeProfile();
    if (this.isAdmin()) {
      this.toast.warning('Attenzione', 'Sei già un Amministratore.');
      return;
    }
    this.userService.getModerator()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (moderatorUser) => {
          if (this.activeTab === 'chat' && this._chatTabComponent) {
            this._chatTabComponent.startConversationWith(moderatorUser);
            this._chatTabComponent.reopenTerminatedConversation();
          } else {
            this.dashboardFacade.setPendingChatUser(moderatorUser as UserProfile);
            this.setTab('chat');
          }
        },
        error: (err: HttpErrorResponse) => {
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || "Impossibile recuperare il contatto di supporto.");
        }
      });
  }

  ngOnInit(): void {
    const savedUser = this.storageService.get<AuthUser>('user');
    if (savedUser) {
      this._currentUser.set(savedUser);
      this.initWeek();
      this.updateVisibleDays();
      this.loadDashboardData();

      const user = this._currentUser();
      if (user) {
        this.chatService.init(user.id, user.email);
      }

      this.chatService.unreadCount$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(count => {
          this._globalUnreadCount.set(count);
        });

      this.dashboardFacade.actionSuccess$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.loadDashboardData();
        });
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.chatService.destroy();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateVisibleDays();
  }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    if (w < 640) {
      this.visibleDayCount = 3;
    } else if (w < 1024) {
      this.visibleDayCount = 3;
    } else {
      this.visibleDayCount = 7;
    }
    this.buildWeekDays();
  }

  loadDashboardData(): void {
    if (this.isAdmin() || this.isModerator() || this.isInsuranceManager()) {
      this.loadAdminHomeData();
      return;
    }

    if (!this.currentUser) return;

    if (this.isProfessional()) {
      this.userService.getMyClients()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (clients) => {
            this._myClients.set(Array.isArray(clients) ? clients : []);
            this.loadProStats();
            this.loadActivityFeed();
            this.loadProfessionalBookings();
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false)
        });
      return;
    }

    this.userService.getDashboard().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this._dashboardData.set(data);
        this.loadActivityFeed();
        this._isLoading.set(false);
      },
      error: () => {
        this._isLoading.set(false);
      }
    });
  }

  private buildUsersObservable(): Observable<{ allUsers: UserProfile[]; chatUsers: UserProfile[] }> {
    if (this.isModerator()) {
      return this.userService.getUsersByMode('moderator').pipe(
        switchMap(users => {
          if (!users) return of({ allUsers: [], chatUsers: [] });
          return this.userService.getModeratorChatContacts().pipe(
            catchError(() => of([])),
            switchMap(contacts => {
              const allU = users || [];
              const cont = contacts || [];
              const manageableUsers = [...allU, ...cont];
              return this.userService.getAdmin().pipe(
                catchError(() => of(null)),
                map(adminUser => {
                  const merged = [...manageableUsers, adminUser as unknown as UserProfile].filter((u, index, arr) =>
                    u && typeof u.id !== 'undefined' && arr.findIndex(x => x?.id === u.id) === index
                  );
                  return { allUsers: allU, chatUsers: merged };
                })
              );
            })
          );
        }),
        catchError(() => of({ allUsers: [], chatUsers: [] }))
      );
    }

    if (this.isInsuranceManager()) {
      return this.userService.getInsuranceUsers().pipe(
        catchError(() => of([])),
        switchMap(clients => this.userService.getInsuranceChatContacts().pipe(
          catchError(() => of([])),
          map(contacts => ({ allUsers: clients || [], chatUsers: contacts || [] }))
        ))
      );
    }

    return this.userService.getAllUsers().pipe(
      catchError(() => of([])),
      map(users => ({ allUsers: users || [], chatUsers: [...(users || [])] }))
    );
  }

  private buildSubsObservable(): Observable<Subscription[]> {
    if (this.isModerator()) {
      return this.subscriptionService.getAllSubscriptionsByMode('moderator').pipe(catchError(() => of([])));
    }
    if (this.isInsuranceManager()) {
      return this.subscriptionService.getInsuranceSubscriptions().pipe(catchError(() => of([])));
    }
    return this.subscriptionService.getAllSubscriptions().pipe(catchError(() => of([])));
  }

  private loadAdminHomeData(): void {
    forkJoin({
      users: this.buildUsersObservable(),
      subs: this.buildSubsObservable()
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (result) => {
        this._allUsers.set(result.users.allUsers);
        this._chatUsers.set(result.users.chatUsers);
        this._allSubscriptions.set(result.subs);
        this.usersLoaded = true;
        this.subsLoaded = true;
        this._isLoading.set(false);
      }
    });
  }

  private loadAdminPlans(): void {
    if (this.plansLoaded || this.isInsuranceManager()) return;
    this.planService.getAdminPlans()
      .pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe(plans => {
        this._allPlans.set(plans || []);
        this.plansLoaded = true;
      });
  }

  reloadAdminData(): void {
    this.usersLoaded = false;
    this.plansLoaded = false;
    this.subsLoaded = false;
    this.loadAdminHomeData();
    this.loadAdminPlans();
  }

  private loadProStats(): void {
    if (!this.isProfessional()) return;
    this.userService.getProfessionalStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this._proStats.set(stats);
        },
        error: () => { }
      });
  }

  private loadActivityFeed(): void {
    this.userService.getActivityFeed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (feed) => {
          this._activityFeed.set(feed || []);
        },
        error: () => { }
      });
  }

  private loadProfessionalBookings(): void {
    if (!this.isProfessional()) return;
    this.userService.getProfessionalBookings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bookings) => {
          this._professionalBookings.set(Array.isArray(bookings) ? bookings : []);
        },
        error: () => { }
      });
  }

  onPullRefresh(): void {
    if (this.isAdmin() || this.isModerator() || this.isInsuranceManager()) {
      this.reloadAdminData();
    } else {
      this.loadDashboardData();
    }
  }

  get profile(): UserProfile | undefined { return this.dashboardData?.profile; }
  get subscription(): Subscription | null | undefined { return this.dashboardData?.subscription; }
  get professionals(): ProfessionalSummary[] { return this.dashboardData?.followingProfessionals ?? []; }
  get bookings(): Booking[] {
    return this.isProfessional()
      ? this._professionalBookings()
      : this.dashboardData?.upcomingBookings ?? [];
  }

  isClient(): boolean { return this.roleService.isClient(this.currentUser); }
  isProfessional(): boolean { return this.roleService.isProfessional(this.currentUser); }
  isAdmin(): boolean { return this.roleService.isAdmin(this.currentUser); }
  isModerator(): boolean { return this.roleService.isModerator(this.currentUser); }
  isInsuranceManager(): boolean { return this.roleService.isInsuranceManager(this.currentUser); }

  setTab(tab: TabId | string): void {
    this._activeTab.set(tab as TabId);
    if (tab === 'chat') {
      this._globalUnreadCount.set(0);
    }
    if (this.isAdmin() || this.isModerator()) {
      if ((tab === 'admin-users' || tab === 'admin-plans') && !this.plansLoaded) {
        this.loadAdminPlans();
      }
    }
  }

  initWeek(): void {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    this.currentWeekStart = new Date(today);
    this.currentWeekStart.setDate(today.getDate() + diff);
    this.currentWeekStart.setHours(0, 0, 0, 0);
    this.dayOffset = 0;
    this.buildWeekDays();
  }

  buildWeekDays(): void {
    const days: Date[] = [];
    const count = this.visibleDayCount || 7;
    for (let i = 0; i < count; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(this.currentWeekStart.getDate() + this.dayOffset + i);
      days.push(d);
    }
    this._weekDays.set(days);
  }

  isFullHour(slot: string): boolean { return this.availabilityService.isFullHour(slot); }

  formatDate(date: Date): string { return this.availabilityService.formatDate(date); }

  getDayName(date: Date): string { return this.availabilityService.getDayName(date); }

  getDayNumber(date: Date): number { return this.availabilityService.getDayNumber(date); }

  getBookingLabel(b: Booking): string {
    if (this.isClient()) {
      const role = b.professionalRole === UserRole.PERSONAL_TRAINER ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
  }

  countWeekBookings(): number {
    return this.weekDays.reduce((acc, day) =>
      acc + this.bookings.filter(b => b.date === this.formatDate(day)).length, 0);
  }

  toggleProfile(): void { this._isProfileOpen.update(v => !v); }
  closeProfile(): void { this._isProfileOpen.set(false); }

  getInitials(): string {
    return getInitials(this.currentUser);
  }

  getSubscriptionDaysLeft(): number {
    if (!this.subscription?.endDate) return 0;
    const end = new Date(this.subscription.endDate);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  openAvailability(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.openAvailability(this.currentUser.id);
  }

  onSubscriptionActivated(sub: Subscription): void {
    this._dashboardData.update(d => d ? { ...d, subscription: sub } : null);
    this.toast.success('Abbonamento attivato', `Il piano "${sub.planName}" è ora attivo.`);
  }

  closeAvailability(): void {
    this.dashboardFacade.closeAvailability();
  }

  toggleSlot(day: Date, slot: string): void {
    if (!this.currentUser) return;
    this.dashboardFacade.toggleSlot(day, slot, this.currentUser.id);
  }

  isSlotSelected(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.selectedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotExisting(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.existingSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotLocked(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.lockedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  getSelectedCount(): number {
    return this.dashboardFacade.currentCalendarState.selectedSlots.size;
  }

  confirmAvailability(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.confirmAvailability(this.currentUser.id);
  }

  hasDaySlots(day: Date): boolean {
    return this.dashboardFacade.currentCalendarState.timeSlots.some(slot => this.isSlotSelected(day, slot));
  }

  get isCopyMode(): boolean {
    return this.dashboardFacade.currentCalendarState.copiedDay !== null;
  }

  isCopiedDay(day: Date): boolean {
    const state = this.dashboardFacade.currentCalendarState;
    return state.copiedDay !== null && this.availabilityService.formatDate(state.copiedDay) === this.availabilityService.formatDate(day);
  }

  copyDay(day: Date): void {
    this.dashboardFacade.copyDay(day);
  }

  clearCopy(): void {
    this.dashboardFacade.clearCopy();
  }

  pasteDay(targetDay: Date): void {
    this.dashboardFacade.pasteDay(targetDay);
  }

  getNextWeekLabel(): string {
    return this.availabilityService.getNextWeekLabel(this.dashboardFacade.currentCalendarState.nextWeekDays);
  }

  openBooking(professional: ProfessionalSummary): void {
    this.dashboardFacade.openBooking(professional);
  }

  closeBooking(): void {
    this.dashboardFacade.closeBooking();
  }

  selectBookingDay(day: Date): void {
    this.dashboardFacade.selectBookingDay(day);
  }

  getSlotTimeLabel(slot: ProfessionalSlot): string {
    return this.availabilityService.getSlotTimeLabel(slot);
  }

  toggleBookingSlot(slot: ProfessionalSlot): void {
    this.dashboardFacade.toggleBookingSlot(slot);
  }

  isBookingSlotSelected(slot: ProfessionalSlot): boolean {
    return this.dashboardFacade.currentBookingState.selectedBookingSlot?.id === slot?.id;
  }

  confirmBooking(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.confirmBooking(this.currentUser.id);
  }

  isMobileChatOpen(): boolean {
    return this.activeTab === 'chat' && this.chatTabComponent?.chatView === 'conversation';
  }

  get isCallModalOpen(): boolean { return this.dashboardFacade.currentCallState.isCallModalOpen; }
  get selectedCallBooking(): Booking | null { return this.dashboardFacade.currentCallState.selectedCallBooking; }
  get canJoinCallNow(): boolean { return this.dashboardFacade.currentCallState.canJoinCallNow; }

  openCallModal(booking: Booking): void {
    this.dashboardFacade.openCallModal(booking);
  }

  closeCallModal(): void {
    this.dashboardFacade.closeCallModal();
  }

  joinCall(): void {
    if (!this.canJoinCallNow || !this.selectedCallBooking?.meetingLink) return;

    window.open(this.selectedCallBooking.meetingLink, '_blank');
    this.closeCallModal();
  }

  isCancellationAllowed(): boolean {
    if (!this.selectedCallBooking || !this.isClient() || this.selectedCallBooking.status !== 'CONFIRMED') return false;

    const b = this.selectedCallBooking;
    const bookingDate = new Date(`${b.date}T${b.startTime}:00`);
    const now = new Date();
    const diffMs = bookingDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours >= 24;
  }

  openCancelBookingModal(): void {
    this._showCancelBookingModal.set(true);
  }

  closeCancelBookingModal(): void {
    this._showCancelBookingModal.set(false);
  }

  cancelCurrentBooking(): void {
    if (!this.selectedCallBooking || !this.currentUser) return;
    this._showCancelBookingModal.set(false);

    this._isLoading.set(true);
    this.availabilityService.cancelBooking(this.selectedCallBooking.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Prenotazione Annullata', 'La prenotazione è stata annullata con successo.');
          this.closeCallModal();
          this.loadDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          this._isLoading.set(false);
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || 'Impossibile annullare la prenotazione in questo momento.');
        }
      });
  }

  getTotalUnread(): number {
    return this.globalUnreadCount;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
