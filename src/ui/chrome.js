import { renderHeader as suiteHeader, renderFooter as suiteFooter, markSvg, escapeHtml as esc } from '@ligant/bench-chrome';
import { CONFIG } from '../config.js';
import { SEO } from './seo.js';
import { SCOPE_STATEMENT } from '../shared/privacy-statement.js';
export function renderHeader() {
    return suiteHeader({ path: CONFIG.slug ? `/${CONFIG.slug}/` : null, title: SEO.h1, description: SEO.lead });
}
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
        citationFootnote: 'References are given as text rather than links, so the page itself sends no visit to a publisher.',
        disclaimer: SCOPE_STATEMENT,
    });
}
export function renderColophon() {
    return `${markSvg({ size: 16 })}<span>${esc(CONFIG.publisher)} · ${esc(CONFIG.toolTitle)} v${esc(CONFIG.version)}</span>`;
}
