import { chromium } from "playwright";
const browser = await chromium.launch({ args: ['--no-sandbox'] });

// Reader - light mode
const ctx1 = await browser.newContext({ colorScheme: 'light' });
const p1 = await ctx1.newPage();
await p1.goto("http://localhost:3000/guides", { waitUntil: "load", timeout: 10000 });
await p1.waitForTimeout(2000);
const color = await p1.evaluate(() => {
  const kw = document.querySelector(".hljs-keyword");
  return kw ? window.getComputedStyle(kw).color : "not found";
});
console.log("Reader keyword color:", color);
await p1.screenshot({ path: "/tmp/final-reader.png", fullPage: true });

// Editor
const ctx2 = await browser.newContext({ colorScheme: 'light' });
const p2 = await ctx2.newPage();
await p2.goto("http://localhost:3000/editor?path=guides/index.md", { waitUntil: "load", timeout: 10000 });
await p2.waitForTimeout(5000);
await p2.screenshot({ path: "/tmp/final-editor.png", fullPage: true });

await browser.close();
console.log("done");
