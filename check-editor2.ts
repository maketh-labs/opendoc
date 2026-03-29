import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto("http://localhost:3000/editor?path=guides/index.md", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

// Scroll to bottom to see code block
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);

await page.screenshot({ path: "/tmp/editor-bottom.png", fullPage: false });

// Check if there's a language selector
const selector = await page.$("select");
const selectorVal = selector ? await selector.evaluate(el => el.value) : "none found";
console.log("Language selector value:", selectorVal);

// Check code block HTML
const codeBlock = await page.$(".bn-block-content[data-content-type='codeBlock']");
console.log("Code block found:", !!codeBlock);

await browser.close();
