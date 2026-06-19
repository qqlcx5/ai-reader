// Load the AI Reader extension in playwright and test the OpenAI key save
import { chromium } from 'playwright';
import path from 'path';

const EXT_PATH = '/Users/another/Documents/OpenSource/ai-reader/.output/chrome-mv3';

const browser = await chromium.launchPersistentContext('/tmp/test-profile', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    '--no-first-run',
  ],
  viewport: { width: 1280, height: 800 },
});

console.log('Browser launched with extension loaded');

const page = await browser.newPage();
page.on('console', msg => console.log('[page]', msg.type(), msg.text()));
page.on('pageerror', err => console.log('[pageerror]', err.message));

// First, find the extension's service worker
const workers = browser.serviceWorkers();
console.log('Service workers:', workers.length);
for (const w of workers) {
  console.log('SW URL:', w.url());
}

// Wait a bit for extension to fully load
await new Promise(r => setTimeout(r, 2000));

// Open the options page directly
const optionsUrl = `chrome-extension://${workers[0]?.url().split('/')[2]}/options.html`;
console.log('Opening options page:', optionsUrl);

await page.goto(optionsUrl);
await new Promise(r => setTimeout(r, 1500));

// Take a screenshot
await page.screenshot({ path: '/tmp/options-page.png', fullPage: true });
console.log('Screenshot saved to /tmp/options-page.png');

// Find the API Key input
const apiKeyInput = await page.$('input[type="password"]');
if (!apiKeyInput) {
  console.log('ERROR: No API key input found!');
  await browser.close();
  process.exit(1);
}

console.log('Found API key input, typing test value...');
await apiKeyInput.click();
await apiKeyInput.fill('sk-test12345');

// Wait for debounce + save
await new Promise(r => setTimeout(r, 1000));

await page.screenshot({ path: '/tmp/options-page-after.png', fullPage: true });
console.log('Screenshot after typing saved');

// Check storage
const storageValue = await page.evaluate(async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get('ai-reader-settings', (data) => {
      resolve(data);
    });
  });
});

console.log('Storage value:', JSON.stringify(storageValue, null, 2));

await browser.close();
