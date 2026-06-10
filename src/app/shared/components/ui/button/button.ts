import { Component, Input, Output, EventEmitter } from '@angular/core';


export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() loading = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() iconLeft?: string;
  @Input() iconRight?: string;
  @Input() ariaLabel?: string;
  @Output() clicked = new EventEmitter<MouseEvent>();

  get classes(): string {
    return [
      'btn',
      `btn--${this.variant}`,
      `btn--${this.size}`,
      this.loading ? 'btn--loading' : '',
    ].filter(Boolean).join(' ');
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
