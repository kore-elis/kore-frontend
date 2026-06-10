import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  @Input() title = 'Nessun risultato';
  @Input() description = '';
  @Input() icon = '';
}
