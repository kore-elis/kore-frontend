import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SlotService } from './slot.service';
import { ProfessionalSlot, SlotPayload, BookingRequest } from '../../shared/models/dashboard.model';

const START_HOUR = 8;
const END_HOUR = 21;

// Qui sta tutta la logica di calendario, slot e prenotazioni che prima stava
// dentro al DashboardComponent. Le chiamate HTTP le gira allo SlotService; i
// metodi "puri" più sotto servono solo a preparare i dati per la vista.
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private slotService = inject(SlotService);

  loadProfessionalSlots(professionalId: number): Observable<ProfessionalSlot[]> {
    return this.slotService.getProfessionalSlots(professionalId);
  }

  createSlots(slots: SlotPayload[]): Observable<void> {
    return this.slotService.createProfessionalSlots(slots);
  }

  deleteSlot(slotId: number): Observable<void> {
    return this.slotService.deleteProfessionalSlot(slotId);
  }

  // Per la prenotazione mostriamo solo gli slot da domani in poi: oggi e i
  // giorni passati non sono prenotabili, quindi li filtriamo via.
  getAvailableSlotsFromTomorrow(professionalId: number): Observable<ProfessionalSlot[]> {
    return this.loadProfessionalSlots(professionalId).pipe(
      map(slots => {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return slots.filter(s =>
          (s.available || s.isAvailable) && new Date(s.startTime) >= tomorrow
        );
      })
    );
  }

  createBooking(request: BookingRequest): Observable<void> {
    return this.slotService.createBooking(request);
  }

  cancelBooking(bookingId: number): Observable<void> {
    return this.slotService.cancelBooking(bookingId);
  }

  // Costruisce i 7 giorni della prossima settimana, da lunedì a domenica.
  buildNextWeekDays(): Date[] {
    const today = new Date();
    const dow = today.getDay();
    const daysUntilNextMonday = dow === 0 ? 1 : 8 - dow;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nextMonday);
      d.setDate(nextMonday.getDate() + i);
      return d;
    });
  }

  // Le fasce orarie selezionabili, una ogni 30 minuti dalle 8 alle 21.
  buildTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Chiave che identifica univocamente uno slot, nella forma "data|ora".
  slotKey(day: Date, time: string): string {
    return `${this.formatDate(day)}|${time}`;
  }

  // Intestazione leggibile della settimana, tipo "14 aprile – 20 aprile 2026".
  getNextWeekLabel(days: Date[]): string {
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })}`;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(date: Date): number {
    return date.getDate();
  }

  isFullHour(slot: string): boolean {
    return slot.endsWith(':00');
  }

  // Dalla lista degli slot ricava i giorni distinti (azzerando l'ora) e li
  // mette in ordine cronologico: sono i giorni cliccabili in prenotazione.
  buildBookingDays(slots: ProfessionalSlot[]): Date[] {
    const uniqueTimestamps = new Set<number>();

    for (const s of slots) {
      const d = new Date(s.startTime);
      d.setHours(0, 0, 0, 0);
      uniqueTimestamps.add(d.getTime());
    }

    return Array.from(uniqueTimestamps)
      .map(ts => new Date(ts))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  // Tiene solo gli slot del giorno scelto e li ordina per orario.
  getSlotsForDay(slots: ProfessionalSlot[], day: Date): ProfessionalSlot[] {
    const dayTime = day.getTime();

    return slots
      .filter(s => {
        const d = new Date(s.startTime);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === dayTime;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getSlotTimeLabel(slot: ProfessionalSlot): string {
    const d = new Date(slot.startTime);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  // Quando il professionista conferma le fasce selezionate, qui trasformiamo le
  // chiavi "data|ora" nel formato che si aspetta il backend. Ogni slot dura
  // sempre 30 minuti, quindi l'orario di fine lo calcoliamo da quello di inizio.
  buildSlotPayloads(selectedKeys: Set<string>): SlotPayload[] {
    const pad = (n: number) => n.toString().padStart(2, '0');

    return Array.from(selectedKeys).map(key => {
      const [date, time] = key.split('|');
      const startStr = `${date}T${time}:00`;
      const startDate = new Date(startStr);
      const endDate = new Date(startDate.getTime() + 30 * 60000);

      const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

      return { startTime: startStr, endTime: endStr, isAvailable: true };
    });
  }
}
