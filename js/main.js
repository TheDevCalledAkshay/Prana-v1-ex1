/*
 * PRANA — page behaviour.
 * Progressive enhancement: with no JS, no GSAP or no WebGL the site is fully visible and usable;
 * the intro and scroll animations are additions, never requirements.
 */
import { CONFIG } from './config.js';

const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = () => typeof window.gsap !== 'undefined';

/* ---------- nav ---------- */
function setupNav() {
  const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const setOpen = (open) => {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

/* ---------- animations ---------- */
function heroIn() {
  if (!hasGsap() || reduceMotion) return;
  gsap.from('[data-hero]', { y: 38, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.13, clearProps: 'transform,opacity' });
}

function scrollEffects() {
  if (!hasGsap() || !window.ScrollTrigger || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  const items = gsap.utils.toArray('[data-reveal]');
  gsap.set(items, { opacity: 0, y: 46 });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.15, ease: 'power3.out', stagger: 0.12, overwrite: true, clearProps: 'transform,opacity' })
  });

  // gentle depth on the hero image
  gsap.to('.arch img', { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__mark', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

/* ---------- intro orchestration ---------- */
function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
}

function endIntro() {
  root.classList.remove('intro-active');
  try { sessionStorage.setItem('prana-intro-seen', '1'); } catch (e) {}
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}

async function boot() {
  setupNav();

  if (!root.classList.contains('intro-active')) {
    heroIn();
    scrollEffects();
    return;
  }

  try {
    if (!hasGsap()) throw new Error('GSAP did not load');
    const { prepare } = await import('./intro.js');
    const intro = await withTimeout(prepare(), CONFIG.loadTimeoutMs, 'Intro load');
    scrollEffects();                       // set up while the intro plays (page is hidden behind it)
    await intro.play(heroIn);              // resolves once the homepage is revealed
  } catch (err) {
    console.warn('[PRANA] Intro skipped:', err && err.message ? err.message : err);
    scrollEffects();
    heroIn();
  } finally {
    endIntro();
  }
}

boot();
