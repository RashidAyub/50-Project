/**
 * AETHERIA — Cinematic Digital Experience & Spatial Design Studio
 * Core Application Engine: GSAP 3 + ScrollTrigger + Lenis + Web Audio API
 */

(function () {
  'use strict';

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     1. LENIS SMOOTH SCROLL INITIALIZATION
     ========================================================================== */
  let lenis = null;

  function initLenis() {
    if (typeof Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
    });

    // Synchronize Lenis with GSAP ScrollTrigger
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });

      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }

    // Anchor Link Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          playSound('click');
          if (lenis) {
            lenis.scrollTo(targetEl, { offset: -60, duration: 1.4 });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
          // Close mobile menu if open
          closeMobileMenu();
        }
      });
    });
  }

  /* ==========================================================================
     2. WEB AUDIO API SYNTHESIZER (MICRO INTERACTION AUDIO)
     ========================================================================== */
  let audioCtx = null;
  let isSoundEnabled = true;

  function initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('AudioContext not supported:', e);
    }
  }

  function playSound(type = 'hover') {
    if (!isSoundEnabled) return;
    if (!audioCtx) {
      initAudio();
    }
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'modal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.2);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1020, now);
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  }

  // Audio Toggle UI
  function setupAudioToggle() {
    const soundPill = document.getElementById('soundPill');
    if (!soundPill) return;

    soundPill.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      const soundText = soundPill.querySelector('.sound-text');
      if (isSoundEnabled) {
        if (soundText) soundText.textContent = 'AUDIO ACTIVE';
        soundPill.style.opacity = '1';
        playSound('click');
      } else {
        if (soundText) soundText.textContent = 'AUDIO MUTED';
        soundPill.style.opacity = '0.5';
      }
    });
  }

  /* ==========================================================================
     3. CUSTOM CURSOR ENGINE & MAGNETIC PHYSICS
     ========================================================================== */
  const cursor = {
    el: document.getElementById('customCursor'),
    dot: document.querySelector('.cursor-dot'),
    ring: document.querySelector('.cursor-ring'),
    label: document.getElementById('cursorLabel'),
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    isHovering: false,
    hasLabel: false,
  };

  function initCustomCursor() {
    if (!cursor.el || !cursor.dot || !cursor.ring) return;

    // Track Mouse
    window.addEventListener('mousemove', (e) => {
      cursor.targetX = e.clientX;
      cursor.targetY = e.clientY;
    });

    // Cursor Smooth Lag loop with GSAP ticker
    gsap.ticker.add(() => {
      cursor.x += (cursor.targetX - cursor.x) * 0.2;
      cursor.y += (cursor.targetY - cursor.y) * 0.15;

      gsap.set(cursor.dot, {
        x: cursor.targetX,
        y: cursor.targetY,
      });

      gsap.set(cursor.ring, {
        x: cursor.x,
        y: cursor.y,
      });
    });

    // Window Enter / Leave
    document.addEventListener('mouseleave', () => {
      gsap.to([cursor.dot, cursor.ring], { opacity: 0, duration: 0.2 });
    });
    document.addEventListener('mouseenter', () => {
      gsap.to([cursor.dot, cursor.ring], { opacity: 1, duration: 0.2 });
    });

    // Mouse Down / Up squeeze
    window.addEventListener('mousedown', () => {
      cursor.el.classList.add('is-active');
    });
    window.addEventListener('mouseup', () => {
      cursor.el.classList.remove('is-active');
    });

    // Attach Hover & Label triggers
    setupCursorInteractions();
  }

  function setupCursorInteractions() {
    const interactiveElements = document.querySelectorAll(
      'a, button, [data-cursor], .work-card, .service-row, .stat-card, input, select, textarea'
    );

    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        cursor.el.classList.add('is-hovering');
        const customText = el.getAttribute('data-cursor');
        if (customText && customText !== 'hover') {
          cursor.el.classList.add('has-label');
          if (cursor.label) cursor.label.textContent = customText;
        }
        playSound('hover');
      });

      el.addEventListener('mouseleave', () => {
        cursor.el.classList.remove('is-hovering', 'has-label');
        if (cursor.label) cursor.label.textContent = '';
      });
    });

    // Magnetic Button Effect
    const magneticTargets = document.querySelectorAll('.magnetic-target, .btn-magnetic');
    magneticTargets.forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) * 0.35;
        const deltaY = (e.clientY - centerY) * 0.35;

        gsap.to(btn, {
          x: deltaX,
          y: deltaY,
          duration: 0.3,
          ease: 'power2.out',
        });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.4)',
        });
      });
    });
  }

  /* ==========================================================================
     4. PRELOADER & HERO REVEAL TIMELINE
     ========================================================================== */
  function initPreloader() {
    const preloader = document.getElementById('preloader');
    const counterEl = document.getElementById('preloaderCounter');
    const barEl = document.getElementById('preloaderBar');
    const sparkEl = document.getElementById('preloaderSpark');
    const statusEl = document.getElementById('statusText');
    const svgCircleFill = document.querySelector('.svg-circle-fill');

    if (!preloader || !counterEl) {
      document.body.classList.remove('is-loading');
      initHeroAnimations();
      return;
    }

    const statuses = [
      'CALIBRATING SPATIAL ENGINE',
      'COMPUTING SHADER MATRICES',
      'SYNCHRONIZING GSAP PIPELINES',
      'INITIALIZING NEURAL INTERFACE',
      'SYSTEM READY // ENTERING MATRIX',
    ];

    const progressObj = { value: 0 };
    const totalDuration = prefersReducedMotion ? 0.2 : 2.0;

    gsap.to(progressObj, {
      value: 100,
      duration: totalDuration,
      ease: 'power3.inOut',
      onUpdate: () => {
        const val = Math.round(progressObj.value);
        counterEl.textContent = val.toString().padStart(3, '0');

        if (barEl) barEl.style.width = `${val}%`;
        if (sparkEl) sparkEl.style.left = `${val}%`;

        if (svgCircleFill) {
          const circumference = 283;
          const offset = circumference - (val / 100) * circumference;
          svgCircleFill.style.strokeDashoffset = offset;
        }

        // Update status text based on percentage
        if (statusEl) {
          const step = Math.min(Math.floor((val / 100) * statuses.length), statuses.length - 1);
          statusEl.textContent = statuses[step];
        }
      },
      onComplete: () => {
        completePreloaderSequence();
      },
    });
  }

  function completePreloaderSequence() {
    const preloader = document.getElementById('preloader');
    const curtain = document.getElementById('preloaderCurtain');

    const exitTl = gsap.timeline({
      onComplete: () => {
        if (preloader) preloader.style.display = 'none';
        document.body.classList.remove('is-loading');
        // Trigger page entrance
        initHeroAnimations();
        initScrollAnimations();
      },
    });

    exitTl
      .to('.preloader-content', {
        y: -40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.in',
      })
      .to(
        curtain,
        {
          scaleY: 0,
          transformOrigin: 'top center',
          duration: 0.8,
          ease: 'expo.inOut',
        },
        '-=0.2'
      )
      .to(
        preloader,
        {
          opacity: 0,
          duration: 0.4,
          ease: 'power2.out',
        },
        '-=0.3'
      );
  }

  /* ==========================================================================
     5. HERO ENTRANCE & 3D TILT PHYSICS
     ========================================================================== */
  function initHeroAnimations() {
    if (prefersReducedMotion) return;

    const heroTl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    heroTl
      .from('.site-header', {
        y: -50,
        opacity: 0,
        duration: 1.2,
      })
      .from(
        '.hero-eyebrow',
        {
          y: 20,
          opacity: 0,
          duration: 0.8,
        },
        '-=0.8'
      )
      .from(
        '.hero-headline .reveal-text',
        {
          yPercent: 120,
          opacity: 0,
          stagger: 0.08,
          duration: 1.2,
          ease: 'power4.out',
        },
        '-=0.6'
      )
      .from(
        '.hero-description',
        {
          y: 30,
          opacity: 0,
          duration: 1,
        },
        '-=0.8'
      )
      .from(
        '.hero-cta-group .btn',
        {
          y: 20,
          opacity: 0,
          stagger: 0.15,
          duration: 0.9,
        },
        '-=0.8'
      )
      .from(
        '#heroVisualWrap',
        {
          scale: 0.9,
          opacity: 0,
          duration: 1.4,
          ease: 'expo.out',
        },
        '-=1.1'
      )
      .from(
        '.hud-badge',
        {
          scale: 0.7,
          opacity: 0,
          stagger: 0.2,
          duration: 1,
          ease: 'back.out(1.7)',
        },
        '-=0.8'
      )
      .from(
        '.hero-scroll-pill',
        {
          opacity: 0,
          y: 20,
          duration: 0.8,
        },
        '-=0.5'
      );

    // Setup 3D Tilt for Hero Card and other tilt elements
    init3DTilt();
  }

  function init3DTilt() {
    if (prefersReducedMotion || window.innerWidth < 992) return;

    const tiltContainers = document.querySelectorAll('[data-tilt-container], [data-tilt-card]');

    tiltContainers.forEach((container) => {
      const target = container.querySelector('[data-tilt-target]') || container;

      container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        gsap.to(target, {
          rotateX: rotateX,
          rotateY: rotateY,
          transformPerspective: 1000,
          duration: 0.4,
          ease: 'power2.out',
        });
      });

      container.addEventListener('mouseleave', () => {
        gsap.to(target, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.8,
          ease: 'elastic.out(1, 0.4)',
        });
      });
    });
  }

  /* ==========================================================================
     6. SCROLLTRIGGER ANIMATIONS & PINNED SECTIONS
     ========================================================================== */
  function initScrollAnimations() {
    if (typeof ScrollTrigger === 'undefined') return;

    // Header Blur and Scroll Class
    ScrollTrigger.create({
      start: 'top -80',
      end: 99999,
      toggleClass: {
        className: 'is-scrolled',
        targets: '#siteHeader',
      },
    });

    // 1. Scrub Text Transformation (#about section)
    const scrubTitle = document.getElementById('scrubTitle');
    if (scrubTitle) {
      const scrubWords = scrubTitle.querySelectorAll('.scrub-word');
      gsap.fromTo(
        scrubWords,
        {
          opacity: 0.2,
          filter: 'blur(4px)',
          y: 10,
        },
        {
          opacity: 1,
          filter: 'blur(0px)',
          y: 0,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#transformTextWrapper',
            start: 'top 75%',
            end: 'bottom 40%',
            scrub: 0.8,
          },
        }
      );
    }

    // 2. Horizontal Scroll Portfolio Showcase (#works)
    const horizWrapper = document.getElementById('horizontalPinWrap');
    const horizCards = document.getElementById('horizontalCards');
    const horizProgress = document.getElementById('horizProgress');

    if (horizWrapper && horizCards) {
      const getScrollAmount = () => {
        return -(horizCards.scrollWidth - window.innerWidth + 120);
      };

      const horizTween = gsap.to(horizCards, {
        x: getScrollAmount,
        ease: 'none',
        scrollTrigger: {
          trigger: '#works',
          pin: true,
          scrub: 1,
          start: 'top top',
          end: () => `+=${horizCards.scrollWidth}`,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (horizProgress) {
              horizProgress.style.width = `${self.progress * 100}%`;
            }
          },
        },
      });

      // Hover Card Zoom
      document.querySelectorAll('.work-card').forEach((card) => {
        card.addEventListener('mouseenter', () => playSound('tick'));
      });
    }

    // 3. Pinned Process & Protocol Timeline (#process)
    initProcessTimeline();

    // 4. Numbers & Metrics Counter
    initMetricsCounter();

    // 5. General Fade Up Elements
    document.querySelectorAll('[data-fade-up]').forEach((el) => {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });
    });

    // 6. Image Reveal Zoom Effect
    document.querySelectorAll('[data-reveal-image]').forEach((imgBox) => {
      const img = imgBox.querySelector('img');
      if (img) {
        gsap.fromTo(
          img,
          { scale: 1.25 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: imgBox,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          }
        );
      }
    });
  }

  /* ==========================================================================
     7. PINNED PROCESS TIMELINE INTERACTIVITY
     ========================================================================== */
  function initProcessTimeline() {
    const stepNumDisplay = document.getElementById('activeStepNum');
    const stepTagDisplay = document.getElementById('activeStepTag');
    const timelineFill = document.getElementById('stepTimelineFill');
    const stepPills = document.querySelectorAll('.step-pill');
    const storyCards = document.querySelectorAll('.story-card');

    if (!storyCards.length) return;

    const phaseNames = [
      'PHASE 01 : DECONSTRUCTION & BLUEPRINT',
      'PHASE 02 : KINETIC PHYSICS & CHOREOGRAPHY',
      'PHASE 03 : SHADER SCULPTING & WEBGL',
      'PHASE 04 : GLOBAL SYNCHRONIZATION',
    ];

    storyCards.forEach((card, index) => {
      ScrollTrigger.create({
        trigger: card,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => updateActiveStep(index),
        onEnterBack: () => updateActiveStep(index),
      });
    });

    function updateActiveStep(idx) {
      if (stepNumDisplay) {
        stepNumDisplay.textContent = `0${idx + 1}`;
      }
      if (stepTagDisplay) {
        stepTagDisplay.textContent = phaseNames[idx] || `PHASE 0${idx + 1}`;
      }
      if (timelineFill) {
        timelineFill.style.width = `${((idx + 1) / storyCards.length) * 100}%`;
      }
      stepPills.forEach((pill, i) => {
        pill.classList.toggle('active', i === idx);
      });
    }

    // Step Pill Click Smooth Scroll
    stepPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const targetIdx = parseInt(pill.getAttribute('data-step-target'), 10);
        if (!isNaN(targetIdx) && storyCards[targetIdx]) {
          playSound('click');
          if (lenis) {
            lenis.scrollTo(storyCards[targetIdx], { offset: -100, duration: 1.2 });
          } else {
            storyCards[targetIdx].scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /* ==========================================================================
     8. SERVICES FLOATING IMAGE PREVIEW (CURSOR FOLLOWER)
     ========================================================================== */
  function initServicesHoverPreview() {
    const floatingPreview = document.getElementById('serviceFloatingPreview');
    const previewImg = document.getElementById('servicePreviewImg');
    const serviceRows = document.querySelectorAll('.service-row');

    if (!floatingPreview || !previewImg || !serviceRows.length) return;

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    gsap.ticker.add(() => {
      currentX += (mouseX - currentX) * 0.15;
      currentY += (mouseY - currentY) * 0.15;

      floatingPreview.style.left = `${currentX}px`;
      floatingPreview.style.top = `${currentY}px`;
    });

    serviceRows.forEach((row) => {
      row.addEventListener('mouseenter', () => {
        const imgSrc = row.getAttribute('data-service-img');
        if (imgSrc) {
          previewImg.src = imgSrc;
          floatingPreview.classList.add('is-visible');
        }
        playSound('tick');
      });

      row.addEventListener('mouseleave', () => {
        floatingPreview.classList.remove('is-visible');
      });
    });
  }

  /* ==========================================================================
     9. METRICS / NUMBERS ANIMATED COUNTERS
     ========================================================================== */
  function initMetricsCounter() {
    const counterElements = document.querySelectorAll('.counter-num');

    counterElements.forEach((el) => {
      const target = parseFloat(el.getAttribute('data-target'));
      if (isNaN(target)) return;

      const isDecimal = target % 1 !== 0;

      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          const counterObj = { count: 0 };
          gsap.to(counterObj, {
            count: target,
            duration: 2,
            ease: 'power3.out',
            onUpdate: () => {
              if (isDecimal) {
                el.textContent = counterObj.count.toFixed(1);
              } else {
                el.textContent = Math.floor(counterObj.count);
              }
            },
          });
        },
      });
    });
  }

  /* ==========================================================================
     10. LIVE WORLD TIMEZONE CLOCKS
     ========================================================================== */
  function initLiveClocks() {
    const liveTimeHeader = document.getElementById('liveTime');
    const clockTyo = document.getElementById('clockTyo');
    const clockZur = document.getElementById('clockZur');
    const clockNyc = document.getElementById('clockNyc');

    function updateClocks() {
      const now = new Date();

      // Tokyo Time (JST, UTC+9)
      const tyoStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
      });
      if (liveTimeHeader) liveTimeHeader.textContent = `TYO ${tyoStr}`;
      if (clockTyo) clockTyo.textContent = `${tyoStr} JST`;

      // Zurich Time (CET, UTC+1 / UTC+2)
      const zurStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Europe/Zurich',
        hour: '2-digit',
        minute: '2-digit',
      });
      if (clockZur) clockZur.textContent = `${zurStr} CET`;

      // New York Time (EST, UTC-5 / UTC-4)
      const nycStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
      });
      if (clockNyc) clockNyc.textContent = `${nycStr} EST`;
    }

    updateClocks();
    setInterval(updateClocks, 1000);
  }

  /* ==========================================================================
     11. VIDEO SHOWCASE MODAL
     ========================================================================== */
  function initVideoModal() {
    const playBtn = document.getElementById('playReelBtn');
    const modal = document.getElementById('videoModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    const backdrop = document.getElementById('videoModalClose');

    if (!modal) return;

    function openModal() {
      modal.classList.add('is-active');
      modal.setAttribute('aria-hidden', 'false');
      playSound('modal');

      gsap.fromTo(
        '.video-modal-container',
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' }
      );
    }

    function closeModal() {
      gsap.to('.video-modal-container', {
        scale: 0.85,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          modal.classList.remove('is-active');
          modal.setAttribute('aria-hidden', 'true');
        },
      });
    }

    if (playBtn) playBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-active')) {
        closeModal();
      }
    });
  }

  /* ==========================================================================
     12. MOBILE NAVIGATION DRAWER
     ========================================================================== */
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  function initMobileMenu() {
    if (!mobileToggle || !mobileMenu) return;

    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('is-active');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    const backdrop = mobileMenu.querySelector('.mobile-menu-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeMobileMenu);
  }

  function openMobileMenu() {
    if (!mobileMenu || !mobileToggle) return;
    mobileToggle.classList.add('is-open');
    mobileMenu.classList.add('is-active');
    playSound('click');

    gsap.fromTo(
      '.mobile-item',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'expo.out' }
    );
  }

  function closeMobileMenu() {
    if (!mobileMenu || !mobileToggle) return;
    mobileToggle.classList.remove('is-open');
    mobileMenu.classList.remove('is-active');
  }

  /* ==========================================================================
     13. BACK TO TOP BUTTON
     ========================================================================== */
  function initBackToTop() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      playSound('click');
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.8 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  /* ==========================================================================
     14. INITIALIZE ALL MODULES ON DOM READY
     ========================================================================== */
  window.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initCustomCursor();
    setupAudioToggle();
    initLiveClocks();
    initVideoModal();
    initMobileMenu();
    initBackToTop();
    initServicesHoverPreview();

    // Launch Preloader which cascades into Hero and ScrollTriggers
    initPreloader();
  });
})();
