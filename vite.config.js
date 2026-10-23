import { defineConfig } from 'vite';
import { renderHeader } from './src/ui/chrome.js';
import { whatItDoesHtml, howToUseHtml, howItWorksHtml, whyNotSpreadsheetHtml, limitsHtml } from './src/ui/render.js';
import { faqHtml, jsonLdHtml } from './src/ui/seo.js';
const div = (id) => `<div class="prose" id="${id}"></div>`;
const fill = (id, html) => [div(id), () => `<div class="prose" id="${id}">${html()}</div>`];
const STATIC = [
    ['<header class="masthead" id="site-header"></header>', () => `<header class="masthead" id="site-header">${renderHeader()}</header>`],
    fill('what-body', whatItDoesHtml),
    fill('use-body', howToUseHtml),
    fill('works-body', howItWorksHtml),
    fill('why-body', whyNotSpreadsheetHtml),
    fill('limits-body', limitsHtml),
    ['<div class="panel-body prose" id="faq-body"></div>', () => `<div class="panel-body prose" id="faq-body">${faqHtml()}</div>`],
    ['</head>', () => `  ${jsonLdHtml()}\n</head>`],
];
const staticPage = () => ({
    name: 'c5-static-page',
    transformIndexHtml(html, ctx) {
        if (!/(^|\/)index\.html$/.test(ctx.filename || ctx.path || ''))
            return html;
        let out = html;
        for (const [marker, content] of STATIC) {
            if (!out.includes(marker))
                throw new Error(`c5-static-page: marker not found in index.html: ${marker}`);
            out = out.replace(marker, content);
        }
        return out;
    },
});
export default defineConfig(({ mode }) => ({
    base: './',
    plugins: [staticPage()],
    build: {
        modulePreload: { polyfill: false },
        target: 'es2022',
            },
    server: { port: 5175, strictPort: true },
}));
