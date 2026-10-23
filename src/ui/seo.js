import { escapeHtml as esc } from '@ligant/bench-chrome';
import { CONFIG } from '../config.js';
import { ENGINE_VERSION } from '../engine/version.js';
export const CANONICAL = `${CONFIG.publicBase}${CONFIG.slug}/`;
export const SEO = Object.freeze({
    title: "Ligant · Master Mix: Flow Cytometry Antibody Calculator",
    h1: "Master mix calculator for antibody staining in flow cytometry",
    lead: "This tool works out how much of each antibody (or other component) and how much diluent to put in one master mix, so that every sample receives what you intended. It also reports the concentration each component reaches in your assay, how that compares with the concentration it was established at, and where a titration may not transfer because the staining volume or the cell number differs from the one it was established at. It does not verify what was prepared or what volume reached each sample, does not choose the transfer basis, and does not design the panel.",
    description: "Free master mix calculator for flow cytometry: each antibody and diluent volume for your samples, overage and staining volume, with the cell number checked.",
    faqHeading: 'Questions and answers',
    faq: Object.freeze([
        Object.freeze({ q: "How do I calculate an antibody master mix for flow cytometry?", a: "Enter the dispensed cocktail volume per test (what you add to each tube or well), the volume already present with the cells (0 if none), the assay cell number per test and the number of samples; the assay staining volume is the dispensed volume plus the volume already present. Declare the overage. Record the diluent (\"not recorded\" is accepted but flagged) and the smallest volume you can pipette reliably, replacing the 2 µL suggestion with your pipette's value. Add each component with its intended quantity per test, its stock concentration, and the staining volume and cell number it was established at. If a component was established at a different staining volume, choose the transfer basis; the tool will not choose it for you. The result gives each component's volume per test and in the cocktail, its concentration in the assay, and a pipetting list with the diluent first and then the components in the order entered." }),
        Object.freeze({ q: "How much overage should I make for a master mix?", a: "The tool does not suggest a value: there is no default, because a pre-filled value accepted unchanged is a default nobody chose. Overage is the extra you make so the last tests are not left short, because some volume stays in the tube and tips; base it on what your own pipetting leaves behind. Choose a percentage of samples, a number of additional tests, or a dead volume, and enter its value. With n samples, the effective number of tests is n × (1 + p ÷ 100) for a percentage p, n + k for k additional tests, or n + V_dead ÷ D for a dead volume V_dead and a dispensed volume D per test; it is used unrounded. For example, 10 samples with 10 % overage give 11 effective tests, so a component at 5 µL of stock per test needs 55 µL in the cocktail. Zero overage is allowed but is flagged." }),
        Object.freeze({ q: "Should I keep the concentration or the amount per test when my staining volume is different?", a: "\"Preserve concentration\" keeps the concentration the component had when it was established, so its volume scales with the staining volume. \"Preserve amount per test\" keeps the same amount in each test. Concentration is the right choice where antibody is in large excess over its binding sites, so that binding is set by concentration. Amount per test is the right choice where nearly all the antibody added is bound, so that binding is set by the amount per cell; it keeps the amount per cell only if the cell number per test is also unchanged. Many panels sit between the two, and the tool cannot choose for you." }),
        Object.freeze({ q: "Does my antibody titration carry over to a different staining volume or cell number?", a: "The tool flags a component established at a different staining volume from this assay (FL-01) or at a different cell number (FL-11), and shows the ratios. Neither transfer basis recovers the established condition across a cell-number difference; stain at the cell number the component was established at, or titrate it at this one. A titration transfers only if cell type, fixation state, matrix, incubation time and temperature also match, and the tool asks for none of these five and cannot detect them." }),
        Object.freeze({ q: "What do I enter for each antibody in the master mix?", a: "A label; the intended quantity per test (an amount, a concentration in the assay, or a volume of stock per test); the stock concentration; the staining volume and cell number it was established at (or \"not recorded\"); and where the intended quantity came from (titrated here, vendor recommendation, or not recorded). \"Not recorded\" is accepted, and the result flags it. Where every component was established at these assay conditions, tick \"All components established at these assay conditions\" to fill those two fields from the assay. Tick it only if that is true: the staining-volume and cell-number comparisons then find nothing to flag." }),
        Object.freeze({ q: "What if an antibody volume is too small to pipette accurately?", a: "The tool flags a component whose volume in the cocktail is below your declared minimum reliable transfer volume (FL-05). The check is on the volume pipetted into the cocktail, not the volume per test. Make an intermediate dilution of that component and enter the diluted stock's concentration, or make a larger batch, so it can be pipetted accurately. Replace the 2 µL suggestion with your own pipette's value first, so the check uses it." }),
        Object.freeze({ q: "Does it check that my antibodies and dyes are compatible?", a: "No. Component incompatibility (polymer-dye buffer requirements, tandem-dye degradation, interference between components), precipitation or aggregation in the cocktail (including where a component's required buffer has been diluted), epitope interference between antibodies binding the same or adjacent targets, spillover and spreading error, and cocktail stability are not assessed; the diluent is recorded, not evaluated. Panel design is out of scope: an arithmetically correct cocktail may still be a poor panel. The tool states the composition; it does not observe what was pipetted or what volume reached each sample." }),
        Object.freeze({ q: "Is my data uploaded anywhere?", a: "No. Calculations run entirely in your browser, and your inputs are never transmitted, stored, or logged. The page sends an email address only if you choose to submit one in the newsletter signup, and its web analytics counts visits and sees how quickly the page loads, with further analytics only if you allow it in the banner; no analytics ever receives anything you type into this tool." }),
        Object.freeze({ q: "Is it free?", a: "Yes. It is free to use and open source under the Apache 2.0 licence. Its source code is on GitHub, so you can download it and run it on your own computer." }),
    ]),
    featureList: Object.freeze([
        "Volume of each component and the diluent in a master mix, for the samples, overage, staining volume and transfer basis you declare",
        "Overage as a percentage of samples, additional tests or dead volume",
        "Concentration each component reaches in the assay, compared with the concentration it was established at",
        "Flags a component established at a different staining volume or cell number from the assay, without choosing the transfer basis",
        "Pipetting list, notebook copy and printable bench sheet",
    ]),
});
export function faqHtml() {
    return SEO.faq.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('');
}
export function softwareApplication() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: `${CONFIG.publisher} · ${CONFIG.toolTitle}`,
        url: CANONICAL,
        description: SEO.description,
        applicationCategory: 'ScientificApplication',
        operatingSystem: 'Any (runs in a web browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0' },
        license: `${CANONICAL}LICENSE`,
        softwareVersion: ENGINE_VERSION,
        codeRepository: CONFIG.repositoryUrl,
        featureList: [...SEO.featureList],
    };
}
export function faqPage() {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: SEO.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    };
}
export function breadcrumbs() {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: CONFIG.productLine, item: CONFIG.publicBase },
            { '@type': 'ListItem', position: 2, name: CONFIG.toolTitle, item: CANONICAL },
        ],
    };
}
const block = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
export function jsonLdHtml() {
    return [softwareApplication(), faqPage(), breadcrumbs()].map(block).join('\n  ');
}
