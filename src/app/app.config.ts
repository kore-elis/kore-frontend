import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { noCacheInterceptor } from './core/interceptors/no-cache.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';


import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor, noCacheInterceptor, errorInterceptor])),
    { provide: LOCALE_ID, useValue: 'it' }
  ]
};
