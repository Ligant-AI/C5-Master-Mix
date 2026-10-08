// Headless smoke check (CLAUDE.md Task 2, step 7). Loads the page and prints, as
// JSON: the title, any console errors (and uncaught page errors), every
// localStorage key, the sessionStorage length and the cookie count.
//
//   node verification/headless/smoke.mjs [url]      default http://localhost:5175/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5175/';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 650 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  const store = await page.evaluate(() => ({
    localStorageKeys: Object.keys(localStorage),
    sessionStorageLength: sessionStorage.length,
  }));
  const cookies = await context.cookies();
  console.log(JSON.stringify({
    url,
    title: await page.title(),
    consoleErrors,
    localStorageKeys: store.localStorageKeys,
    sessionStorageLength: store.sessionStorageLength,
    cookieCount: cookies.length,
  }, null, 2));
} finally {
  await browser.close();
}
