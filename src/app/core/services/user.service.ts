import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import {
  DashboardData,
  ClientBasicInfo,
  ProStats,
  UserProfile,
  ProfileEditData,
  ActivityFeedItem,
  UserManagementMode,
  ManagedUserPayload,
  AdminStatsResponse,
  Booking
} from '../../shared/models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/api/users/dashboard`);
  }

  updateProfile(profileData: ProfileEditData): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/users/profile`, profileData);
  }

  getAdmin(): Observable<ClientBasicInfo> {
    return this.http.get<ClientBasicInfo>(`${this.apiUrl}/api/users/admin`);
  }

  getModerator(): Observable<ClientBasicInfo> {
    return this.http.get<ClientBasicInfo>(`${this.apiUrl}/api/chat/moderator`);
  }

  getMyClients(): Observable<ClientBasicInfo[]> {
    return this.http.get<ClientBasicInfo[]>(`${this.apiUrl}/api/users/clients`);
  }

  getAllUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/admin/users`);
  }

  getInsuranceUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/insurance/clients`);
  }

  private usersBaseByMode(mode: UserManagementMode): string {
    return mode === 'moderator'
      ? `${this.apiUrl}/api/moderator/users`
      : `${this.apiUrl}/api/admin/users`;
  }

  getUsersByMode(mode: UserManagementMode): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(this.usersBaseByMode(mode));
  }

  getModeratorChatContacts(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/moderator/chat-contacts`);
  }

  createUserByMode(mode: UserManagementMode, data: ManagedUserPayload): Observable<void> {
    return this.http.post<void>(this.usersBaseByMode(mode), data);
  }

  updateUserByMode(mode: UserManagementMode, userId: number, data: Partial<ManagedUserPayload>): Observable<void> {
    return this.http.put<void>(`${this.usersBaseByMode(mode)}/${userId}`, data);
  }

  deleteUserByMode(mode: UserManagementMode, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.usersBaseByMode(mode)}/${userId}`);
  }

  getProfessionalStats(): Observable<ProStats> {
    return this.http.get<ProStats>(`${this.apiUrl}/api/professional/stats`);
  }

  getActivityFeed(days: number = 14, size: number = 15): Observable<ActivityFeedItem[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/activity/feed?days=${days}&size=${size}`).pipe(
      map(items => (items || []).map(item => ({
        type: item.type,
        text: item.text,
        timestamp: item.timestamp,
        icon: item.type === 'BOOKING' ? '📅' : item.type === 'DOCUMENT' ? '📄' : '🔔',
        timeAgo: this._timeAgo(item.timestamp)
      } as ActivityFeedItem)))
    );
  }

  private _timeAgo(timestamp: string): string {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'adesso';
    if (minutes < 60) return `${minutes} min fa`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ore fa`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ieri';
    return `${days} giorni fa`;
  }

  getAdminStats(): Observable<AdminStatsResponse> {
    return this.http.get<AdminStatsResponse>(`${this.apiUrl}/api/admin/stats`);
  }

  getProfessionalBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/api/professional/bookings`);
  }

  getInsuranceChatContacts(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/insurance/chat-contacts`);
  }
}
