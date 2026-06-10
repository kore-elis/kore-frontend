import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, Subject, Subscription, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService, WsIncomingMessage, WsStatusUpdate } from './socket.service';

export interface ChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
}

export interface Conversation {
  chatId?: number;
  otherUserId: number;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicture?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  terminated?: boolean;
}

export interface SendMessageRequest {
  chatId: number;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private apiUrl = environment.apiUrl;

  // Lo stato della chat vive qui, nel service, non nel componente: così resta
  // in piedi anche quando la tab chat viene chiusa e riaperta.
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  // La conversazione aperta la teniamo qui apposta, perché deve sopravvivere
  // alla distruzione del componente.
  private _activeConversation: Conversation | null = null;

  conversations$ = this.conversationsSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  // Scatta a ogni nuovo messaggio in tempo reale (serve per scroll e suoni).
  private newMessageSubject = new Subject<ChatMessage>();
  newMessage$ = this.newMessageSubject.asObservable();

  // Quando il WebSocket non è disponibile ricadiamo sul polling REST.
  private msgPollingActive = false;
  private msgPollInterval: ReturnType<typeof setInterval> | null = null;
  private globalPollInterval: ReturnType<typeof setInterval> | null = null;
  private globalPollingActive = false;

  // Subscription al socket: le teniamo per poterle chiudere tutte al destroy.
  private wsSubscriptions: Subscription[] = [];

  // Chiamate REST: servono per il caricamento iniziale e come rete di sicurezza
  // quando il real-time non c'è. Se una richiesta fallisce torniamo un valore
  // vuoto invece di rompere la UI.

  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(
      `${this.apiUrl}/api/chat/conversations`
    ).pipe(catchError(() => of([])));
  }

  getMessages(chatId: number, page = 0, size = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/api/chat/conversation/${chatId}?page=${page}&size=${size}`
    ).pipe(catchError(() => of([])));
  }

  sendMessage(request: SendMessageRequest): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/api/chat/send`, request);
  }

  createChat(receiverId: number): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/api/chat/create/${receiverId}`, {});
  }

  closeChat(chatId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/chat/${chatId}/close`, {});
  }

  markAsRead(chatId: number, otherUserId: number): Observable<void> {
    this.optimisticMarkAsRead(otherUserId);
    return this.http.put<void>(
      `${this.apiUrl}/api/chat/read/${chatId}`, {}
    ).pipe(catchError(() => of(void 0)));
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/api/chat/unread`
    ).pipe(catchError(() => of(0)));
  }

  // Avvia tutto il real-time. Prima ripuliamo con destroy(), altrimenti a ogni
  // reinizializzazione resterebbero listener doppi e perdite di memoria. Poi apriamo il
  // WebSocket e ci agganciamo ai suoi stream: messaggi in arrivo, conteggio non
  // letti e cambi di stato. Infine accendiamo il polling globale come fallback.
  init(userId: number, email: string): void {
    this.destroy();

    this.socketService.connect(userId, email);

    const msgSub = this.socketService.incomingMessage$.subscribe(wsMsg => {
      this.handleIncomingWsMessage(wsMsg, userId);
    });
    this.wsSubscriptions.push(msgSub);

    const unreadSub = this.socketService.unreadUpdate$.subscribe(update => {
      this.unreadCountSubject.next(update.unreadCount);
    });
    this.wsSubscriptions.push(unreadSub);

    const statusSub = this.socketService.statusUpdate$.subscribe(update => {
      this.updateMessagesStatus(update.chatId, update.status);
    });
    this.wsSubscriptions.push(statusSub);

    this.startGlobalPolling();
  }

  // Da chiamare al logout o quando si esce: chiude socket, polling e listener.
  destroy(): void {
    this.wsSubscriptions.forEach(s => s.unsubscribe());
    this.wsSubscriptions = [];
    this.socketService.disconnect();
    this.stopGlobalPolling();
    this.stopMessagePolling();

    // Svuotiamo anche lo stato in memoria: senza questo, l'utente successivo che
    // fa login si ritroverebbe le conversazioni del precedente (bug "chat mischiate").
    this.conversationsSubject.next([]);
    this.messagesSubject.next([]);
    this.unreadCountSubject.next(0);
    this._activeConversation = null;
  }

  joinRoom(chatId: number): void {
    this.socketService.joinRoom(chatId);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
  }

  // Manda il messaggio sul WebSocket e, senza aspettare la risposta, restituisce
  // una copia locale da mostrare subito in chat (UI ottimistica). Le diamo un id
  // negativo così la riconosciamo come "non ancora confermata dal server".
  sendMessageRealTime(chatId: number, senderId: number, content: string, senderName: string, receiverName: string, receiverId: number): ChatMessage {
    const localMsg: ChatMessage = {
      id: -Date.now(),
      chatId,
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      status: 'SENT',
      createdAt: new Date().toISOString()
    };
    this.socketService.sendMessage(chatId, senderId, content);
    return localMsg;
  }

  markAsReadRealTime(chatId: number, otherUserId: number): void {
    this.socketService.markAsRead(chatId);
    this.optimisticMarkAsRead(otherUserId);
  }

  private optimisticMarkAsRead(otherUserId: number): void {
    const convs = this.conversationsSubject.value;
    const idx = convs.findIndex(c => c.otherUserId === otherUserId);
    if (idx >= 0 && convs[idx].unreadCount > 0) {
      const readMessages = convs[idx].unreadCount;


      const updated = [...convs];
      updated[idx] = { ...updated[idx], unreadCount: 0 };
      this.conversationsSubject.next(updated);


      const currentGlobal = this.unreadCountSubject.value;
      if (currentGlobal >= readMessages) {
        this.unreadCountSubject.next(currentGlobal - readMessages);
      }
    }
  }

  // Gestisce un messaggio arrivato dal socket. Se riguarda la stanza aperta lo
  // inseriamo nella lista; altrimenti aggiorniamo solo l'anteprima e i non letti.
  private handleIncomingWsMessage(wsMsg: WsIncomingMessage, currentUserId: number): void {
    const msg: ChatMessage = {
      id: wsMsg.id,
      chatId: wsMsg.chatId,
      senderId: wsMsg.senderId,
      senderName: wsMsg.senderName,
      receiverId: wsMsg.receiverId,
      receiverName: wsMsg.receiverName,
      content: wsMsg.content,
      status: wsMsg.status,
      createdAt: wsMsg.createdAt
    };

    const currentRoom = this.socketService.currentRoomId;
    const msgRoom = wsMsg.roomId;

    if (currentRoom === msgRoom) {
      const currentMsgs = this.messagesSubject.value;

      // Se è la conferma di un messaggio che avevamo già mostrato in ottimistico
      // (stesso mittente e stesso testo, id ancora negativo), lo sostituiamo con
      // la versione del server invece di aggiungerne uno doppio.
      const localOptimisticIdx = currentMsgs.findIndex(m =>
        m.id < 0 && m.senderId === msg.senderId && m.content === msg.content
      );

      const serverDuplicateIdx = currentMsgs.findIndex(m => m.id > 0 && m.id === msg.id);

      if (localOptimisticIdx >= 0) {
        const updated = [...currentMsgs];
        updated[localOptimisticIdx] = msg;
        this.messagesSubject.next(updated);
      } else if (serverDuplicateIdx >= 0) {
        // Già in lista, è un doppione del server: lo lasciamo stare.
      } else {
        this.messagesSubject.next([...currentMsgs, msg]);
      }
    }

    this.newMessageSubject.next(msg);
    this.updateConversationPreview(wsMsg, currentUserId);
  }

  private updateConversationPreview(wsMsg: WsIncomingMessage, currentUserId: number): void {
    const convs = this.conversationsSubject.value;
    const otherUserId = wsMsg.senderId === currentUserId ? wsMsg.receiverId : wsMsg.senderId;
    const otherUserName = wsMsg.senderId === currentUserId ? wsMsg.receiverName : wsMsg.senderName;
    const idx = convs.findIndex(c => c.otherUserId === otherUserId);

    // Se la conversazione esiste già aggiorniamo anteprima e contatore; il non
    // letto sale solo se il messaggio è dell'altro e non stiamo guardando quella
    // stanza. Se invece è una chat nuova, la mettiamo in cima alla lista.
    if (idx >= 0) {
      const updated = [...convs];
      updated[idx] = {
        ...updated[idx],
        lastMessage: wsMsg.content,
        lastMessageTime: wsMsg.createdAt,
        terminated: false,
        unreadCount: (wsMsg.senderId !== currentUserId && this.socketService.currentRoomId !== wsMsg.roomId)
          ? updated[idx].unreadCount + 1
          : updated[idx].unreadCount
      };
      this.conversationsSubject.next(updated);
    } else {

      const newConv: Conversation = {
        chatId: wsMsg.chatId,
        otherUserId,
        otherUserName: otherUserName || 'Utente',
        otherUserRole: '',
        lastMessage: wsMsg.content,
        lastMessageTime: wsMsg.createdAt,
        unreadCount: wsMsg.senderId !== currentUserId ? 1 : 0
      };
      this.conversationsSubject.next([newConv, ...convs]);
    }
  }

  // Aggiorna lo stato dei messaggi (inviato → consegnato → letto). Lo facciamo
  // solo in avanti: un READ non deve mai tornare indietro a DELIVERED, quindi
  // confrontiamo l'ordine prima di sovrascrivere.
  private updateMessagesStatus(chatId: number, status: 'SENT' | 'DELIVERED' | 'READ'): void {
    const msgs = this.messagesSubject.value;
    if (!msgs.some(m => m.chatId === chatId)) return;
    const order: Record<string, number> = { SENT: 0, DELIVERED: 1, READ: 2 };
    this.messagesSubject.next(msgs.map(m =>
      m.chatId === chatId && order[status] > (order[m.status] ?? 0) ? { ...m, status } : m
    ));
  }

  // Polling globale: tiene allineati conversazioni e non letti anche se il
  // real-time perde qualche colpo. Quando il socket è connesso possiamo andare
  // piano (15s); se è giù ci appoggiamo solo a questo, quindi acceleriamo (5s).
  startGlobalPolling(): void {
    if (this.globalPollingActive) return;
    this.globalPollingActive = true;

    this.refreshUnreadCount();
    this.refreshConversations();

    const getInterval = () => this.socketService.isConnected ? 15000 : 5000;
    this.globalPollInterval = setInterval(() => {
      if (!this.globalPollingActive) return;
      this.refreshUnreadCount();
      this.refreshConversations();
    }, getInterval());
  }

  stopGlobalPolling(): void {
    this.globalPollingActive = false;
    if (this.globalPollInterval) {
      clearInterval(this.globalPollInterval);
      this.globalPollInterval = null;
    }
  }

  private refreshUnreadCount(): void {
    this.getUnreadCount().subscribe(count => {
      if (count !== this.unreadCountSubject.value) {
        this.unreadCountSubject.next(count);
      }
    });
  }

  private refreshConversations(): void {
    this.getConversations().subscribe(convs => {
      let currentConvs = convs ?? [];

      // Una chat appena aperta potrebbe non essere ancora salvata sul backend:
      // qui ce ne assicuriamo che non sparisca dalla lista a ogni refresh, e per
      // quella aperta azzeriamo i non letti senza aspettare il server.
      if (this._activeConversation) {
        const activeId = this._activeConversation.otherUserId;

        const activeConv = currentConvs.find(c => c.otherUserId === activeId);
        if (activeConv) {
          activeConv.unreadCount = 0;
        }

        if (!currentConvs.some(c => c.otherUserId === activeId)) {
          const existingLocal = this.conversationsSubject.value.find(c => c.otherUserId === activeId);
          if (existingLocal) {
            currentConvs = [existingLocal, ...currentConvs];
          } else {
            currentConvs = [this._activeConversation, ...currentConvs];
          }
        }
      }

      this.conversationsSubject.next(currentConvs);
    });
  }

  // Polling dei messaggi della chat aperta, solo quando il WebSocket è giù.
  // Ricarichiamo dal server, ma teniamo in coda i messaggi ottimistici che il
  // server non ha ancora restituito, così non spariscono sotto gli occhi.
  startMessagePolling(chatId: number): void {
    if (this.socketService.isConnected) return;
    this.stopMessagePolling();
    this.msgPollingActive = true;
    this.msgPollInterval = setInterval(() => {
      if (!this.msgPollingActive) return;
      this.getMessages(chatId).subscribe(msgs => {
        if (msgs.length > 0) {
          const currentMsgs = this.messagesSubject.value;
          const localOptimistic = currentMsgs.filter(m => m.id < 0);

          const unresolvedLocal = localOptimistic.filter(local =>
            !msgs.some(server => server.senderId === local.senderId && server.content === local.content)
          );

          this.messagesSubject.next([...msgs, ...unresolvedLocal]);
        }
      });
    }, 3000);
  }

  stopMessagePolling(): void {
    this.msgPollingActive = false;
    if (this.msgPollInterval) {
      clearInterval(this.msgPollInterval);
      this.msgPollInterval = null;
    }
  }

  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  setMessages(msgs: ChatMessage[]): void {
    this.messagesSubject.next(msgs);
  }

  getConversationsSnapshot(): Conversation[] {
    return this.conversationsSubject.value;
  }

  getMessagesSnapshot(): ChatMessage[] {
    return this.messagesSubject.value;
  }

  get activeConversation(): Conversation | null {
    return this._activeConversation;
  }

  set activeConversation(conv: Conversation | null) {
    this._activeConversation = conv;
  }
}
