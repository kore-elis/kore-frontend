import { Component, Input } from '@angular/core';


export type CardVariant = 'flat' | 'glass' | 'elevated' | 'interactive';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [],
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class CardComponent {
  @Input() variant: CardVariant = 'flat';
  @Input() padding: 'none' | 'sm' | 'md' | 'lg' = 'md';

  get classes(): string {
    return ['card', `card--${this.variant}`, `card--pad-${this.padding}`].join(' ');
  }
}
