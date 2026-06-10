import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthUser, UserProfile, Plan, Subscription } from '../../../../shared/models/dashboard.model';
import { RoleService } from '../../../../core/services/role.service';
import { getInitials } from '../../../../shared/utils/user.util';

@Component({
  selector: 'app-admin-home-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-home-tab.html',
  styleUrls: ['./admin-home-tab.css']
})
export class AdminHomeTabComponent {
  private roleService = inject(RoleService);

  @Input() currentUser: AuthUser | null = null;
  @Input() allUsers: UserProfile[] = [];
  @Input() allPlans: Plan[] = [];
  @Input() allSubscriptions: Subscription[] = [];
  @Input() isModerator: boolean = false;
  @Output() setTabEvent = new EventEmitter<string>();

  get totalUsers(): number { return this.allUsers.length; }
  get totalClients(): number { return this.allUsers.filter(u => u.role === 'CLIENT').length; }
  get totalProfessionals(): number { return this.allUsers.filter(u => u.role === 'PERSONAL_TRAINER' || u.role === 'NUTRITIONIST' || u.role === 'INSURANCE_MANAGER').length; }
  get activeSubscriptions(): number { return this.allSubscriptions.filter(s => s.active).length; }
  get estimatedRevenue(): number {
    return this.allSubscriptions.filter(s => s.active).reduce((sum, s) => sum + (s.monthlyPrice || 0), 0);
  }

  getRoleLabel(role: string): string {
    return this.roleService.getRoleLabel(role);
  }

  getRoleBadgeClass(role: string): string {
    return this.roleService.getRoleBadgeClass(role);
  }

  getInitials(): string {
    return getInitials(this.currentUser);
  }
}

