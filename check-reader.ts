import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000/guides", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Check if hljs styles are loaded by checking computed color of a keyword
const keywordColor = await page.evaluate(() => {
  const keyword = document.querySelector(".hljs-keyword");
  if (!keyword) return "no .hljs-keyword found";
  return window.getComputedStyle(keyword).color;
});
console.log("Keyword color:", keywordColor);

// Also check the code block HTML
const codeHtml = await page.evaluate(() => {
  const pre = document.querySelector("pre code.hljs");
  return pre ? pre.innerHTML.slice(0, 300) : "no hljs code block found";
});
console.log("Code HTML:", codeHtml);

await browser.close();
