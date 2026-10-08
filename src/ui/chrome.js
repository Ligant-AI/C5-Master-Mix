// The suite's header and footer come from @ligant/bench-chrome, shared by every
// Ligant Bench Tool. This file supplies only what is this tool's own: its path,
// title and description, its repository, its citation and its disclaimer. The
// footer's privacy statement is the suite's standard one, the same words the
// Privacy section on this page displays.
//
// From C7's src/ui/chrome.js. Changes: escapeHtml is taken from the frame
// package (C7 took it from its own page-content.js, which is C7's tool logic);
// the path and the citation address come from the slug (URS open item 9,
// decided by A.B. on 8 October 2026); C7's renderDisclaimer is left out,
// because it composes C7 engine text.
import { renderHeader as suiteHeader, renderFooter as suiteFooter, markSvg, escapeHtml as esc } from '@ligant/bench-chrome';
import { CONFIG } from '../config.js';
import { SCOPE_STATEMENT } from '../shared/privacy-statement.js';

export function renderHeader() {
  return suiteHeader({ path: CONFIG.slug ? `/${CONFIG.slug}/` : null, title: CONFIG.toolTitle, description: CONFIG.tagline });
}

/** The software citation, in the pieces the footer shows and copies. */
function citation() {
  const address = CONFIG.slug ? ` ${CONFIG.publicBase.replace('https://', '')}${CONFIG.slug}/` : '';
  const tail = ` (v${CONFIG.version}) [Computer software]. ${CONFIG.legalEntity}.${address}`;
  return {
    lead: `${CONFIG.citationAuthor} (${CONFIG.citationYear}). `,
    title: CONFIG.toolTitle,
    tail: CONFIG.doi ? `${tail} doi:${CONFIG.doi}` : tail,
  };
}

export function renderFooter() {
  return suiteFooter({
    repoUrl: CONFIG.repositoryUrl,
    citations: [citation()],
    citationFootnote: CONFIG.doi
      ? 'The identifier is given as text, not as a link: a link that navigated to a publisher would disclose a visit that the rest of the tool is built to prevent.'
      : 'No identifier is stated: one is minted when the tool is released, and a placeholder would read as a record that does not exist.',
    disclaimer: SCOPE_STATEMENT,
  });
}

export function renderColophon() {
  return `${markSvg({ size: 16 })}<span>${esc(CONFIG.publisher)} · ${esc(CONFIG.toolTitle)} v${esc(CONFIG.version)}</span>`;
}
