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
// violation, any console error, any horizontal overflow, any row field whose
// text is cut off by its width, a bounded block taller than BLOCK_BOUND_PX
// (C5-NF-05, A.B.'s ruling of the Task 3 review), or less than MIN_SLACK_PX of
// horizontal slack for the component table at SLACK_WIDTH_PX (Task 3 review,
// ruling 6: room for a classic scrollbar).
//
//   node verification/layout/measure.mjs [base]   default http://localhost:4175/verification/layout/mock.html
//   node verification/layout/measure.mjs --width=1351 [base]
//     The same cases at a narrower layout width, for a browser that shows a
//     classic scrollbar (about 15 px) inside the 1366 px window.
//   node verification/layout/measure.mjs --query=<mock query> [base]
//     One ad-hoc case instead of the set, e.g. --query=n=40&diluent=2000.
//   node verification/layout/measure.mjs --page [base]   default http://localhost:4175/
//     The same cases on the real page (Task 8): each panel is entered through
//     the page's own controls (verification/headless/fill.mjs), built to raise
//     every flag the case names, and checked to have raised them.
//   node verification/layout/measure.mjs --negative-control [base]
//     Takes the block out of sticky positioning (through the CSSOM, which the
//     CSP permits) and runs one case. It must report violations and exit 1;
//     otherwise the check cannot see the failure it exists to catch.
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const NEGATIVE = args.includes('--negative-control');
const PAGE = args.includes('--page');
const base = args.find((a) => !a.startsWith('--')) || (PAGE ? 'http://localhost:4175/' : 'http://localhost:4175/verification/layout/mock.html');
const { fill } = PAGE ? await import('../headless/fill.mjs') : {};

// The real page's synthetic panel, as the mock's: n components raising all ten
// flags, or nine with a recorded diluent of `diluent` characters; `typed` pads
// every typed panel number to that many characters.
const MARKERS = ['CD3', 'CD4', 'CD8', 'CD45RA', 'CCR7', 'CD27', 'CD28', 'CD95', 'CD127', 'CD25', 'CXCR5', 'PD-1', 'ICOS', 'CD38', 'HLA-DR', 'CD14', 'CD16', 'CD56', 'CD19', 'CD20', 'IgD', 'CD24', 'CD11c', 'CD123', 'CD1c', 'CD141', 'TCRγδ', 'Vδ2', 'CD161', 'CCR6', 'CXCR3', 'CCR4', 'KLRG1', 'CD57', 'TIGIT', 'LAG-3', 'TIM-3', 'CD39', 'CD73', 'CD69', 'CD103', 'CD45', 'CD2', 'CD7', 'NKG2A', 'NKG2C', 'CD94', 'CD62L', 'CD31', 'IgM', 'IgG', 'CD10', 'CD21', 'CD86', 'CD80', 'CD40', 'FcεRI', 'CD117', 'CD34', 'Live/Dead'];
const FLUORS = ['BUV395', 'BUV496', 'BUV563', 'BUV615', 'BUV661', 'BUV737', 'BUV805', 'BV421', 'Pacific Blue', 'BV480', 'BV510', 'BV570', 'BV605', 'BV650', 'BV711', 'BV750', 'BV785', 'BB515', 'Alexa Fluor 488', 'Spark Blue 550', 'PerCP', 'PerCP-eFluor 710', 'PE', 'PE-CF594', 'PE-Cy5', 'PE-Cy5.5', 'PE-Cy7', 'APC', 'Alexa Fluor 647', 'APC-R700', 'APC-Fire 750', 'APC-Cy7'];
const DILUENT_POOL = 'PBS pH 7.4 with 2% heat-inactivated FBS, 2 mM EDTA and 0.1% sodium azide, with Brilliant Stain Buffer Plus at 1x and True-Stain Monocyte Blocker at 5 µL per test, filtered at 0.22 µm and kept at 4 °C; lot numbers recorded in the bench notebook for this run. ';
function pageInput(query) {
  const q = new URLSearchParams(query);
  const n = Number(q.get('n'));
  const dil = Number(q.get('diluent')) || 0;
  const typed = Number(q.get('typed')) || 0;
  const cp07 = q.get('cp07') === '1';
  const pad = (v) => (typed && v.length < typed ? (v.includes('.') ? v : `${v}.`).padEnd(typed, '0') : v);
  return {
    dispensed: { value: pad('50'), unit: 'µL' }, residual: { value: pad('50'), unit: 'µL' },
    assayCells: { value: pad('1000000'), unit: 'cells' }, samples: '96',
    overage: { form: 'dead-volume', value: pad('0'), unit: 'µL' }, basis: cp07 ? '' : 'preserve-concentration',
    diluent: dil ? { notRecorded: false, text: DILUENT_POOL.repeat(Math.ceil(dil / DILUENT_POOL.length)).slice(0, dil).trim() } : { notRecorded: true },
    minTransfer: { value: '2', unit: 'µL', defaulted: true }, capacity: { value: pad('1'), unit: 'mL' },
    components: Array.from({ length: n }, (_, i) => ({
      label: `${MARKERS[i % MARKERS.length]} ${FLUORS[(i * 7) % FLUORS.length]}`,
      intended: { value: i % 7 === 3 ? '0.001' : '0.05', unit: 'µg' }, stock: { value: '1', unit: 'mg/mL' },
      establishedVolume: i % 5 === 1 ? { notRecorded: true } : { value: !cp07 && i % 3 === 0 ? '50' : '100', unit: 'µL' },
      establishedCells: i % 6 === 2 ? { notRecorded: true } : { value: i % 4 === 0 ? '500000' : '1000000', unit: 'cells' },
      provenance: ['titrated-here', 'vendor', 'titrated-here', 'not-recorded', 'vendor'][i % 5],
    })),
  };
}
async function open(page, query, width) {
  if (!PAGE) {
    await page.goto(`${base}?${query}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.mockReady === '1');
    return;
  }
  await page.goto(base, { waitUntil: 'networkidle' });
  await fill(page, pageInput(query));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(50);
}
const widthArg = args.find((a) => a.startsWith('--width='));
const VIEW = { width: widthArg ? Number(widthArg.slice(8)) : 1366, height: 650 };
const STEP = 50;
const BLOCK_BOUND_PX = 260;
const SLACK_WIDTH_PX = 1351;
const MIN_SLACK_PX = 16;
const ALL_CASES = [
  ...[4, 10, 20, 30, 40].map((n) => ({ case: `all ten flags, N=${n}`, query: `n=${n}` })),
  // The diluent is the one free-text declaration in the block. Recording one
  // clears C5-FL-09, leaving nine flags: also a combination that can co-occur.
  { case: 'nine flags, recorded diluent of 140 characters, N=40', query: 'n=40&diluent=140' },
  { case: 'nine flags, recorded diluent of 400 characters, N=40', query: 'n=40&diluent=400' },
  { case: 'nine flags, diluent of 400 characters, every typed number 15 characters, N=40', query: 'n=40&diluent=400&typed=15' },
  // The maximum component count (Task 3 review, ruling 3). Permanent.
  { case: 'all ten flags, N=60', query: 'n=60' },
  // The real page only: the C5-CP-07 statement in the block. Every recorded
  // established volume equals the assay's, so FL-01 and FL-08 cannot co-occur
  // with it; every other flag is raised.
  ...(PAGE ? [
    { case: 'C5-CP-07 statement in the block, eight flags, N=60', query: 'n=60&cp07=1' },
    { case: 'C5-CP-07 statement in the block, seven flags, recorded diluent of 400 characters, N=60', query: 'n=60&cp07=1&diluent=400' },
  ] : []),
];
const queryArg = args.find((a) => a.startsWith('--query='));
const CASES = NEGATIVE ? [{ case: 'NEGATIVE CONTROL: block not sticky, all ten flags, N=40', query: 'n=40' }]
  : queryArg ? [{ case: `ad hoc: ${queryArg.slice(8)}`, query: queryArg.slice(8) }]
    : ALL_CASES;

const browser = await chromium.launch();
let failed = false;
try {
  for (const c of CASES) {
    const page = await browser.newPage({ viewport: VIEW });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, c.query, VIEW.width);
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
        vz03HeightPx: r('#vz03 > svg').height,
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
        cp07Shown: !!document.querySelector('#bounded-block [data-decl="cp07"]'),
        components: document.querySelectorAll('#components-body tr').length,
      };
    });
    // The table's horizontal slack at SLACK_WIDTH_PX: the content width
    // available to it less its own max-content width.
    const slackPage = await browser.newPage({ viewport: { width: SLACK_WIDTH_PX, height: VIEW.height } });
    await open(slackPage, c.query, SLACK_WIDTH_PX);
    const slackAtWidthPx = await slackPage.evaluate(() => {
      const t = document.getElementById('components'); const host = t.parentElement; const cs = getComputedStyle(host);
      const available = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      t.style.width = 'max-content'; const natural = t.getBoundingClientRect().width; t.style.width = '';
      return available - natural;
    });
    await slackPage.close();
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
      blockBoundPx: BLOCK_BOUND_PX,
      blockWithinBound: m.blockHeightPx <= BLOCK_BOUND_PX,
      tableSlackPx: { atWidthPx: SLACK_WIDTH_PX, slackPx: slackAtWidthPx, minimumPx: MIN_SLACK_PX, ok: slackAtWidthPx >= MIN_SLACK_PX },
      truncatedFields: m.truncatedFields,
      stepsTotal: ys.length,
      stepsChecked,
      consoleErrors: errors,
      violations,
    };
    // On the real page, the panel must have raised the flags the case is built for.
    const withCp07 = /cp07=1/.test(c.query);
    const expectedFlags = (withCp07 ? 8 : 10) - (/diluent=/.test(c.query) ? 1 : 0);
    if (PAGE) line.cp07Shown = m.cp07Shown;
    if (PAGE && !NEGATIVE && !queryArg && (m.flags !== expectedFlags || m.cp07Shown !== withCp07)) { line.flagsExpected = expectedFlags; line.cp07Expected = withCp07; failed = true; }
    if (violations.length || errors.length || m.horizontalOverflowPx > 0 || m.truncatedFields.length
      || m.blockHeightPx > BLOCK_BOUND_PX || slackAtWidthPx < MIN_SLACK_PX) failed = true;
    console.log(JSON.stringify(line));
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
