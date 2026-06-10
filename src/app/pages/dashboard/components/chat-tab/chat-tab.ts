import { Component, Input, inject, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, Conversation } from '../../../../core/services/chat.service';
import { SocketService } from '../../../../core/services/socket.service';
import { AuthUser, UserProfile, ProfessionalSummary, ClientBasicInfo } from '../../../../shared/models/dashboard.model';
import { StorageService } from '../../../../core/services/storage.service';
import { RoleService } from '../../../../core/services/role.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { matchesUserSearch } from '../../../../shared/utils/user.util';
import { Subscription } from 'rxjs';

/** Forma minima comune degli utenti mostrati nel picker "nuova chat" (clienti, professionisti o utenti admin). */
interface ChatPickerUser {
  id: number;
  firstName?: string;
  lastName?: string;
  role?: string;
  email?: string;
}

@Component({
  selector: 'app-chat-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-tab.html',
  styleUrls: ['./chat-tab.css'],
  encapsulation: ViewEncapsulation.None
})
export class ChatTabComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private socketService = inject(SocketService);
  private cdr = inject(ChangeDetectorRef);
  private storageService = inject(StorageService);
  private roleService = inject(RoleService);
  private log = inject(LoggerService);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private _currentUser: AuthUser | null = null;
  @Input() set currentUser(value: AuthUser | null) { this._currentUser = value; }
  get currentUser(): AuthUser { return this._currentUser!; }
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() isInsurance: boolean = false;
  @Input() isAdmin: boolean = false;
  @Input() isModerator: boolean = false;
  @Input() professionals: ProfessionalSummary[] = [];
  @Input() myClients: ClientBasicInfo[] = [];
  @Input() allUsers: UserProfile[] = [];

  chatConversations: Conversation[] = [];
  chatMessages: ChatMessage[] = [];
  activeConversation: Conversation | null = null;
  chatInput: string = '';
  chatLoading: boolean = false;
  chatView: 'list' | 'conversation' = 'list';
  closingChat: boolean = false;
  private subscriptions: Subscription[] = [];
  private conversationsLoaded = false;  // Indicatore: true dopo il primo caricamento

  // Selettore utente (admin)
  showUserPicker: boolean = false;
  userPickerSearch: string = '';

  private get emptyConvsCacheKey(): string {
    return `chat_empty_convs_${this.currentUser?.id}`;
  }

  private loadStoredEmptyConvs(): Conversation[] {
    return this.storageService.get<Conversation[]>(this.emptyConvsCacheKey) ?? [];
  }

  private saveStoredEmptyConvs(convs: Conversation[]): void {
    this.storageService.set(this.emptyConvsCacheKey, convs);
  }

  get filteredPickerUsers(): ChatPickerUser[] {
    let users: ChatPickerUser[] = [];

    if (this.isClient && this.professionals?.length > 0) {
      users = this.professionals.map(p => ({
        id: p.id,
        firstName: p.firstName || p.fullName?.split(' ')[0],
        lastName: p.lastName || p.fullName?.split(' ').slice(1).join(' '),
        role: p.role,
        email: p.email
      }));
    } else if (this.isProfessional && this.myClients?.length > 0) {
      users = this.myClients.map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        role: 'CLIENT',
        email: c.email
      }));
    } else if (this.allUsers?.length) {
      users = this.allUsers.filter(u => u.id !== this.currentUser?.id && this.canStartConversationWith(u.role));
    }

    if (!users.length) return [];

    // Escludi quelli già in conversazione o tra i contatti locali vuoti
    const existingIds = new Set(this.chatConversations.map(c => c.otherUserId));
    users = users.filter(u => !existingIds.has(u.id));
    if (this.userPickerSearch.trim()) {
      users = users.filter(u => matchesUserSearch(u, this.userPickerSearch));
    }
    return users;
  }

  // Ritorna true se la conversazione c'era già, false se l'abbiamo appena creata.
  startConversationWith(user: ChatPickerUser): boolean {
    if (user.id === this.currentUser?.id) return false;

    const existing = this.chatConversations.find(c => c.otherUserId === user.id);
    if (existing) {

      this.showUserPicker = false;
      this.userPickerSearch = '';
      this.openConversation(existing);
      return true;
    }

    const conv: Conversation = {
      otherUserId: user.id,
      otherUserName: `${user.firstName} ${user.lastName}`,
      otherUserRole: this.getRoleLabel(user.role),
      lastMessage: undefined,
      lastMessageTime: undefined,
      unreadCount: 0
    };

    this.chatConversations = [conv, ...this.chatConversations];
    this.showUserPicker = false;
    this.userPickerSearch = '';
    this.openConversation(conv);
    return false;
  }

  getRoleLabel(role: string | undefined): string {
    return this.roleService.getRoleLabel(role ?? '');
  }

  isConversationWithModerator(): boolean {
    const role = this.activeConversation?.otherUserRole;
    return role === 'MODERATOR' || role === 'Moderatore';
  }

  reopenTerminatedConversation(): void {
    if (this.activeConversation?.terminated) {
      this.activeConversation = { ...this.activeConversation, terminated: false };
      this.chatService.activeConversation = this.activeConversation;
    }
  }

  closeActiveChat(): void {
    if (!this.activeConversation?.chatId || this.closingChat) return;
    this.closingChat = true;
    const deletedChatId = this.activeConversation.chatId;
    const sub = this.chatService.closeChat(deletedChatId).subscribe({
      next: () => {
        this.chatConversations = this.chatConversations.filter(c => c.chatId !== deletedChatId);
        this.closingChat = false;
        this.backToConversations();
      },
      error: () => { this.closingChat = false; }
    });
    this.subscriptions.push(sub);
  }

  private canStartConversationWith(targetRole: string): boolean {
    const myRole = this.currentUser?.role;
    if (!myRole || !targetRole) return false;

    if (myRole === 'ADMIN') {
      return targetRole !== 'ADMIN'; // Admin chatta con tutti tranne altri Admin
    }
    if (myRole === 'INSURANCE_MANAGER') {
      return targetRole === 'ADMIN' || targetRole === 'MODERATOR';
    }
    if (myRole === 'MODERATOR') {
      return targetRole === 'CLIENT' || targetRole === 'PERSONAL_TRAINER'
          || targetRole === 'NUTRITIONIST' || targetRole === 'ADMIN' || targetRole === 'MODERATOR';
    }
    if (myRole === 'CLIENT') {
      return targetRole === 'PERSONAL_TRAINER' || targetRole === 'NUTRITIONIST' || targetRole === 'MODERATOR';
    }
    if (myRole === 'PERSONAL_TRAINER' || myRole === 'NUTRITIONIST') {
      return targetRole === 'CLIENT' || targetRole === 'MODERATOR';
    }
    return false;
  }

  ngOnInit(): void {
    this.loadConversations();


    const savedConv = this.chatService.activeConversation;
    const currentMsgs = this.chatService.getMessagesSnapshot();
    if (savedConv) {
      this.activeConversation = savedConv;
      this.chatView = 'conversation';
      if (currentMsgs.length > 0) {
        // Ripristino immediato dallo snapshot, poi aggiorna silenziosamente in background
        this.chatMessages = this.sortMessages(currentMsgs);
        setTimeout(() => this.scrollToBottom(), 100);
        // Ricarica in background per avere eventuali nuovi messaggi
        this.chatService.getMessages(this.currentUser.id, savedConv.otherUserId).subscribe({
          next: (serverMsgs) => {
            if (serverMsgs.length >= this.chatMessages.length) {
              this.chatMessages = this.sortMessages(serverMsgs);
              this.cdr.detectChanges();
              setTimeout(() => this.scrollToBottom(), 50);
            }
          }
        });
      } else {
        // Nessuno snapshot: carica normalmente
        this.openConversation(savedConv);
      }
    }

    // Subscribe to conversation updates (da polling globale + WS)
    const convSub = this.chatService.conversations$.subscribe(convs => {
      // Ignora l'emit iniziale del BehaviorSubject prima che loadConversations finisca
      if (!this.conversationsLoaded) return;

      const backendConvs = convs ?? [];
      const backendIds = new Set(backendConvs.map(c => c.otherUserId));

      // I contatti locali includono ora anche quelli dal localStorage
      const baseLocalContacts = this.buildLocalConversations();
      let storedEmpty = this.loadStoredEmptyConvs();

      // Rimuovi dalla cache le conversazioni vuote ora presenti sul backend
      const cachedLength = storedEmpty.length;
      storedEmpty = storedEmpty.filter(sc => !backendIds.has(sc.otherUserId));
      if (storedEmpty.length !== cachedLength) {
        this.saveStoredEmptyConvs(storedEmpty);
      }

      // Unisci la base locale e quelle salvate
      const localMap = new Map<number, Conversation>();
      [...baseLocalContacts, ...storedEmpty].forEach(c => localMap.set(c.otherUserId, c));
      const localContacts = Array.from(localMap.values());

      // Filtra quelli che sono già nel backend (quindi non più "vuoti")
      const localOnly = localContacts.filter(lc => !backendIds.has(lc.otherUserId));


      const currentLocalIds = new Set([...backendIds, ...localOnly.map(l => l.otherUserId)]);
      const pickerOnly = this.chatConversations.filter(c =>
        !currentLocalIds.has(c.otherUserId) &&
        (this.activeConversation && c.otherUserId === this.activeConversation.otherUserId)
      );

      let mergedConversations = [...backendConvs, ...localOnly, ...pickerOnly];


      if (this.activeConversation && !mergedConversations.some(c => c.otherUserId === this.activeConversation!.otherUserId)) {
        mergedConversations.unshift(this.activeConversation);
      }

      this.chatConversations = this.sortConversations(mergedConversations);
      this.cdr.detectChanges();
    });
    this.subscriptions.push(convSub);

    // Subscribe a messaggi real-time dal WebSocket (per la conversazione attiva)
    const msgSub = this.chatService.messages$.subscribe(msgs => {
      if (this.activeConversation && msgs.length > 0) {
        // Protezione: ignora messaggi di un'altra chat (evita sovrapposizioni durante la transizione)
        if (this.activeConversation.chatId && msgs.every(m => m.chatId !== this.activeConversation!.chatId)) return;
        // Mantieni i messaggi locali ottimistici (id < 0) non ancora confermati dal server
        const localOptimistic = this.chatMessages.filter(m => m.id < 0 &&
          !msgs.some(sm => sm.senderId === m.senderId && sm.content === m.content));

        // Ordina i messaggi e aggiorna solo se c'è una variazione
        const sorted = this.sortMessages([...msgs, ...localOptimistic]);
        const hasStatusChange = sorted.some((m, i) => this.chatMessages[i]?.status !== m.status);
        if (sorted.length !== this.chatMessages.length ||
          (sorted.length > 0 && sorted[sorted.length - 1].id !== this.chatMessages[this.chatMessages.length - 1]?.id) ||
          localOptimistic.length > 0 ||
          hasStatusChange) {
          this.chatMessages = sorted;
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 50);
        }
      }
    });
    this.subscriptions.push(msgSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];

    this.chatService.stopMessagePolling();
  }

  loadConversations(): void {
    if (!this.currentUser) return;
    this.chatLoading = true;
    this.chatService.getConversations().subscribe({
      next: (convs) => {
        const backendConvs = convs ?? [];
        const backendIds = new Set(backendConvs.map(c => c.otherUserId));

        // Unisci contatti locali base e quelli vuoti salvati in localStorage
        const baseLocalContacts = this.buildLocalConversations();
        let storedEmpty = this.loadStoredEmptyConvs();

        // Pulisci subito eventuali chat vuote che ora sono nel backend
        const cachedLength = storedEmpty.length;
        storedEmpty = storedEmpty.filter(sc => !backendIds.has(sc.otherUserId));
        if (storedEmpty.length !== cachedLength) {
          this.saveStoredEmptyConvs(storedEmpty);
        }

        const localMap = new Map<number, Conversation>();
        [...baseLocalContacts, ...storedEmpty].forEach(c => localMap.set(c.otherUserId, c));
        const localContacts = Array.from(localMap.values());

        const localOnly = localContacts.filter(lc => !backendIds.has(lc.otherUserId));

        let mergedObj = [...backendConvs, ...localOnly];

        if (this.activeConversation && !mergedObj.some(c => c.otherUserId === this.activeConversation!.otherUserId)) {
          mergedObj.unshift(this.activeConversation);
        }

        this.chatConversations = this.sortConversations(mergedObj);
        this.chatLoading = false;
        this.conversationsLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        const baseLocalContacts = this.buildLocalConversations();
        const storedEmpty = this.loadStoredEmptyConvs();
        const localMap = new Map<number, Conversation>();
        [...baseLocalContacts, ...storedEmpty].forEach(c => localMap.set(c.otherUserId, c));

        let fallbackConvs = Array.from(localMap.values());
        if (this.activeConversation && !fallbackConvs.some(c => c.otherUserId === this.activeConversation!.otherUserId)) {
          fallbackConvs.unshift(this.activeConversation);
        }
        this.chatConversations = this.sortConversations(fallbackConvs);
        this.chatLoading = false;
        this.conversationsLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  buildLocalConversations(): Conversation[] {
    const convs: Conversation[] = [];
    if (this.isClient && this.professionals?.length > 0) {
      this.professionals.forEach((p) => {
        convs.push({ otherUserId: p.id, otherUserName: p.fullName, otherUserRole: p.role === 'PERSONAL_TRAINER' ? 'Personal Trainer' : 'Nutrizionista', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    if (this.isProfessional && this.myClients?.length > 0) {
      this.myClients.forEach((c) => {
        convs.push({ otherUserId: c.id, otherUserName: `${c.firstName} ${c.lastName}`, otherUserRole: 'Cliente', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    // Insurance Manager: può chattare solo con Admin
    if (this.isInsurance && this.allUsers?.length > 0) {
      this.allUsers.filter(u => u.role === 'ADMIN').forEach((a) => {
        convs.push({ otherUserId: a.id, otherUserName: `${a.firstName} ${a.lastName}`, otherUserRole: 'Admin', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    // Per Admin e Moderatori non prepopoliamo le chat vuote nella lista, utilizzeranno il picker.
    // Le chat vuote scompariranno dalla lista se non ci sono messaggi inviati.
    return convs;
  }

  openConversation(conv: Conversation): void {
    this.activeConversation = conv;
    this.chatService.activeConversation = conv;  // Persisti nel service
    this.chatView = 'conversation';
    this.chatLoading = true;

    // Svuota subito UI e service per evitare overlap di messaggi tra chat diverse
    this.chatMessages = [];
    this.chatService.clearMessages();
    this.chatService.stopMessagePolling();

    // Se non abbiamo ancora il chatId, dobbiamo crearlo/recuperarlo tramite backend
    if (!conv.chatId) {
      this.chatService.createChat(conv.otherUserId).subscribe({
        next: (newChatId) => {
          conv.chatId = newChatId;
          this.loadMessagesAndJoin(conv);
        },
        error: () => {
          this.chatLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.loadMessagesAndJoin(conv);
    }
  }

  private loadMessagesAndJoin(conv: Conversation): void {
    if (!conv.chatId) return;

    this.chatService.joinRoom(conv.chatId);

    this.chatService.getMessages(conv.chatId).subscribe({
      next: (serverMsgs) => {
        // Mantieni i messaggi locali ottimistici (id < 0) non ancora confermati dal server
        const localOptimistic = this.chatMessages.filter(m => m.id < 0 &&
          !serverMsgs.some(sm => sm.senderId === m.senderId && sm.content === m.content));
        const merged = this.sortMessages([...serverMsgs, ...localOptimistic]);
        this.chatMessages = merged;
        this.chatService.setMessages(merged); // Sincronizza lo stato globale WebSocket per evitare la scomparsa del primo messaggio
        this.chatLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => { this.chatLoading = false; this.cdr.detectChanges(); }
    });


    if (this.socketService.isConnected) {
      this.chatService.markAsReadRealTime(conv.chatId, conv.otherUserId);
    } else {
      this.chatService.markAsRead(conv.chatId, conv.otherUserId).subscribe();
    }
    conv.unreadCount = 0;


    this.chatService.startMessagePolling(conv.chatId);
  }

  sendChatMessage(): void {
    const text = this.chatInput.trim();
    if (!text || !this.activeConversation || !this.activeConversation.chatId) return;

    const receiverId = this.activeConversation.otherUserId;
    const chatId = this.activeConversation.chatId;
    const senderName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    const receiverName = this.activeConversation.otherUserName;

    if (this.socketService.isConnected) {
      // Real-time via WebSocket
      const localMsg = this.chatService.sendMessageRealTime(
        chatId, this.currentUser.id, text, senderName, receiverName, receiverId
      );
      this.chatMessages = [...this.chatMessages, localMsg];
      this.chatInput = '';
      this.cdr.detectChanges();
      this.scrollToBottom();

      // Aggiorna anteprima conversazione
      if (this.activeConversation) {
        this.activeConversation.lastMessage = text;
        this.activeConversation.lastMessageTime = localMsg.createdAt;
      }
    } else {
      // Fallback REST
      const localMsg: ChatMessage = {
        id: -Date.now(),
        chatId,
        senderId: this.currentUser.id,
        senderName,
        receiverId,
        receiverName,
        content: text,
        status: 'SENT',
        createdAt: new Date().toISOString()
      };
      this.chatMessages = [...this.chatMessages, localMsg];
      this.chatInput = '';
      this.cdr.detectChanges();
      this.scrollToBottom();

      if (this.activeConversation) {
        this.activeConversation.lastMessage = text;
        this.activeConversation.lastMessageTime = localMsg.createdAt;
      }

      this.chatService.sendMessage({ chatId, content: text }).subscribe({
        next: (savedMsg) => {
          const exists = this.chatMessages.some(m => m.id === localMsg.id);
          if (exists) {
            this.chatMessages = this.chatMessages.map(m => m.id === localMsg.id ? savedMsg : m);
          } else if (!this.chatMessages.some(m => m.id === savedMsg.id)) {
            this.chatMessages = [...this.chatMessages, savedMsg];
            this.chatMessages = this.sortMessages(this.chatMessages);
          }
          this.cdr.detectChanges();
        },
        error: (err) => { this.log.warn('Errore invio messaggio', err); }
      });
    }
  }

  backToConversations(): void {
    if (this.activeConversation && this.activeConversation.chatId) {
      if (this.socketService.isConnected) {
        this.chatService.markAsReadRealTime(this.activeConversation.chatId, this.activeConversation.otherUserId);
      } else {
        this.chatService.markAsRead(this.activeConversation.chatId, this.activeConversation.otherUserId).subscribe();
      }
      this.activeConversation.unreadCount = 0;
      this.activeConversation = null;
    }

    this.chatService.leaveRoom();
    this.chatService.activeConversation = null;

    this.chatView = 'list';

    this.chatMessages = [];
    this.chatService.stopMessagePolling();
    this.loadConversations();
  }


  isMyMessage(msg: ChatMessage): boolean { return msg.senderId === this.currentUser?.id; }

  private parseMessageDate(isoString: string): Date {
    if (!isoString) return new Date();
    if (!isoString.endsWith('Z') && !isoString.includes('+') && !/\d{2}-\d{2}$/.test(isoString)) return new Date(isoString + 'Z');
    return new Date(isoString);
  }

  private sortMessages(msgs: ChatMessage[]): ChatMessage[] {
    return [...msgs].sort((a, b) => this.parseMessageDate(a.createdAt).getTime() - this.parseMessageDate(b.createdAt).getTime());
  }

  private sortConversations(convs: Conversation[]): Conversation[] {
    const filtered = convs.filter(c => {
      if (c.lastMessage && c.lastMessage.trim() !== '') return true;
      if (this.activeConversation && c.otherUserId === this.activeConversation.otherUserId) return true;
      return false;
    });

    return [...filtered].sort((a, b) => {
      // Sort by unread messages first
      if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
        return a.unreadCount > 0 ? -1 : 1;
      }

      // Sort by last message time descending
      const timeA = a.lastMessageTime ? this.parseMessageDate(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? this.parseMessageDate(b.lastMessageTime).getTime() : 0;

      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // Fallback to alphabetically
      return a.otherUserName.localeCompare(b.otherUserName);
    });
  }

  formatChatTime(isoString: string): string {
    if (!isoString) return '';
    const d = this.parseMessageDate(isoString); const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Ieri ${time}`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ` ${time}`;
  }

  getMessageDateHeader(isoString: string): string {
    if (!isoString) return '';
    const d = this.parseMessageDate(isoString);
    const now = new Date();

    if (d.toDateString() === now.toDateString()) {
      return 'Oggi';
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    }

    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatConvTime(isoString?: string): string {
    if (!isoString) return '';
    const d = this.parseMessageDate(isoString); const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }

  getConversationInitials(conv: Conversation): string {
    return conv.otherUserName.split(' ').map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
  }

  trackConversation(index: number, conv: Conversation): number { return conv.otherUserId; }
  trackMessage(index: number, msg: ChatMessage): number { return msg.id; }

  private scrollToBottom(): void {
    try { if (this.messagesContainer) { const el = this.messagesContainer.nativeElement; el.scrollTop = el.scrollHeight; } } catch (e) { }
  }

  autoGrow(event: Event): void { const el = event.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

  onChatKeydown(event: KeyboardEvent): void { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendChatMessage(); } }
}
