import { initStore, getSlug } from './store.js';
import { renderDraw } from './drawing.js';
import { renderMosaic } from './mosaic.js';
import { renderQR } from './qr-page.js';
import { renderAdmin } from './admin.js';
import { renderLanding } from './landing.js';

const app = document.getElementById('main');
const statusDot = document.getElementById('ws-status');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navFloat = document.querySelector('.nav-float');

window.addEventListener('qart:ws-status', e => {
  statusDot.dataset.connected = e.detail.connected;
  statusDot.title = e.detail.connected ? 'Connected' : 'Reconnecting…';
});

// ── Determine context from pathname ──────────────────────────────────────────

const pathMatch = location.pathname.match(/^\/s\/([a-z0-9-]+)/);
const slug = pathMatch ? pathMatch[1] : null;

if (slug) {
  // Session mode — connect WS and show session app
  initStore(slug);
  setupSessionApp();
} else {
  // Landing page — hide nav chrome
  navFloat.hidden = true;
  navMenu.hidden = true;
  renderLanding(app);
}

// ── Session app (hamburger menu + hash routing) ──────────────────────────────

function setupSessionApp() {
  // Hamburger menu
  function closeNav() {
    navToggle.setAttribute('aria-expanded', 'false');
    navMenu.hidden = true;
  }

  navToggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navMenu.hidden = open;
  });

  document.addEventListener('click', e => {
    if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) closeNav();
  });

  navMenu.addEventListener('click', e => {
    if (e.target.classList.contains('nav-link')) closeNav();
  });

  // Router
  let currentPage = null;
  let currentCleanup = null;

  function navigate() {
    const hash = location.hash.slice(1) || 'draw';
    if (hash === currentPage) return;
    currentPage = hash;

    document.querySelectorAll('.nav-link').forEach(a => {
      const active = a.dataset.page === hash;
      a.classList.toggle('active', active);
      a.setAttribute('aria-current', active ? 'page' : 'false');
    });

    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    app.innerHTML = '';

    if (hash === 'draw')   currentCleanup = renderDraw(app);
    if (hash === 'mosaic') currentCleanup = renderMosaic(app);
    if (hash === 'qr')     currentCleanup = renderQR(app);
    if (hash === 'admin')  currentCleanup = renderAdmin(app);
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}
