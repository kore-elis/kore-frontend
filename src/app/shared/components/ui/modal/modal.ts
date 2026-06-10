import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';


@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent implements OnChanges, AfterViewInit {
  @Input() open = false;
  @Input() title = '';
  @Input() closeOnBackdrop = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;
  @ViewChild('backdrop') backdropRef?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.syncInert();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncInert();
      if (this.open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  private syncInert(): void {
    if (!this.panelRef) return;
    if (this.open) {
      this.panelRef.nativeElement.removeAttribute('inert');
    } else {
      this.panelRef.nativeElement.setAttribute('inert', '');
    }
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop) this.closeModal.emit();
  }

  onClose(): void {
    this.closeModal.emit();
  }
}
