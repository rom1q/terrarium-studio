import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a named checkpoint survives reload and restores the project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Votre habitat" })).toBeVisible();
  await expect(page.locator(".decor-item").filter({ hasText: "Branche · Branche fourchue" })).toHaveCount(1);

  await page.getByRole("button", { name: "Enregistrer le projet" }).click();
  const saveDialog = page.getByRole("dialog", { name: "Enregistrer le projet" });
  await saveDialog.getByLabel("Nom du projet").fill("E2E checkpoint");
  await saveDialog.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await page.getByRole("button", { name: "Afficher l’historique" }).click();
  const history = page.getByRole("region", { name: "Historique du projet" });
  await history.getByLabel("Nom du point de restauration").fill("Avant redimensionnement");
  await history.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(history.getByRole("status")).toHaveText("Point de restauration enregistré.");

  await page.getByLabel("Largeur en centimètres").fill("150");
  await page.getByLabel("Largeur en centimètres").press("Tab");
  await expect(page.getByLabel("Largeur en centimètres")).toHaveValue("150");
  await page.reload();

  await page.getByRole("button", { name: "Afficher l’historique" }).click();
  const reloadedHistory = page.getByRole("region", { name: "Historique du projet" });
  const checkpoint = reloadedHistory.getByRole("button", { name: /^Avant redimensionnement/ });
  await expect(checkpoint).toBeVisible();
  await checkpoint.click();
  await reloadedHistory.getByRole("button", { name: "Restaurer ce point" }).click();

  await expect(page.getByLabel("Largeur en centimètres")).toHaveValue("120");
});

test("selecting a scene object does not recreate the viewport", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(".viewport canvas");
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    (window as Window & { initialTerrariumCanvas?: HTMLCanvasElement }).initialTerrariumCanvas = element;
  });

  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error("Terrarium canvas bounds not available");
  const selectionTools = page.getByRole("group", { name: /Outils pour/ });
  const candidatePoints = [0.42, 0.5, 0.58].flatMap((x) => [0.48, 0.56, 0.64].map((y) => ({ x: canvasBounds.width * x, y: canvasBounds.height * y })));
  for (const point of candidatePoints) {
    await canvas.click({ position: point });
    if (await selectionTools.count()) break;
  }

  await expect(selectionTools.first()).toBeVisible();
  const canvasWasPreserved = await canvas.evaluate((element) => {
    return (window as Window & { initialTerrariumCanvas?: HTMLCanvasElement }).initialTerrariumCanvas === element;
  });
  expect(canvasWasPreserved).toBe(true);
});

test("a crested gecko hatchling uses its sourced stage profile", async ({ page }) => {
  await page.goto("/");
  const workflowSections = page.locator(".left-panel > .form-section");
  await expect(workflowSections.nth(0).locator(".section-title h2")).toHaveText("Son habitant");
  await expect(workflowSections.nth(1).locator(".section-title h2")).toHaveText("Le contenant");
  await page.getByLabel("Espèce de reptile ou amphibien").selectOption({ label: "Correlophus ciliatus · Gecko à crête" });

  const stages = page.getByRole("group", { name: "Stade de vie" });
  await stages.getByRole("button", { name: "Nouveau-né" }).click();
  await expect(stages.getByRole("button", { name: "Nouveau-né" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/ne doit pas dépasser 29 °C/)).toBeVisible();
  await expect(page.getByText(/Aucune plage de mesure chiffrée vérifiée pour nouveau-né/)).toBeVisible();

  await page.getByRole("button", { name: "Voir le rapport" }).click();
  const report = page.getByRole("dialog", { name: "Habitat sans titre" });
  await expect(report.getByText("Nouveau-né", { exact: true })).toBeVisible();
  await expect(report.getByText("Gecko à crête · Nouveau-né · Correlophus ciliatus", { exact: true })).toBeVisible();

  const dimensionCheck = report.locator(".report-check").filter({ hasText: "Dimensions minimales" });
  await expect(dimensionCheck).toContainText("min. 30.48 × 30.48 × 30.48 cm");
  await expect(dimensionCheck).toContainText("Profil ReptiFiles pour hatchling de moins de 12 g.");
  await expect(report.getByRole("link", { name: /Enclosure Size & Cohabitation/ })).toBeVisible();
  await expect(report.getByRole("link", { name: /Lighting, Heating & Humidity/ })).toBeVisible();
});

test("biotope guidance pairs a clear status with its source explanation", async ({ page }) => {
  await page.goto("/");
  const guidance = page.getByRole("status").filter({ hasText: "Repère compatible" });

  await expect(guidance).toContainText("La RSPCA décrit un habitat d’origine sec et recommande 30–40 % d’humidité.");
  await expect(guidance.locator("p")).toHaveCSS("font-size", "10px");
});

test("edited dimensions and readings appear in the report", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Largeur en centimètres").fill("130");
  await page.getByLabel("Largeur en centimètres").press("Tab");
  await page.getByLabel("Température zone chaude en degrés").fill("43");
  await page.getByLabel("Température zone chaude en degrés").press("Tab");

  await page.getByRole("button", { name: "Voir le rapport" }).click();
  const report = page.getByRole("dialog", { name: "Habitat sans titre" });
  const dimensions = report.locator(".report-facts div").filter({ hasText: "Dimensions intérieures" });
  const hotSideCheck = report.locator(".report-check").filter({ hasText: "Zone chaude" });

  await expect(dimensions).toContainText("130 × 60 × 80 cm");
  await expect(hotSideCheck).toContainText("43 °C · hors plage 38–42 °C");
});

test("JSON export and import preserve edited data and life stage", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Espèce de reptile ou amphibien").selectOption({ label: "Correlophus ciliatus · Gecko à crête" });
  const stages = page.getByRole("group", { name: "Stade de vie" });
  await stages.getByRole("button", { name: "Nouveau-né" }).click();
  await page.getByLabel("Largeur en centimètres").fill("140");
  await page.getByLabel("Largeur en centimètres").press("Tab");

  const projectMenu = page.locator(".project-menu");
  await projectMenu.locator("summary").click();
  const downloadPromise = page.waitForEvent("download");
  await projectMenu.getByRole("button", { name: "Exporter en JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Project download path not available");
  const exportedProject = JSON.parse(await readFile(downloadPath, "utf8")) as {
    format: string;
    project: { dimensions: { width: number }; lifeStage: string; species: string };
  };

  expect(exportedProject.format).toBe("terrarium-studio-project");
  expect(exportedProject.project.dimensions.width).toBe(140);
  expect(exportedProject.project.lifeStage).toBe("hatchling");
  expect(exportedProject.project.species).toBe("Correlophus ciliatus · Gecko à crête");

  await page.getByLabel("Largeur en centimètres").fill("100");
  await page.getByLabel("Largeur en centimètres").press("Tab");
  await stages.getByRole("button", { name: "Adulte" }).click();
  await page.locator('input[aria-label="Fichier de projet JSON"]').setInputFiles(downloadPath);

  await expect(page.getByLabel("Largeur en centimètres")).toHaveValue("140");
  await expect(stages.getByRole("button", { name: "Nouveau-né" })).toHaveAttribute("aria-pressed", "true");
});