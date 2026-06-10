import { Component, OnInit, OnDestroy, HostListener, Input } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() variant: 'landing' | 'auth' = 'landing';

  scrolled = false;
  menuOpen = false;

  private observer?: IntersectionObserver;

  private windowScrollFn?: () => void;

  ngOnInit(): void {
    const sentinel = document.getElementById('hero-sentinel');
    if (sentinel) {
      this.observer = new IntersectionObserver(
        ([entry]) => { this.scrolled = !entry.isIntersecting; },
        { threshold: 0 }
      );
      this.observer.observe(sentinel);
    } else {
      this.windowScrollFn = () => { this.scrolled = window.scrollY > 64; };
      window.addEventListener('scroll', this.windowScrollFn, { passive: true });
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.windowScrollFn) {
      window.removeEventListener('scroll', this.windowScrollFn);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen = false;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
