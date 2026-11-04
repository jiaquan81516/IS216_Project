import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baseURL = process.env.AUDIT_BASE_URL || "http://127.0.0.1:5173";
const outputDir = process.env.AUDIT_OUTPUT || "/tmp/nurturetrack-ui-audit";
const routes = (process.env.AUDIT_ROUTES || "/,/start,/role,/account,/signin,/household")
  .split(",")
  .filter(Boolean);
const viewports = (process.env.AUDIT_VIEWPORTS || "320x844,375x812,390x844,667x375,844x390,768x1024,1024x900,1280x900,1440x900")
  .split(",")
  .map((value) => value.split("x").map(Number))
  .filter(([width, height]) => width > 0 && height > 0)
  .map(([width, height]) => ({ width, height }));

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const findings = [];

for (const viewport of viewports) {
  const { width, height } = viewport;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const name = route === "/" ? "landing" : route.slice(1).replaceAll("/", "-");
    await page.screenshot({ path: path.join(outputDir, `${name}-${width}x${height}.png`), fullPage: true });
    const metrics = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const controls = [...document.querySelectorAll("button, a[href], input, select, textarea")].filter(visible);
      return {
        url: location.pathname,
        title: document.title,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        smallTargets: controls
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { text: (element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder") || element.tagName).trim().slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height) };
          })
          .filter(({ width, height }) => width < 44 || height < 44),
        unlabeled: controls
          .filter((element) => {
            if (element.matches("a, button")) return !(element.getAttribute("aria-label") || element.textContent?.trim() || element.getAttribute("title"));
            return !(element.labels?.length || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby"));
          })
          .map((element) => element.outerHTML.slice(0, 180)),
      };
    });
    findings.push({ route, width, height, ...metrics, consoleErrors: [...new Set(errors)] });
    errors.length = 0;
  }
  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, "findings.json"), JSON.stringify(findings, null, 2));
console.log(outputDir);
