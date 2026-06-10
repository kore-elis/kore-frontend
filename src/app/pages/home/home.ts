import { Component, inject, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, NgZone, ViewChild } from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PlanService } from '../../core/services/plan.service';
import { JobApplicationService } from '../../core/services/job-application.service';
import { Plan } from '../../shared/models/dashboard.model';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterModule, ReactiveFormsModule],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

    // Piani (dal backend)
    semestralePlans: Plan[] = [];
    annualePlans: Plan[] = [];
    isAnnual = false;

    // Introduzione
    showIntro = true;
    introExiting = false;

    // Navigazione
    isMobileMenuOpen = false;
    navScrolled = false;
    navAtDark = true;

    // Parallasse della sezione hero + dissolvenza allo scroll
    heroFade = 1;
    heroTranslateY = 0;

    // Manifesto sticky
    manifestoProgress = 0;

    // How It Works sticky
    hiwActiveIdx = 0;

    // App Showcase sticky
    appActiveIdx = 0;

    // FAQ
    openFaqIndex = -1;

    // Job application
    applicationForm!: FormGroup;
    selectedFile: File | null = null;
    fileError = '';
    isSubmitting = false;
    submitSuccess = false;
    submitError = '';
    isDragging = false;

    readonly hiwScenes = [
        {
            num: '01', label: 'Inizio', title: 'Analisi e pianificazione',
            desc: 'Il tuo PT e il tuo nutrizionista analizzano il punto di partenza e definiscono insieme gli obiettivi a breve e lungo termine.',
            features: ['Anamnesi completa e test di partenza', 'Obiettivi misurabili a 90 giorni', 'Setup operativo del tuo team in 48 ore'],
            glyphLabel: 'Pianificazione', meta: 'Setup iniziale in 48 ore'
        },
        {
            num: '02', label: 'Costanza', title: 'Azione e progresso',
            desc: 'Sessioni 1-to-1 con i tuoi professionisti, online o in presenza. Gli stessi che ti conoscono, ogni settimana.',
            features: ['Sessioni 1-to-1 in app o di persona', 'Scheda aggiornata ogni settimana', 'Chat diretta con il tuo team'],
            glyphLabel: 'In sessione', meta: 'Sessioni 1-to-1 settimanali'
        },
        {
            num: '03', label: 'Risultato', title: 'Feedback continuo',
            desc: 'Carichi, alimentazione e protocolli aggiornati sui tuoi progressi reali — non su un programma generico.',
            features: ["Report mensile dei progressi reali", "Aggiustamenti sul carico e sull'alimentazione", 'Risultati che durano oltre il piano'],
            glyphLabel: 'Risultati', meta: 'Update settimanale dei protocolli'
        }
    ];

    readonly appFeatures = [
        { eyebrow: 'Calendario', title: 'Prenota le sessioni in due tap', desc: 'Calendario condiviso con il tuo PT e nutrizionista. Cambi orario quando vuoi, senza chiamate o messaggi.' },
        { eyebrow: 'Chat', title: 'Il tuo team a portata di messaggio', desc: "Comunicazione diretta dentro l'app. Niente WhatsApp, niente strumenti esterni, niente messaggi persi." },
        { eyebrow: 'Progressi', title: 'I tuoi numeri, sempre con te', desc: 'Crediti rimanenti, scheda allenamento, alimentazione. Tutto sincronizzato e aggiornato in tempo reale.' }
    ];

    readonly testimonials = [
        { stars: 5, text: 'Il mio PT mi conosce davvero. Non sono un numero su una lista — è la prima volta che mi capita.', name: 'Marco F.', meta: 'Cliente da 8 mesi' },
        { stars: 5, text: 'La differenza si è vista già nel primo mese. Programma su misura, niente cose copiate da internet.', name: 'Sofia R.', meta: 'Cliente da 4 mesi' },
        { stars: 5, text: 'Finalmente un posto dove PT e nutrizionista parlano davvero tra loro. Cambia tutto.', name: 'Alessandro M.', meta: 'Cliente da 1 anno' },
        { stars: 5, text: "L'app è super semplice. E la polizza è davvero inclusa — verificato dopo una distorsione.", name: 'Giulia T.', meta: 'Cliente da 6 mesi' },
        { stars: 5, text: 'Risultati reali, accompagnamento vero. Non ho mai trovato un servizio così completo.', name: 'Luca B.', meta: 'Cliente da 7 mesi' },
        { stars: 5, text: 'Nessun trucco, nessuna promessa esagerata. Solo professionisti veri che lavorano per te.', name: 'Elena C.', meta: 'Cliente da 3 mesi' }
    ];

    readonly faqItems = [
        { q: 'Posso scegliere il mio Personal Trainer e Nutrizionista?', a: 'Sì, durante la registrazione scegli tu i tuoi professionisti tra quelli certificati disponibili. Li avrai sempre tu, per tutto il percorso.' },
        { q: 'Le sessioni sono online o in presenza?', a: 'Entrambe. Ogni professionista offre sessioni online e, a seconda della disponibilità e della città, anche in presenza.' },
        { q: 'La polizza assicurativa è davvero inclusa?', a: 'Sì, ogni piano include una polizza sportiva attiva dal primo giorno. Zero costi extra, zero burocrazia.' },
        { q: 'Come funzionano i crediti sessione?', a: 'I crediti si rinnovano ogni mese. Se un mese non li utilizzi tutti, rimangono disponibili fino alla scadenza del tuo abbonamento.' },
        { q: 'Posso cambiare professionista?', a: 'Sì, se per qualsiasi motivo vuoi cambiare il tuo PT o Nutrizionista, contatta il nostro team e gestiamo noi il trasferimento senza costi aggiuntivi.' },
        { q: "Posso disdire l'abbonamento?", a: "Il contratto ha la durata del piano scelto (6 o 12 mesi). In caso di necessità documentata, contattaci e valutiamo insieme le opzioni disponibili." }
    ];

    readonly planFeats = ['Scheda allenamento mensile', 'Piano alimentare personalizzato', 'Chat con i professionisti', 'Prenotazione sessioni in app', 'Polizza assicurativa sportiva'];

    readonly bentoOffsets = [-22, 14, -10, 18, -16, 12, -8];

    @ViewChild('manifestoSection') manifestoSectionRef!: ElementRef;
    @ViewChild('bentoSection') bentoSectionRef!: ElementRef;
    @ViewChild('carouselVideo') carouselVideoRef?: ElementRef<HTMLVideoElement>;

    // Video Carousel
    carouselVideos = [
        { key: 'dashboard',   title: 'Dashboard',    src: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647112/dashboard_pc_vskyub.mp4',    mobileSrc: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647112/dashboard_tel_pqkbjo.mp4' },
        { key: 'calendario',  title: 'Calendario',   src: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647111/calendario_pc_doqize.mp4',   mobileSrc: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647456/calendario_tel_uahpjk.mp4' },
        { key: 'prenotazione',title: 'Prenotazione', src: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647113/prenotazione_pc_tpmicq.mp4', mobileSrc: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647113/prenotazione_tel_eaq5af.mp4' },
        { key: 'chat',        title: 'Chat',         src: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647112/chat_pc_q37s5x.mp4',         mobileSrc: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647112/chat_tel_soiwrr.mp4' },
        { key: 'scheda',      title: 'Scheda',       src: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647291/servizi_pc_ofvr02.mp4',       mobileSrc: 'https://res.cloudinary.com/drfqts2rl/video/upload/v1780647114/servizi_tel_uj3eny.mp4' }
    ];
    currentCarouselVideoIndex = 0;
    videoProgress = 0;
    isCarouselPlaying = false;
    private hasCarouselStarted = false;
    private carouselSectionObserver!: IntersectionObserver;
    private readonly maxCarouselAutoplayRetries = 3;

    private authService = inject(AuthService);
    private planService = inject(PlanService);
    private jobApplicationService = inject(JobApplicationService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private fb = inject(FormBuilder);
    private el = inject(ElementRef);
    private zone = inject(NgZone);

    private revealObserver!: IntersectionObserver;
    private counterObserver!: IntersectionObserver;
    private scrollListener!: () => void;
    private introTimer1?: ReturnType<typeof setTimeout>;
    private introTimer2?: ReturnType<typeof setTimeout>;
    private scrollRaf?: number;
    private mouseRaf?: number;
    private mouseListenerFn?: (e: MouseEvent) => void;
    private hiwInterval?: ReturnType<typeof setInterval>;
    private appInterval?: ReturnType<typeof setInterval>;
    private hiwObserver?: IntersectionObserver;
    private appObserver?: IntersectionObserver;

    get displayedPlans(): Plan[] {
        return this.isAnnual ? this.annualePlans : this.semestralePlans;
    }

    get doubledTestimonials() {
        return [...this.testimonials, ...this.testimonials];
    }

    isFeaturedPlan(plan: Plan): boolean {
        return plan.monthlyCreditsPT >= 2;
    }

    get manifestoScale(): number {
        return 0.92 + this.manifestoProgress * 0.12;
    }

    get manifestoOpacity(): number {
        return 0.85 + this.manifestoProgress * 0.15;
    }

    starsArray(n: number): number[] {
        return Array(n).fill(0);
    }

    toggleBilling(isAnnual: boolean): void {
        this.isAnnual = isAnnual;
        this.cdr.detectChanges();
        setTimeout(() => this.observeNewRevealElements(), 0);
    }

    toggleMobileMenu(): void {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
    }

    closeMobileMenu(): void {
        this.isMobileMenuOpen = false;
    }

    toggleFaq(index: number): void {
        this.openFaqIndex = this.openFaqIndex === index ? -1 : index;
    }

    setHiwIdx(i: number): void {
        this.hiwActiveIdx = i;
        clearInterval(this.hiwInterval);
        this.startHiwAutoAdvance();
    }

    setAppIdx(i: number): void {
        this.appActiveIdx = i;
        clearInterval(this.appInterval);
        this.startAppAutoAdvance();
    }

    private startHiwAutoAdvance(): void {
        this.hiwInterval = setInterval(() => {
            this.zone.run(() => {
                this.hiwActiveIdx = (this.hiwActiveIdx + 1) % this.hiwScenes.length;
            });
        }, 3000);
    }

    private startAppAutoAdvance(): void {
        this.appInterval = setInterval(() => {
            this.zone.run(() => {
                this.appActiveIdx = (this.appActiveIdx + 1) % this.appFeatures.length;
            });
        }, 3000);
    }

    skipIntro(): void {
        document.body.style.overflow = '';
        clearTimeout(this.introTimer1);
        clearTimeout(this.introTimer2);
        this.showIntro = false;
    }

    ngOnInit(): void {
        document.body.style.overflow = 'hidden';

        this.introTimer1 = setTimeout(() => {
            this.introExiting = true;
            this.cdr.detectChanges();
        }, 3000);
        this.introTimer2 = setTimeout(() => {
            document.body.style.overflow = '';
            this.showIntro = false;
            this.cdr.detectChanges();
        }, 3750);

        this.applicationForm = this.fb.group({
            firstName: ['', Validators.required],
            lastName: [''],
            email: ['', [Validators.required, Validators.email]],
            role: ['', Validators.required],
            message: ['', Validators.required]
        });

        this.planService.getPlans().subscribe({
            next: (res) => {
                if (res && res.length > 0) {
                    this.semestralePlans = res.filter((p) => p.duration === 'SEMESTRALE');
                    this.annualePlans = res.filter((p) => p.duration === 'ANNUALE');
                }
                this.cdr.detectChanges();
                setTimeout(() => this.observeNewRevealElements(), 0);
            },
            error: () => {
                this.semestralePlans = [];
                this.annualePlans = [];
            }
        });
    }

    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(() => {
            this.initScrollReveal();
            this.initCounterAnimation();
            this.initScrollEffects();
            this.initParallax();
            this.initCarouselObservers();
            this.initCarouselSectionObserver();
        });
    }

    ngOnDestroy(): void {
        if (this.revealObserver) this.revealObserver.disconnect();
        if (this.counterObserver) this.counterObserver.disconnect();
        if (this.carouselSectionObserver) this.carouselSectionObserver.disconnect();
        this.hiwObserver?.disconnect();
        this.appObserver?.disconnect();
        clearTimeout(this.introTimer1);
        clearTimeout(this.introTimer2);
        cancelAnimationFrame(this.scrollRaf!);
        cancelAnimationFrame(this.mouseRaf!);
        clearInterval(this.hiwInterval);
        clearInterval(this.appInterval);
        document.body.style.overflow = '';

        const container = this.el.nativeElement.querySelector('.home-page');
        if (container && this.scrollListener) {
            container.removeEventListener('scroll', this.scrollListener);
        }
        if (this.mouseListenerFn) {
            document.removeEventListener('mousemove', this.mouseListenerFn);
        }
    }

    private initParallax(): void {
        const host = this.el.nativeElement;
        this.mouseListenerFn = (e: MouseEvent) => {
            cancelAnimationFrame(this.mouseRaf!);
            this.mouseRaf = requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth - 0.5) * 28;
                const y = (e.clientY / window.innerHeight - 0.5) * 28;
                const heroGrid    = host.querySelector('.hero__grid')      as HTMLElement | null;
                const heroOrbGold = host.querySelector('.hero__orb--gold') as HTMLElement | null;
                const heroOrbNavy = host.querySelector('.hero__orb--navy') as HTMLElement | null;
                const heroGhost   = host.querySelector('.hero__ghost')     as HTMLElement | null;
                if (heroGrid)    heroGrid.style.transform    = `translate(${x * 0.3}px,${y * 0.3}px)`;
                if (heroOrbGold) heroOrbGold.style.transform = `translate(${x * 2.2}px,${y * 2.2}px)`;
                if (heroOrbNavy) heroOrbNavy.style.transform = `translate(${x * -1.4}px,${y * -1.4}px)`;
                if (heroGhost)   heroGhost.style.transform   = `translate(${x * 0.6}px,${y * 0.6}px)`;
            });
        };
        document.addEventListener('mousemove', this.mouseListenerFn, { passive: true });
    }

    private initCarouselObservers(): void {
        const opts: IntersectionObserverInit = { threshold: 0.25 };

        const hiwSection = this.el.nativeElement.querySelector('.sticky-scene');
        if (hiwSection) {
            this.hiwObserver = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    if (!this.hiwInterval) this.startHiwAutoAdvance();
                } else {
                    clearInterval(this.hiwInterval);
                    this.hiwInterval = undefined;
                }
            }, opts);
            this.hiwObserver.observe(hiwSection);
        }

        const appSection = this.el.nativeElement.querySelector('.experience-carousel-section');
        if (appSection) {
            this.appObserver = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    if (!this.appInterval) this.startAppAutoAdvance();
                } else {
                    clearInterval(this.appInterval);
                    this.appInterval = undefined;
                }
            }, opts);
            this.appObserver.observe(appSection);
        }
    }

    scrollToSection(id: string): void {
        const section   = this.el.nativeElement.querySelector(`#${id}`) as HTMLElement | null;
        const container = this.el.nativeElement.querySelector('.home-page') as HTMLElement | null;
        if (section && container) {
            const top = section.getBoundingClientRect().top + container.scrollTop - 68;
            container.scrollTo({ top, behavior: 'smooth' });
        }
    }

    private getStickyProgress(el: HTMLElement): number {
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const scrolled = -rect.top;
        return Math.max(0, Math.min(1, scrolled / total));
    }

    private initScrollReveal(): void {
        this.revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('revealed');
                    this.revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        this.observeNewRevealElements();
    }

    private observeNewRevealElements(): void {
        if (!this.revealObserver || !this.el?.nativeElement) return;
        const elements = this.el.nativeElement.querySelectorAll('[data-reveal]:not(.revealed)');
        elements.forEach((el: HTMLElement) => this.revealObserver.observe(el));
    }

    private initCounterAnimation(): void {
        this.counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target as HTMLElement);
                    this.counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        const counters = this.el.nativeElement.querySelectorAll('[data-counter]');
        counters.forEach((el: HTMLElement) => this.counterObserver.observe(el));
    }

    private animateCounter(el: HTMLElement): void {
        const target = parseInt(el.getAttribute('data-counter') || '0', 10);
        const suffix = el.getAttribute('data-counter-suffix') || '';
        const duration = 1800;
        const startTime = performance.now();
        const step = (now: number) => {
            const t = Math.min((now - startTime) / duration, 1);
            const v = Math.floor((1 - Math.pow(1 - t, 3)) * target);
            el.textContent = v + suffix;
            if (t < 1) requestAnimationFrame(step);
            else el.textContent = target + suffix;
        };
        requestAnimationFrame(step);
    }

    private initScrollEffects(): void {
        const container = this.el.nativeElement.querySelector('.home-page');
        if (!container) return;

        this.scrollListener = () => {
            cancelAnimationFrame(this.scrollRaf!);
            this.scrollRaf = requestAnimationFrame(() => {
                const scrollTop = container.scrollTop;
                const scrolled = scrollTop > 20;

                // Manifesto progress
                let manifestoP = 0;
                if (this.manifestoSectionRef?.nativeElement) {
                    manifestoP = this.getStickyProgress(this.manifestoSectionRef.nativeElement);
                }

                // Bento parallax
                const bentoCells = this.el.nativeElement.querySelectorAll('.bento-cell');
                const bentoSec = this.bentoSectionRef?.nativeElement;
                if (bentoSec && bentoCells.length > 0) {
                    const rect = bentoSec.getBoundingClientRect();
                    const vh = window.innerHeight;
                    const p = Math.max(-0.3, Math.min(1.3, 1 - (rect.top + rect.height * 0.5) / (vh * 0.9)));
                    bentoCells.forEach((el: HTMLElement, i: number) => {
                        const off = this.bentoOffsets[i % this.bentoOffsets.length] * p;
                        el.style.transform = `translateY(${off}px)`;
                    });
                }

                this.zone.run(() => {
                    this.navScrolled = scrolled;
                    this.manifestoProgress = manifestoP;
                });
            });
        };

        container.addEventListener('scroll', this.scrollListener, { passive: true });
        this.scrollListener();
    }

    goToRegister(planId?: number): void {
        if (planId) {
            this.router.navigate(['/register'], { queryParams: { plan: planId } });
        } else {
            this.router.navigate(['/register']);
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.validateAndSetFile(input.files[0]);
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            this.validateAndSetFile(event.dataTransfer.files[0]);
        }
    }

    private validateAndSetFile(file: File): void {
        this.fileError = '';
        if (file.type !== 'application/pdf') {
            this.fileError = 'Il file deve essere in formato PDF.';
            this.selectedFile = null;
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.fileError = 'Il file non può superare i 10MB.';
            this.selectedFile = null;
            return;
        }
        this.selectedFile = file;
    }

    // Video Carousel methods

    getVideoSrc(video: { src: string; mobileSrc: string }): string {
        return window.innerWidth < 768 ? video.mobileSrc : video.src;
    }

    nextCarouselVideo(): void {
        this.currentCarouselVideoIndex = (this.currentCarouselVideoIndex + 1) % this.carouselVideos.length;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    previousCarouselVideo(): void {
        this.currentCarouselVideoIndex = (this.currentCarouselVideoIndex - 1 + this.carouselVideos.length) % this.carouselVideos.length;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    selectCarouselVideo(index: number): void {
        if (index < 0 || index >= this.carouselVideos.length || index === this.currentCarouselVideoIndex) return;
        this.currentCarouselVideoIndex = index;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    onCarouselVideoEnded(): void {
        this.nextCarouselVideo();
    }

    onCarouselPlayClick(): void {
        this.isCarouselPlaying = true;
        this.playCurrentCarouselVideo();
    }

    onVideoTimeUpdate(): void {
        const videoEl = this.carouselVideoRef?.nativeElement;
        if (!videoEl || !videoEl.duration) return;
        this.videoProgress = (videoEl.currentTime / videoEl.duration) * 100;
    }

    getCardTransform(index: number): string {
        const diff = index - this.currentCarouselVideoIndex;
        return `translateX(${diff * 8}px)`;
    }

    getCardOpacity(index: number): number {
        const dist = Math.abs(index - this.currentCarouselVideoIndex);
        return dist === 0 ? 1 : Math.max(0.45, 1 - dist * 0.2);
    }

    private initCarouselSectionObserver(): void {
        const section = this.el.nativeElement.querySelector('.experience-carousel-section');
        if (!section) return;

        this.carouselSectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.hasCarouselStarted) {
                    this.hasCarouselStarted = true;
                    this.zone.run(() => this.playCurrentCarouselVideo());
                    this.carouselSectionObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        this.carouselSectionObserver.observe(section);
    }

    private playCurrentCarouselVideo(retryCount: number = 0): void {
        this.cdr.detectChanges();
        queueMicrotask(() => {
            const videoEl = this.carouselVideoRef?.nativeElement;
            if (!videoEl) return;
            videoEl.muted = true;
            videoEl.defaultMuted = true;
            videoEl.playsInline = true;
            videoEl.load();
            videoEl.play().then(() => {
                this.isCarouselPlaying = true;
                this.cdr.detectChanges();
            }).catch(() => {
                if (retryCount < this.maxCarouselAutoplayRetries) {
                    setTimeout(() => this.playCurrentCarouselVideo(retryCount + 1), 180);
                }
            });
        });
    }

    submitApplication(): void {
        if (this.applicationForm.invalid) {
            this.applicationForm.markAllAsTouched();
            return;
        }
        this.isSubmitting = true;
        this.submitError = '';

        const formData = new FormData();
        const jsonBlob = new Blob([JSON.stringify(this.applicationForm.value)], { type: 'application/json' });
        formData.append('data', jsonBlob);
        if (this.selectedFile) {
            formData.append('cv', this.selectedFile);
        }

        this.jobApplicationService.submit(formData).subscribe({
            next: () => {
                this.isSubmitting = false;
                this.submitSuccess = true;
                this.cdr.detectChanges();
            },
            error: (err: HttpErrorResponse) => {
                this.isSubmitting = false;
                this.submitError = err.error?.message || 'Si è verificato un errore. Riprova più tardi.';
                this.cdr.detectChanges();
            }
        });
    }
}
