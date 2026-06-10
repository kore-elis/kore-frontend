import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class JobApplicationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  submit(formData: FormData) {
    return this.http.post(`${this.apiUrl}/api/job-applications`, formData);
  }
}
