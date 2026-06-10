import { Injectable, inject, NgZone } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

// Messaggio che arriva dal backend: è lo stesso ChatMessageResponse lato Spring.
export interface WsIncomingMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
  roomId: string;
}

// Nuovo conteggio dei non letti spinto dal server.
export interface WsUnreadUpdate {
  userId: number;
  unreadCount: number;
}

// Cambio di stato di un messaggio (consegnato o letto).
export interface WsStatusUpdate {
  chatId: number;
  status: 'SENT' | 'DELIVERED' | 'READ';
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private zone = inject(NgZone);
  private log = inject(LoggerService);

  private client: Client | null = null;
  private currentUserId: number | null = null;
  private currentUserEmail: string | null = null;

  // Stato della connessione, così i componenti sanno se il WebSocket è su.
  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  // Da qui i componenti ascoltano quello che arriva dal server: i messaggi
  // della stanza aperta, il conteggio dei non letti e i cambi di stato dei messaggi.
  private incomingMessageSubject = new Subject<WsIncomingMessage>();
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  private unreadUpdateSubject = new Subject<WsUnreadUpdate>();
  unreadUpdate$ = this.unreadUpdateSubject.asObservable();

  private statusUpdateSubject = new Subject<WsStatusUpdate>();
  statusUpdate$ = this.statusUpdateSubject.asObservable();

  // Teniamo da parte le subscription aperte per poterle chiudere quando serve.
  private roomSubscription: StompSubscription | null = null;
  private activeRoomId: string | null = null;
  private notificationSubscription: StompSubscription | null = null;

  // Apre la connessione al WebSocket. Va chiamato dopo il login, quando la
  // dashboard parte. L'email serve poi per agganciarsi al canale privato
  // dell'utente. Prima di tutto recuperiamo il token JWT: senza, non ci
  // colleghiamo nemmeno.
  connect(userId: number, email: string): void {
    if (this.client?.connected) return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.log.warn('[WS] Nessun token JWT in localStorage — connessione annullata.');
      return;
    }

    this.currentUserId = userId;
    this.currentUserEmail = email;

    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/ws/websocket';

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },

      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      reconnectDelay: 3000,

      onConnect: () => {
        this.zone.run(() => {
          this.connectedSubject.next(true);
          this.log.debug('[WS] Connesso come userId:', userId);

          this.subscribeNotifications(email);
        });
      },

      onDisconnect: () => {
        this.zone.run(() => {
          this.connectedSubject.next(false);
          this.log.debug('[WS] Disconnesso');
        });
      },

      onStompError: (frame) => {
        this.log.error('[WS] Errore STOMP:', frame.headers['message'], frame.body);
      },

      onWebSocketClose: () => {
        this.zone.run(() => {
          this.connectedSubject.next(false);
        });
      }
    });

    this.client.activate();
  }

  // Chiude tutto al logout o quando la dashboard viene distrutta: prima
  // lasciamo la stanza e il canale notifiche, poi spegniamo il client.
  disconnect(): void {
    this.leaveRoom();
    this.unsubscribeNotifications();
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.currentUserId = null;
    this.currentUserEmail = null;
    this.connectedSubject.next(false);
  }

  // Entra in una stanza di chat: ci iscriviamo al suo topic per ricevere i
  // messaggi e avvisiamo il server con un JOIN. Se siamo già dentro a quella
  // stanza non rifacciamo nulla, altrimenti usciamo prima da quella vecchia.
  joinRoom(chatId: number): void {
    if (!this.client?.connected || !this.currentUserId) return;

    const roomId = String(chatId);

    if (this.activeRoomId === roomId && this.roomSubscription) return;

    this.leaveRoom();

    this.activeRoomId = roomId;

    this.roomSubscription = this.client.subscribe(
      `/topic/chat/${roomId}`,
      (message: IMessage) => {
        this.zone.run(() => {
          const payload: WsIncomingMessage = JSON.parse(message.body);
          this.incomingMessageSubject.next(payload);
        });
      }
    );

    this.client.publish({
      destination: '/app/chat.join',
      body: JSON.stringify({ roomId })
    });

    this.log.debug('[WS] Joined chat room:', roomId);
  }

  // Esce dalla stanza attiva: cancella la subscription e avvisa il server, che
  // così libera la memoria legata a quella stanza.
  leaveRoom(): void {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
      this.roomSubscription = null;
    }

    if (this.activeRoomId && this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.leave',
        body: JSON.stringify({ roomId: this.activeRoomId })
      });
      this.log.debug('[WS] Left room:', this.activeRoomId);
    }

    this.activeRoomId = null;
  }

  // Manda un messaggio. Il server lo gira subito alla stanza e poi lo salva su
  // DB in modo asincrono, quindi l'altro utente lo vede senza aspettare il save.
  sendMessage(chatId: number, _senderId: number, content: string): void {
    if (!this.client?.connected) return;

    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ chatId, content })
    });
  }

  // Dice al server che abbiamo letto i messaggi della chat.
  markAsRead(chatId: number): void {
    if (!this.client?.connected) return;

    this.client.publish({
      destination: '/app/chat.read',
      body: JSON.stringify({ chatId })
    });
  }

  // Canale privato dell'utente: qui arrivano gli eventi che non dipendono dalla
  // stanza aperta (nuovo messaggio altrove, non letti, consegne e letture).
  // A seconda del tipo, smistiamo l'evento sullo stream giusto.
  private subscribeNotifications(_email: string): void {
    if (!this.client?.connected) return;

    this.notificationSubscription = this.client.subscribe(
      `/user/queue/notifications`,
      (message: IMessage) => {
        this.zone.run(() => {
          const payload = JSON.parse(message.body);

          if (payload.type === 'UNREAD_UPDATE') {
            this.unreadUpdateSubject.next({
              userId: payload.userId,
              unreadCount: payload.unreadCount
            });
          } else if (payload.type === 'NEW_MESSAGE') {
            this.incomingMessageSubject.next(payload.message);
          } else if (payload.type === 'DELIVERED_UPDATE' || payload.type === 'READ_UPDATE') {
            this.statusUpdateSubject.next({
              chatId: payload.message.chatId,
              status: payload.message.status
            });
          }
        });
      }
    );
  }

  private unsubscribeNotifications(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
      this.notificationSubscription = null;
    }
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  get userId(): number | null {
    return this.currentUserId;
  }

  get currentRoomId(): string | null {
    return this.activeRoomId;
  }
}

