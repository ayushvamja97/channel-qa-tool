// Actual local application captures: no mocked model output or fabricated UI state.
import "dotenv/config";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const base = new URL(process.env.DEMO_URL || "http://localhost:3000");
  if (!["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Capture only a local demo with fictional accounts.");
  if (!process.env.SEED_USER_PASSWORD) throw new Error("Set SEED_USER_PASSWORD for the existing local demo account.");
  const out = path.join(process.cwd(), "docs", "screenshots");
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(25_000);
    const capture = async name => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 78 });
    };
    await page.goto(new URL("/channels", base).href);
    await page.getByRole("heading", { name: "Channels", exact: true }).waitFor();
    await capture("channels");
    await page.goto(new URL("/login", base).href);
    await page.getByLabel("Email", { exact: true }).fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_USER_PASSWORD);
    await Promise.all([
      page.waitForURL(base.origin + "/"),
      page.getByRole("button", { name: "Login", exact: true }).click(),
    ]);
    await page.goto(new URL("/channels", base).href);
    await page.getByRole("link").filter({ hasText: "#python" }).first().click();
    await page.getByLabel("Post title", { exact: true }).fill("Why do changes in one Python row affect every row?");
    await page.getByLabel("Post body", { exact: true }).fill("I created rows = [[0] * 3] * 3. Changing rows[0][0] also changes the other rows. How can I give each row its own list?");
    await capture("question-assistant");
    // Exercise the real unavailable-provider path when text AI is deliberately disabled.
    if (process.env.AI_ENABLED !== "true") {
      await page.getByRole("button", { name: "Review question", exact: true }).click();
      await page.getByText("Text AI is not configured.", { exact: false }).waitFor();
    }
    await page.getByRole("link").filter({ hasText: "Why does changing one nested list change every row?" }).click();
    await page.getByRole("heading", { name: "Replies", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Replies", exact: true }).scrollIntoViewIfNeeded();
    await capture("discussion");
    if (process.env.VISION_SERVICE_URL && process.env.VISION_SERVICE_TOKEN) {
      await page.getByRole("button", { name: "Find similar screenshots (CNN)", exact: true }).click();
      await page.getByText("Feature extractor:", { exact: false }).waitFor();
      await capture("cnn-image-search");
    }
    if (process.env.SEED_ADMIN_PASSWORD) {
      await Promise.all([page.waitForURL(base.origin + "/"), page.getByRole("button", { name: "Logout", exact: true }).click()]);
      await page.goto(new URL("/login", base).href);
      await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
      await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD);
      await Promise.all([page.waitForURL(base.origin + "/"), page.getByRole("button", { name: "Login", exact: true }).click()]);
      await page.goto(new URL("/admin", base).href);
      await page.getByRole("heading", { name: "Admin Panel", exact: true }).waitFor();
      await capture("admin");
    }
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Captured real local UI; login, draft controls, and enabled optional-service paths passed. No text AI output was fabricated.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
