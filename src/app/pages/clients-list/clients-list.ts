import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';

import { UserService } from '../../core/services/user.service';
import { Router, RouterModule } from '@angular/router';
import { UserRole, ClientBasicInfo } from '../../shared/models/dashboard.model';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './clients-list.html',
  styleUrls: ['./clients-list.css']
})
export class ClientsListComponent implements OnInit {
  userService = inject(UserService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  clients: ClientBasicInfo[] = [];
  professionalId: number = 0;

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // Controllo extra: solo PT e Nutrizionisti devono vedere questa pagina
      if (user.role === UserRole.CLIENT) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.professionalId = user.id;
      this.loadClients();
    } else {
      this.router.navigate(['/login']);
    }
  }

  loadClients() {
    this.userService.getMyClients().subscribe({
      next: (res: ClientBasicInfo[] | any) => {

        this.clients = Array.isArray(res) ? res : (res && res.value) ? res.value : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
      }
    });
  }
}
