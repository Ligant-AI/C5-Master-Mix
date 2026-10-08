// UI wiring. Task 2 scaffold: the shared frame and the Privacy section only.
// No persistence: nothing is written to any storage, and nothing into the URL.
// The frame's privacy choice (bindCopy → initConsent) is the one exception, and
// it stores only ligant_privacy_choice, on the hosted pages.
import { CONFIG } from '../config.js';
import { PRIVACY_STATEMENT, PRIVACY_DATE } from '../shared/privacy-statement.js';
import '@ligant/bench-chrome/chrome.css';
import { bindCopy, markDataUri, escapeHtml as esc } from '@ligant/bench-chrome';
import { renderHeader, renderFooter, renderColophon } from './chrome.js';

const $ = (id) => document.getElementById(id);

function init() {
  document.title = `${CONFIG.publisher} · ${CONFIG.toolTitle}`;
  $('site-header').innerHTML = renderHeader();
  $('site-footer').innerHTML = renderFooter();
  $('colophon').innerHTML = renderColophon();
  $('favicon').href = markDataUri();
  $('privacy-body').innerHTML = `<p>${esc(PRIVACY_STATEMENT)}</p><p><a href="${esc(CONFIG.privacyUrl)}" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>`;
  $('privacy-version').textContent = PRIVACY_DATE;

  bindCopy($('site-footer'));
}

window.addEventListener('error', (e) => {
  // A system error, not a rejection: one of the two places the restricted red is used.
  const el = $('system-error');
  el.hidden = false;
  el.textContent = `System error: ${e.message}. The result shown may be stale; reload the page.`;
});

init();
