// Task 3 layout measurement (C5-NF-04, C5-NF-05, C5-NF-06, C5-VZ-09).
// Headless Chromium at the reference viewport, 1366 × 650 CSS px, against the
// layout mock in the production build (npm run build:layout, then npm run preview).
//
// For each case: scroll from the top to the bottom in steps of 50 px (the last
// step lands exactly on the bottom). At every step where any component-bearing
// element (a component row, a line of names below the list, a C5-VZ-03 row) is
// at least partly in the viewport, every declaration item and every flag line
// must be fully inside the viewport and not covered by anything else
// (elementFromPoint at its centre). One JSON line per case. Exit 1 on any
// violation, any console error, any horizontal overflow at 1366 px, or any row
// field whose text is cut off by its width.
//
//   node verification/layout/measure.mjs [base]   default http://localhost:4175/verification/layout/mock.html
//   node verification/layout/measure.mjs --width=1351 [base]
//     The same cases at a narrower layout width, for a browser that shows a
//     classic scrollbar (about 15 px) inside the 1366 px window.
//   node verification/layout/measure.mjs --negative-control [base]
//     Takes the block out of sticky positioning (through the CSSOM, which the
//     CSP permits) and runs one case. It must report violations and exit 1;
//     otherwise the check cannot see the failure it exists to catch.
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const NEGATIVE = args.includes('--negative-control');
const base = args.find((a) => !a.startsWith('--')) || 'http://localhost:4175/verification/layout/mock.html';
const widthArg = args.find((a) => a.startsWith('--width='));
const VIEW = { width: widthArg ? Number(widthArg.slice(8)) : 1366, height: 650 };
const STEP = 50;
const ALL_CASES = [
  ...[4, 10, 20, 30, 40].map((n) => ({ case: `all ten flags, N=${n}`, query: `n=${n}` })),
  // The diluent is the one free-text declaration in the block. Recording one
  // clears C5-FL-09, leaving nine flags: also a combination that can co-occur.
  { case: 'nine flags, recorded diluent of 140 characters, N=40', query: 'n=40&diluent=140' },
  { case: 'nine flags, recorded diluent of 400 characters, N=40', query: 'n=40&diluent=400' },
  { case: 'nine flags, diluent of 400 characters, every typed number 15 characters, N=40', query: 'n=40&diluent=400&typed=15' },
  // Beyond the requested counts, for the cap.
  { case: 'all ten flags, N=60', query: 'n=60' },
];
const CASES = NEGATIVE ? [{ case: 'NEGATIVE CONTROL: block not sticky, all ten flags, N=40', query: 'n=40' }] : ALL_CASES;

const browser = await chromium.launch();
let failed = false;
try {
  for (const c of CASES) {
    const page = await browser.newPage({ viewport: VIEW });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}?${c.query}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.mockReady === '1');
    if (NEGATIVE) await page.evaluate(() => { document.getElementById('bounded-block').style.position = 'static'; });

    const m = await page.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      const block = r('#bounded-block');
      const head = r('#components-head');
      const row = r('#components-body tr');
      const stickyTop = parseFloat(getComputedStyle(document.getElementById('bounded-block')).top);
      return {
        blockHeightPx: block.height,
        columnHeadingsHeightPx: head.height,
        stickyTopPx: stickyTop,
        componentRowHeightPx: row.height,
        totalPageHeightPx: document.documentElement.scrollHeight,
        vz03HeightPx: r('#vz03 svg').height,
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        // Row fields whose entered text or chosen option is cut off by the field's width.
        truncatedFields: [...document.querySelectorAll('#components-body input[type=text], #components-body select')].filter((el) => {
          if (el.tagName === 'INPUT') return el.scrollWidth > el.clientWidth;
          const probe = document.createElement('span');
          const f = getComputedStyle(el);
          Object.assign(probe.style, { fontFamily: f.fontFamily, fontSize: f.fontSize, fontWeight: f.fontWeight, fontVariantNumeric: f.fontVariantNumeric, letterSpacing: f.letterSpacing, position: 'absolute', whiteSpace: 'pre' });
          probe.textContent = el.selectedOptions[0]?.textContent || '';
          document.body.appendChild(probe);
          const w = probe.getBoundingClientRect().width; probe.remove();
          const cs = getComputedStyle(el);
          // the text area of a select: its width less padding, border and the arrow (about 18 px)
          return w > el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 18;
        }).map((el) => `${el.closest('tr').dataset.component}: ${el.value}`),
        // Spare width on the widest flag line: its column's content width less
        // the width of its text, so a longer label is known to stay on one line.
        flagLineMinHeadroomPx: Math.min(...[...document.querySelectorAll('[data-flag]')].map((li) => {
          const range = document.createRange(); range.selectNodeContents(li);
          const cs = getComputedStyle(li);
          return li.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - range.getBoundingClientRect().width;
        })),
        flagLinesWrapped: [...document.querySelectorAll('[data-flag]')].filter((li) => li.getBoundingClientRect().height > 30).map((li) => li.dataset.flag),
        layoutWidthPx: innerWidth,
        declarations: document.querySelectorAll('[data-decl]').length,
        flags: document.querySelectorAll('[data-flag]').length,
        components: document.querySelectorAll('#components-body tr').length,
      };
    });
    const viewportLeftForComponentsPx = VIEW.height - m.stickyTopPx - m.blockHeightPx - m.columnHeadingsHeightPx;

    const maxY = m.totalPageHeightPx - VIEW.height;
    const ys = [];
    for (let y = 0; y < maxY; y += STEP) ys.push(y);
    ys.push(maxY);

    let stepsChecked = 0;
    const violations = [];
    for (const y of ys) {
      const res = await page.evaluate((y) => {
        window.scrollTo(0, y);
        const H = innerHeight, W = innerWidth;
        const scrollY = window.scrollY;
        const visible = [...document.querySelectorAll('[data-component]')].some((el) => {
          const b = el.getBoundingClientRect();
          return b.height > 0 && b.bottom > 0 && b.top < H;
        });
        if (!visible) return { scrollY, checked: false, bad: [] };
        const bad = [];
        for (const el of document.querySelectorAll('[data-decl], [data-flag]')) {
          const b = el.getBoundingClientRect();
          const name = el.dataset.decl ? `declaration ${el.dataset.decl}` : `flag ${el.dataset.flag}`;
          if (!(b.top >= 0 && b.bottom <= H && b.left >= 0 && b.right <= W)) { bad.push({ scrollY, element: name, reason: `outside viewport: top ${b.top}, bottom ${b.bottom}` }); continue; }
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (!hit || !(hit === el || el.contains(hit))) bad.push({ scrollY, element: name, reason: `covered by ${hit ? hit.tagName.toLowerCase() : 'nothing'}` });
        }
        return { scrollY, checked: true, bad };
      }, y);
      if (res.checked) stepsChecked++;
      violations.push(...res.bad);
    }

    const line = {
      case: c.case,
      N: m.components,
      declarations: m.declarations,
      flags: m.flags,
      blockHeightPx: m.blockHeightPx,
      stickyTopPx: m.stickyTopPx,
      columnHeadingsHeightPx: m.columnHeadingsHeightPx,
      viewportLeftForComponentsPx,
      componentRowHeightPx: m.componentRowHeightPx,
      rowsVisibleAtOnce: Math.floor(viewportLeftForComponentsPx / m.componentRowHeightPx),
      totalPageHeightPx: m.totalPageHeightPx,
      vz03HeightPx: m.vz03HeightPx,
      layoutWidthPx: m.layoutWidthPx,
      flagLineMinHeadroomPx: m.flagLineMinHeadroomPx,
      flagLinesWrapped: m.flagLinesWrapped,
      horizontalOverflowPx: m.horizontalOverflowPx,
      truncatedFields: m.truncatedFields,
      stepsTotal: ys.length,
      stepsChecked,
      consoleErrors: errors,
      violations,
    };
    console.log(JSON.stringify(line));
    if (violations.length || errors.length || m.horizontalOverflowPx > 0 || m.truncatedFields.length) failed = true;
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
