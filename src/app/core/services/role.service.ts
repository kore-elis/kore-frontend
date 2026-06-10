import { Injectable } from '@angular/core';
import { AuthUser, UserRole } from '../../shared/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  isClient(user: AuthUser | null): boolean {
    return user?.role === UserRole.CLIENT;
  }

  isProfessional(user: AuthUser | null): boolean {
    const r = user?.role;
    return r === UserRole.PERSONAL_TRAINER || r === UserRole.NUTRITIONIST;
  }

  isAdmin(user: AuthUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  isModerator(user: AuthUser | null): boolean {
    return user?.role === UserRole.MODERATOR;
  }

  isInsuranceManager(user: AuthUser | null): boolean {
    return user?.role === UserRole.INSURANCE_MANAGER;
  }

  /**
   * Etichetta leggibile del ruolo, al singolare.
   * Era duplicata (con piccole divergenze, tipo admin-home che si scordava MODERATOR) in
   * admin-home, admin-users, chat e documenti admin: qui c'è la versione completa e unica.
   * NB: admin-stats usa di proposito il plurale ("Clienti"...) quindi non passa da qui.
   */
  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Cliente';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionista';
      case 'ADMIN': return 'Admin';
      case 'MODERATOR': return 'Moderatore';
      case 'INSURANCE_MANAGER': return 'Assicurazione';
      default: return role;
    }
  }

  /** Classi Tailwind del badge ruolo (sfondo + testo), coerenti in tutte le tabelle. */
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'CLIENT': return 'bg-blue-50 text-blue-600';
      case 'PERSONAL_TRAINER': return 'bg-emerald-50 text-emerald-600';
      case 'NUTRITIONIST': return 'bg-amber-50 text-amber-700';
      case 'ADMIN': return 'bg-purple-50 text-purple-600';
      case 'MODERATOR': return 'bg-fuchsia-50 text-fuchsia-700';
      case 'INSURANCE_MANAGER': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  }
}
