import { chromium } from "playwright";
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p1 = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p1.goto("http://localhost:3000", { waitUntil: "load" });
await p1.waitForTimeout(2000);
await p1.screenshot({ path: "/tmp/reader.png", fullPage: true });

const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p2.goto("http://localhost:3000/editor", { waitUntil: "load" });
await p2.waitForTimeout(4000);
await p2.screenshot({ path: "/tmp/editor.png", fullPage: true });
await b.close();
console.log("done");
