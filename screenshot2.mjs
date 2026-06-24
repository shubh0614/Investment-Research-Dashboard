import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const page = await ctx.newPage();

// Marketing page (unauthenticated)
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 20000 });
await page.screenshot({ path: "screenshot-home.png" });
console.log("home done");

await browser.close();
