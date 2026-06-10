import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent), pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register').then(m => m.RegisterComponent) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent) },
  { path: 'clients', canActivate: [authGuard], loadComponent: () => import('./pages/clients-list/clients-list').then(m => m.ClientsListComponent) },
];
