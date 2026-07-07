import puppeteer from 'puppeteer';

export async function connectToLightpanda() {
  return await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9222'
  });
}

export async function createTestPage(browser, url = 'http://localhost:3000') {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  return page;
}

export async function closeBrowser(browser) {
  await browser.close();
}

export async function testWithLightpanda(testFn, url = 'http://localhost:3000') {
  const browser = await connectToLightpanda();
  try {
    const page = await createTestPage(browser, url);
    return await testFn(page);
  } finally {
    await closeBrowser(browser);
  }
}
