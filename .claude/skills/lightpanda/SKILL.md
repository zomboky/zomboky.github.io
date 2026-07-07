---
name: lightpanda
description: >
  Puppeteer scripts for Lightpanda headless browser testing. Connects to Lightpanda WebSocket,
  creates pages, and executes test/scraping logic. Zero setup — Lightpanda runs on ws://127.0.0.1:9222,
  Puppeteer already installed. Use when testing, navigating, or scraping the site.
---

# Lightpanda Testing Skill

Lightpanda is an ultra-fast headless browser running on `ws://127.0.0.1:9222`. Puppeteer connects to it via WebSocket—no separate browser install needed.

## Quick Start

Generate a Node.js test script and run it:

```javascript
import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ 
  browserWSEndpoint: 'ws://127.0.0.1:9222' 
});
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

// Your test logic here
const title = await page.title();
console.log('Page title:', title);

await browser.close();
```

Save as `/tmp/test-lightpanda.js`, run with `node /tmp/test-lightpanda.js`.

## Common Tasks

### Navigate & Extract Text
```javascript
const text = await page.$eval('h1', el => el.textContent);
```

### Click & Wait for Navigation
```javascript
await page.click('a.link');
await page.waitForNavigation({ waitUntil: 'networkidle2' });
```

### Fill Form & Submit
```javascript
await page.type('input[name="email"]', 'test@example.com');
await page.click('button[type="submit"]');
await page.waitForNavigation();
```

### Screenshot
```javascript
await page.screenshot({ path: '/tmp/screenshot.png' });
```

### Get All Links
```javascript
const links = await page.$$eval('a', els => els.map(el => ({
  text: el.textContent,
  href: el.href
})));
console.log(links);
```

### Check Element Exists
```javascript
const exists = await page.$('selector') !== null;
```

### Wait for Element
```javascript
await page.waitForSelector('.dynamic-content');
```

## Script Structure

Always follow this pattern:

1. **Connect** to Lightpanda
2. **Create page** and navigate to target URL (default: `http://localhost:3000`)
3. **Execute test logic** — query, interact, extract
4. **Close browser** (in try/finally)

```javascript
import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ 
  browserWSEndpoint: 'ws://127.0.0.1:9222' 
});
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  
  // Your logic
  
} finally {
  await browser.close();
}
```

## Debugging

- **Page content not loading?** Check `waitUntil` option (use `'networkidle2'` for dynamic content)
- **Selector not found?** Use `page.$()` (returns null) instead of `$eval()` to test first
- **Timeout?** Add explicit `{ timeout: 10000 }` to `waitForSelector()` / `goto()`
- **JavaScript errors?** Enable console listeners:

```javascript
page.on('console', msg => console.log(msg.text()));
page.on('error', err => console.error('Page error:', err));
```

## Environment

- **Browser**: Lightpanda (headless) on `ws://127.0.0.1:9222`
- **Puppeteer**: Already installed in project (`npm list puppeteer` to verify)
- **Dev server**: Typically `http://localhost:3000` (adapt if different)
- **Temp scripts**: Save to `/tmp/test-*.js` for isolation

Do NOT reinstall Puppeteer or restart Lightpanda. Just write, save, and execute the script.
