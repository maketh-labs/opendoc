import { chromium } from "playwright";
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ colorScheme: 'light' });
const page = await context.newPage();
try {
  await page.goto("http://localhost:3000/guides", { waitUntil: "load", timeout: 10000 });
  await page.waitForTimeout(2000);
  const keywordColor = await page.evaluate(() => {
    const keyword = document.querySelector(".hljs-keyword");
    if (!keyword) return "no .hljs-keyword found";
    return window.getComputedStyle(keyword).color;
  });
  console.log("Keyword computed color (light mode):", keywordColor);
  await page.screenshot({ path: "/tmp/reader-light.png", fullPage: true });
} finally {
  await browser.close();
}
