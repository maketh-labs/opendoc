import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000/editor?path=guides/index.md", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

// Find the code block and scroll it into view
const codeBlock = await page.$(".bn-block-content[data-content-type='codeBlock']");
if (codeBlock) {
  await codeBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
}

// Get the parent block outer wrapper and take clip screenshot
const blockOuter = await page.$("[data-content-type='codeBlock']");
if (blockOuter) {
  const box = await blockOuter.boundingBox();
  if (box) {
    console.log("Code block bounds:", JSON.stringify(box));
    // Add some padding around it
    await page.screenshot({
      path: "/tmp/editor-codeblock.png",
      clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 80), width: Math.min(1200, box.width + 40), height: Math.min(800, box.height + 160) }
    });
    console.log("Screenshot taken");
  }
}

// Also get the HTML of the code block to understand structure  
const html = await page.evaluate(() => {
  const el = document.querySelector("[data-content-type='codeBlock']");
  return el ? el.outerHTML.slice(0, 2000) : "not found";
});
console.log("Code block HTML:", html.slice(0, 500));

await browser.close();
