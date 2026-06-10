/**
 * Tipi TypeScript per la dashboard Kore.
 * Mappati 1:1 ai DTO Java del backend Spring Boot.
 */

// Enumerazioni

export enum UserRole {
  CLIENT = 'CLIENT',
  PERSONAL_TRAINER = 'PERSONAL_TRAINER',
  NUTRITIONIST = 'NUTRITIONIST',
  MODERATOR = 'MODERATOR',
  INSURANCE_MANAGER = 'INSURANCE_MANAGER',
  ADMIN = 'ADMIN'
}

export type BookingStatus =
  | 'CONFIRMED'
  | 'CANCELED'
  | 'COMPLETED';

export type PlanDuration = 'SEMESTRALE' | 'ANNUALE';

export type TabId =
  | 'home'
  | 'calendar'
  | 'chat'
  | 'clients'
  | 'book-call'
  | 'my-services'
  | 'admin-users'
  | 'admin-plans'
  | 'admin-stats'
  | 'admin-documents'
  | 'insurance';

// Utente e autenticazione

export type UserManagementMode = 'admin' | 'moderator';

export interface ManagedUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  planId?: number;
  paymentFrequency?: string;
  assignedPTId?: number;
  assignedNutritionistId?: number;
}

/** Dati utente salvati in localStorage dopo il login (da AuthResponse.java). */
export interface AuthUser {
  token: string;
  type: string;
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  profilePicture?: string;
  createdAt?: string;
}

/** Profilo utente completo (da UserResponse.java e UserResponseDTO.java). */
export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  // Da UserResponse (dashboard cliente/professionista)
  active?: boolean;
  profilePictureUrl?: string;
  weight?: number;
  height?: number;
  assignedPtName?: string;
  assignedNutritionistName?: string;
  bio?: string;
  specialization?: string;
  averageRating?: number;
  activeClientsCount?: number;
  professionalBio?: string;
  createdAt?: string;
}

/** Info base di un cliente (da ClientBasicInfoResponse.java). */
export interface ClientBasicInfo {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl?: string;
  role?: string;
}

/** Item nell'elenco "clienti da monitorare" (da ClientAttentionItem.java in ProfessionalStatsResponse). */
export interface ClientAttentionItem {
  id: number;
  firstName: string;
  lastName: string;
  lastDocDate?: string;
  daysSinceLastDoc: number;
}

// Abbonamento e piano

/** Stato abbonamento (da SubscriptionResponse.java). */
export interface Subscription {
  id: number;
  planName: string;
  userName?: string;
  startDate: string;
  endDate: string;
  /** `isActive` nel DTO Java; Jackson lo serializza come `active`. */
  active: boolean;
  isActive?: boolean;
  currentCreditsPT: number;
  currentCreditsNutri: number;
  monthlyPrice?: number;
  userId?: number;
}

/** Piano di abbonamento (dedotto da admin-plans-tab e backend). */
export interface Plan {
  id: number;
  name: string;
  duration: PlanDuration;
  fullPrice: number;
  monthlyInstallmentPrice: number;
  monthlyCreditsPT: number;
  monthlyCreditsNutri: number;
  /** Stato del piano: false = disabilitato (non sottoscrivibile, ma mantenuto in DB). */
  active?: boolean;
}

// Professionista

/** Riepilogo professionista (da ProfessionalSummaryDTO.java + campi UI extra). */
export interface ProfessionalSummary {
  id: number;
  fullName: string;
  averageRating?: number;
  currentActiveClients?: number;
  /** Jackson serializza `isSoldOut()` come `soldOut` (rimuove il prefisso `is`). */
  soldOut?: boolean;
  isSoldOut?: boolean;
  role: UserRole;
  /** Campo aggiuntivo dal frontend (non nel Java DTO base). */
  profilePicture?: string;
  /** Bio del professionista (esteso dal frontend). */
  professionalBio?: string;
  /** Campi aggiuntivi usati in chat-tab per costruire i contatti chat */
  firstName?: string;
  lastName?: string;
  email?: string;
}

// Prenotazioni

/** Prenotazione (da BookingResponse.java). */
export interface Booking {
  id: number;
  /** Formato "yyyy-MM-dd". */
  date: string;
  /** Formato "HH:mm". */
  startTime: string;
  /** Formato "HH:mm". */
  endTime: string;
  professionalName?: string;
  clientName?: string;
  professionalRole: UserRole;
  meetingLink?: string;
  status: BookingStatus;
  canJoin: boolean;
}

/** Richiesta creazione prenotazione (userId estratto dal JWT lato backend). */
export interface BookingRequest {
  slotId: number;
}

// Slot

/** Slot di disponibilità (da SlotDTO.java). */
export interface ProfessionalSlot {
  id: number;
  /** Stringa data/ora in formato ISO. */
  startTime: string;
  /** Stringa data/ora in formato ISO. */
  endTime: string;
  /**
   * Jackson serializza `isAvailable` (boolean primitivo Java) come `available`.
   * Entrambi sono accettati per retrocompatibilità.
   */
  isAvailable?: boolean;
  available?: boolean;
  professionalId?: number;
}

/** Payload per creare nuovi slot. */
export interface SlotPayload {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

// Dashboard aggregata

/** Risposta dashboard aggregata (da ClientDashboardResponse.java). */
export interface DashboardData {
  profile: UserProfile;
  followingProfessionals: ProfessionalSummary[];
  subscription: Subscription | null;
  upcomingBookings: Booking[];
}

// Statistiche & Attività

/** Singolo appuntamento di oggi (da TodayBookingItem.java). */
export interface TodayBookingItem {
  id: number;
  clientName: string;
  clientId: number;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  meetingLink?: string;
}

/** Statistiche professionista (da ProfessionalStatsResponse.java). */
export interface ProStats {
  todayBookings: TodayBookingItem[];
  todayBookingsCount: number;
  clientsNeedingAttention: ClientAttentionItem[];
  clientsNeedingAttentionCount: number;
  docsUploadedThisWeek: number;
  totalClients: number;
}

/** Singolo item del feed attività (da ActivityFeedItemResponse.java). */
export interface ActivityFeedItem {
  type: string;
  icon: string;
  text: string;
  timestamp: string;
  timeAgo: string;
}

// Modifica profilo

/** Dati form modifica profilo. */
export interface ProfileEditData {
  firstName: string;
  lastName: string;
  password: string;
  profilePicture: string;
}

// Gestione errori

/**
 * Struttura standard per errori API del backend.
 * Corrisponde a `ErrorResponse.java`.
 */
export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  validationErrors?: Record<string, string>;
}

// Statistiche admin

export interface AdminStatsCredits {
  ptAvailable: number;
  ptTotal: number;
  ptConsumed: number;
  ptPercentUsed: number;
  nutriAvailable: number;
  nutriTotal: number;
  nutriConsumed: number;
  nutriPercentUsed: number;
}

export interface AdminStatsMonthlyUserCount {
  month: string;
  year: number;
  count: number;
}

export interface AdminStatsPlanPopularity {
  name: string;
  activeCount: number;
  percentage: number;
  monthlyPrice: number;
  fullPrice: number;
}

export interface AdminStatsProfessionalWorkload {
  name: string;
  role: string;
  clientCount: number;
}

/** Risposta dashboard statistiche admin (da AdminStatsResponse.java). */
export interface AdminStatsResponse {
  usersByRole: Record<string, number>;
  totalUsers: number;
  usersPerMonth: AdminStatsMonthlyUserCount[];
  planPopularity: AdminStatsPlanPopularity[];
  totalActiveSubscriptions: number;
  totalSubscriptions: number;
  credits: AdminStatsCredits;
  monthlyRevenue: number;
  yearlyRevenue: number;
  bookingsThisMonth: number;
  bookingsTotal: number;
  professionalWorkload: AdminStatsProfessionalWorkload[];
}
