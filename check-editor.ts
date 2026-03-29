import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const errors: string[] = [];
const logs: string[] = [];
page.on("console", msg => {
  if (msg.type() === "error") errors.push(msg.text());
  else logs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", err => errors.push(`PAGE ERROR: ${err.message}`));

await page.goto("http://localhost:3000/editor?path=guides/index.md", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

console.log("=== ERRORS ===");
errors.slice(0, 20).forEach(e => console.log(e));
console.log("=== LOGS (relevant) ===");
logs.filter(l => /code|highlight|shiki|syntax|error/i.test(l)).slice(0, 20).forEach(l => console.log(l));

await browser.close();
