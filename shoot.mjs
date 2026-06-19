// Playwright screenshot script for AI Reader extension
// Run from your terminal (not via qclaw): pnpm shoot
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXTENSION_PATH = '/Users/another/Documents/OpenSource/ai-reader/.output/chrome-mv3';
const USER_DATA_DIR = '/tmp/pw-profile-aireader-' + Date.now();
const SHOT_DIR = '/tmp/ai-reader-shots';
const CHROME_PATH = '/tmp/pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

if (!existsSync(EXTENSION_PATH)) {
  console.error('Build first: cd /Users/another/Documents/OpenSource/ai-reader && pnpm build');
  process.exit(1);
}
mkdirSync(SHOT_DIR, { recursive: true });

console.log('Launching browser...');
const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
  executablePath: CHROME_PATH,
  headless: true,
  args: [
    '--disable-extensions-except=' + EXTENSION_PATH,
    '--load-extension=' + EXTENSION_PATH,
    '--no-first-run',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

let extId = null;
for (let i = 0; i < 60; i++) {
  const workers = browser.serviceWorkers();
  for (const w of workers) {
    const m = w.url().match(/^chrome-extension:\/\/([a-z]+)\//);
    if (m) { extId = m[1]; break; }
  }
  if (extId) break;
  const pages = browser.backgroundPages();
  for (const p of pages) {
    const m = p.url().match(/^chrome-extension:\/\/([a-z]+)\//);
    if (m) { extId = m[1]; break; }
  }
  if (extId) break;
  await sleep(250);
}
if (!extId) {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await sleep(1500);
  const workers = browser.serviceWorkers();
  for (const w of workers) {
    const m = w.url().match(/^chrome-extension:\/\/([a-z]+)\//);
    if (m) { extId = m[1]; break; }
  }
  await page.close();
}
if (!extId) {
  console.error('No extension ID found');
  await browser.close();
  process.exit(1);
}
console.log('Extension ID:', extId);

const entries = [
  { name: 'options',   url: 'chrome-extension://' + extId + '/options.html',   viewport: { width: 1280, height: 900 }, full: true },
  { name: 'popup',     url: 'chrome-extension://' + extId + '/popup.html',     viewport: { width: 360,  height: 500 }, full: false },
  { name: 'sidepanel', url: 'chrome-extension://' + extId + '/sidepanel.html', viewport: { width: 400,  height: 800 }, full: false },
];

for (const theme of ['light', 'dark']) {
  for (const e of entries) {
    const page = await browser.newPage();
    await page.setViewportSize(e.viewport);
    try {
      await page.goto(e.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (err) {
      console.error('  goto failed:', e.name, theme, err.message);
      await page.close();
      continue;
    }
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector('#app');
        return el && el.children.length > 0;
      }, { timeout: 8000 });
    } catch {
      console.warn('  no mount detected:', e.name, theme);
    }
    await page.evaluate((isDark) => {
      document.documentElement.classList[isDark ? 'add' : 'remove']('dark');
    }, theme === 'dark');
    await sleep(500);
    const filename = SHOT_DIR + '/' + e.name + '-' + theme + '.png';
    await page.screenshot({ path: filename, fullPage: e.full });
    console.log('  saved', filename);
    await page.close();
  }
}

await browser.close();
console.log('Done');
