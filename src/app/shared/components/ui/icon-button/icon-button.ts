import { Component, Input, Output, EventEmitter } from '@angular/core';


export type IconButtonVariant = 'ghost' | 'subtle' | 'solid';
export type IconButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [],
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.css',
})
export class IconButtonComponent {
  @Input() variant: IconButtonVariant = 'ghost';
  @Input() size: IconButtonSize = 'md';
  @Input() disabled = false;
  @Input() ariaLabel = '';
  @Input() type: 'button' | 'submit' = 'button';
  @Output() clicked = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled) this.clicked.emit(event);
  }
}
