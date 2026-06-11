# Kore — Frontend

### Piattaforma SaaS per il Wellness Integrato · Single Page Application

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?logo=reactivex&logoColor=white)
![STOMP](https://img.shields.io/badge/WebSocket-STOMP-010101?logo=socketdotio&logoColor=white)

Frontend di **Kore**, la piattaforma SaaS che riunisce in un unico abbonamento Personal Trainer,
Nutrizionisti e copertura assicurativa. È una **Single Page Application** Angular 21 a *standalone
components*, con dashboard che si adatta al ruolo dell'utente, chat real-time su WebSocket e un
design system su misura in Tailwind CSS.

---

## Indice

1. [Panoramica](#panoramica)
2. [Tech Stack](#tech-stack)
3. [Struttura del progetto](#struttura-del-progetto)
4. [Architettura](#architettura)
5. [Routing & Guardie](#routing--guardie)
6. [Autenticazione](#autenticazione)
7. [Servizi principali](#servizi-principali)
8. [Real-time (chat)](#real-time-chat)
9. [Design system](#design-system)
10. [Quick Start](#quick-start)
11. [Script disponibili](#script-disponibili)
12. [Build & Environments](#build--environments)

---

## Panoramica

L'applicazione consuma le API REST del backend Spring Boot di Kore (`/api`) e si collega al canale
WebSocket `/ws` per la messaggistica in tempo reale. Dopo il login, l'utente accede a una
**dashboard a tab** che mostra funzionalità e dati diversi a seconda del ruolo (CLIENT,
PERSONAL_TRAINER, NUTRITIONIST, MODERATOR, INSURANCE_MANAGER, ADMIN).

Caratteristiche principali:

- SPA a **standalone components** con **lazy-loading** di tutte le route.
- Autenticazione **JWT** con interceptor e guardie funzionali.
- **Chat real-time** STOMP/WebSocket con fallback in polling.
- **Design system** Tailwind con palette Navy/Gold e tipografia dedicata.
- Locale **italiano** (`it`).

---

## Tech Stack

| Categoria | Tecnologia |
|---|---|
| Framework | Angular 21.1 (standalone components, lazy-loading) |
| Linguaggio | TypeScript 5.9 |
| Reattività / stato | RxJS 7.8 (`BehaviorSubject` / `Subject`, no NgRx) |
| Styling | Tailwind CSS 3.4.19 + PostCSS + Autoprefixer |
| Real-time | `@stomp/stompjs` 7.3 (con fallback polling) |
| Build / CLI | Angular CLI 21.1 (`@angular/build`) |
| Locale | Italiano (`it`) |

---

## Struttura del progetto

```
kore-frontend/
├── package.json
├── angular.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── index.html              # <title>Kore.</title>, meta PWA
    ├── styles.css              # direttive Tailwind + design token (:root)
    ├── environments/
    │   └── environment.ts             # configurazione (apiUrl localhost:8080)
    └── app/
        ├── app.routes.ts       # definizione delle route (lazy-loaded)
        ├── core/
        │   ├── guards/         # auth.guard
        │   ├── interceptors/   # auth (JWT Bearer), no-cache, error
        │   └── services/       # auth, user, role, chat, socket, plan, ...
        ├── pages/
        │   ├── home/           # landing pubblica
        │   ├── login/  register/  reset-password/
        │   ├── dashboard/      # dashboard + tab per ruolo
        │   └── clients-list/   # directory clienti (vista professionista)
        └── shared/
            ├── components/
            │   ├── layout/     # navbar, footer
            │   └── ui/         # button, card, badge, modal, skeleton, toast, ...
            ├── directives/     # pull-to-refresh
            ├── utils/          # helper condivisi (date, file, user)
            └── models/         # interfacce TypeScript (dashboard.model.ts)
```

I tab della **dashboard** comprendono: home, calendario, chat, clienti, "i miei professionisti",
servizi, e i pannelli amministrativi (utenti, piani, statistiche, documenti) e assicurativo.

---

## Architettura

- **Standalone components** (API Angular 21, nessun `NgModule`).
- **Lazy-loading** di tutte le route via `loadComponent()` per il code-splitting.
- **Stato** gestito con RxJS (`BehaviorSubject` / `Subject`); nessuna libreria esterna (no NgRx/Akita).
- **Interceptor funzionali** (`HttpInterceptorFn`) e **guardie funzionali** (`CanActivateFn`).
- **Signals** usati dove utile (es. stato locale di alcuni componenti).

---

## Routing & Guardie

Definito in `src/app/app.routes.ts`. Tutte le route sono lazy-loaded.

| Path | Componente | Accesso |
|---|---|---|
| `/` | Home (landing) | Pubblico |
| `/login` | Login | Pubblico |
| `/register` | Registrazione | Pubblico |
| `/reset-password` | Reset password | Pubblico |
| `/dashboard` | Dashboard (a tab per ruolo) | `authGuard` |
| `/clients` | Lista clienti (vista professionista) | `authGuard` |

`authGuard` verifica la presenza del token in `localStorage` e, se assente, reindirizza a `/login`.

---

## Autenticazione

Flusso JWT:

1. L'utente effettua il login tramite `auth.service.ts`.
2. Il backend restituisce un `AuthResponse` con il token JWT.
3. Token e dati utente vengono salvati in `localStorage` tramite `StorageService`.
4. `authGuard` protegge le route autenticate verificando la presenza del token.
5. `authInterceptor` aggiunge automaticamente l'header `Authorization: Bearer <token>` a tutte le richieste, escluse quelle verso `/api/auth/`.
6. `no-cache.interceptor` aggiunge gli header anti-cache alle richieste GET.

Il logout rimuove token e utente dal `localStorage`.

---

## Servizi principali

In `src/app/core/services/`:

| Servizio | Responsabilità |
|---|---|
| `auth.service` | Login, registrazione, reset password, gestione token |
| `user.service` | Dashboard, profili utente, endpoint admin/moderator |
| `role.service` | Controllo del ruolo corrente (isClient, isProfessional, isAdmin, ...) |
| `plan.service` | Piani di abbonamento |
| `subscription.service` | Attivazione abbonamenti, gestione crediti |
| `document.service` | Upload/download documenti, polizze |
| `review.service` | Recensioni |
| `slot.service` / `availability.service` | Slot e disponibilità dei professionisti |
| `job-application.service` | Candidature lavorative |
| `chat.service` | API di alto livello per la chat (real-time + fallback) |
| `socket.service` | Connessione STOMP/WebSocket |
| `toast.service` | Notifiche toast |
| `storage.service` | Wrapper su `localStorage` |
| `logger.service` | Logging applicativo |
| `dashboard-facade.service` | Aggregazione dei dati di dashboard |

---

## Real-time (chat)

La chat usa **STOMP su WebSocket** tramite `@stomp/stompjs`.

- **`socket.service.ts`** — gestisce il ciclo di vita della connessione STOMP: token JWT negli header del frame **CONNECT**, heartbeat 10s (in entrata e in uscita), riconnessione automatica dopo 3s.
- **`chat.service.ts`** — API di alto livello sopra `socket.service`; se il WebSocket cade, attiva un **fallback in polling** ogni 3 secondi.

Canali STOMP:

- `/topic/chat/{roomId}` — messaggi della stanza (broadcast)
- `/user/queue/notifications` — notifiche private (nuovo messaggio, conteggio non letti, delivered/read)
- `/app/chat.join`, `/app/chat.leave`, `/app/chat.send`, `/app/chat.read` — comandi client → server

Funzionalità: aggiornamenti ottimistici della UI, stati messaggio
(`SENT`, `DELIVERED`, `READ`), sincronizzazione dei non letti, anteprima dell'ultimo messaggio.

---

## Design system

Tema Tailwind con design token definiti in `src/styles.css` e `tailwind.config.js`.

- **Palette** — Navy `#1A3462` (primario) con varianti deep/mid + Gold `#C9A96E` (accento) con varianti light/dark; sfondi off-white, colori di stato success/error/warning.
- **Tipografia** — *Clash Display* (display), *Plus Jakarta Sans* (testo), *JetBrains Mono* (monospace).
- **Raggi** — da 8px (sm) a 32px (2xl).
- **Ombre & gradienti** — ombre card sm/md/lg, glow gold/navy, gradiente navy→gold, mesh decorativa.
- **Branding** — logo "**Kore.**" (con il punto in oro), tagline *"Allenati. Mangia bene. Proteggi il futuro."*, tema PWA navy, locale italiano.

---

## Quick Start

### Prerequisiti

- **Node.js + npm**
- Il **backend Kore** in esecuzione su `http://localhost:8080` (vedi README del backend)

### Avvio

```powershell
npm install
npm start
```

L'applicazione è disponibile su `http://localhost:4200` e ricarica automaticamente ad ogni
modifica dei file sorgente. In sviluppo punta al backend su `http://localhost:8080`.

---

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm start` | Avvia il dev server (`ng serve`) su `http://localhost:4200` |
| `npm run build` | Build (configurazione development) in `dist/` |
| `npm run watch` | Build in watch mode (configurazione development) |
| `npm run ng` | Accesso diretto alla Angular CLI |

---

## Build & Environments

```powershell
npm run build
```

Compila l'applicazione e genera gli artefatti in `dist/` usando la configurazione `development`.

| Configurazione | File | `apiUrl` |
|---|---|---|
| Sviluppo | `src/environments/environment.ts` | `http://localhost:8080` |


