import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class FooterComponent {
  year = new Date().getFullYear();
  private router = inject(Router);
  private doc = inject(DOCUMENT);

  scrollTo(sectionId: string): void {
    const onHome = this.router.url === '/' || this.router.url.startsWith('/#');
    if (onHome) {
      this.doc.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      this.router.navigate(['/'], { fragment: sectionId });
    }
  }
}
