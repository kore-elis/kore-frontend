import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { UserService } from '../../../../core/services/user.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthUser, ProfileEditData, ApiErrorResponse } from '../../../models/dashboard.model';

@Component({
  selector: 'app-profile-edit-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-edit-modal.html'
})
export class ProfileEditModalComponent {
  @Input() currentUser: AuthUser | null = null;
  @Output() profileSaved = new EventEmitter<void>();

  private userService = inject(UserService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  isOpen = false;
  isSaving = false;
  data: ProfileEditData = { firstName: '', lastName: '', password: '', profilePicture: '' };

  open(): void {
    this.data = {
      firstName: this.currentUser?.firstName || '',
      lastName: this.currentUser?.lastName || '',
      password: '',
      profilePicture: this.currentUser?.profilePicture || ''
    };
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  save(): void {
    if (!this.currentUser) return;
    this.isSaving = true;

    this.userService.updateProfile(this.data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.close();
          this.toast.success('Successo', 'Profilo aggiornato con successo.');
          this.profileSaved.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving = false;
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || 'Impossibile aggiornare il profilo.');
        }
      });
  }
}
