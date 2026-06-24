import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });

// Dark mode screenshot
const ctxDark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const pageDark = await ctxDark.newPage();
await pageDark.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 25000 });
await pageDark.screenshot({ path: "screenshot-login-dark.png" });
console.log("dark done");

// Light mode screenshot
const ctxLight = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const pageLight = await ctxLight.newPage();
await pageLight.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 25000 });
await pageLight.screenshot({ path: "screenshot-login-light.png" });
console.log("light done");

await browser.close();
