// Offline browser smoke test. Arguments: fixture-directory, Playwright module URL.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(process.argv[2]);
const { chromium } = await import(process.argv[3]);
const server = createServer(async (req, res) => {
  const filename = {
    "/": "index.html",
    "/preview.js": "preview.js",
    "/preview.css": "preview.css",
  }[req.url];
  if (!filename) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    filename.endsWith(".js")
      ? "text/javascript"
      : filename.endsWith(".css")
        ? "text/css"
        : "text/html",
  );
  res.end(await readFile(path.join(root, filename)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByText("306,00 €", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Keskeneräiset yritykset", { exact: true }).count(),
    1,
  );
  await page.screenshot({
    path: path.join(root, "kohteet-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Omat yritykset", exact: true })
    .click();
  await page.getByRole("button", { name: "Avaa", exact: true }).last().click();
  await page
    .getByRole("button", { name: "Muokkaa", exact: true })
    .first()
    .click();
  await page.getByLabel("Todellinen kerroin").fill("2.02");
  await page.getByLabel("Muutoksen syy").fill("Fiktiivinen korjaus");
  await page.getByLabel("Todellinen palautus €").fill("303");
  await page
    .getByRole("button", { name: "Tallenna muutos", exact: true })
    .click();
  await page.getByText("303,00 €", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Poista", exact: true })
    .last()
    .click();
  await page.getByText("300,00 €", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Poistetut yritykset", exact: true })
    .click();
  await page.getByRole("button", { name: "Palauta", exact: true }).click();
  await page.getByText("303,00 €", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Takaisin historiaan", exact: true })
    .click();
  await page.getByRole("button", { name: "Avaa", exact: true }).first().click();
  await page.screenshot({
    path: path.join(root, "yritykset-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analytiikka", exact: true }).click();
  await page.getByRole("img", { name: /Kertynyt nettotulos/ }).waitFor();
  assert.equal(await page.locator(".arb-chart circle").count(), 1);
  await page.screenshot({
    path: path.join(root, "analytiikka-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Kassa", exact: true }).click();
  await page.getByLabel("Alkukassa €").fill("400");
  await page
    .getByRole("button", { name: "Tallenna alkukassa", exact: true })
    .click();
  await page.getByText("403,00 €", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Kohteet", exact: true }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(
    overflow,
    false,
    "mobile page must not overflow; tables scroll within their container",
  );
  await page.screenshot({
    path: path.join(root, "kohteet-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Offline browser: offers, attempts, editing, delete/restore, profit chart, opening bankroll and mobile layout passed.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
