import { expect, test } from "@playwright/test";

test("a named checkpoint survives reload and restores the project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Votre habitat" })).toBeVisible();

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

test("a crested gecko hatchling uses its sourced stage profile", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Espèce de reptile ou amphibien").selectOption({ label: "Correlophus ciliatus · Gecko à crête" });

  const stages = page.getByRole("group", { name: "Stade de vie" });
  await stages.getByRole("button", { name: "Nouveau-né" }).click();
  await expect(stages.getByRole("button", { name: "Nouveau-né" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/ne doit pas dépasser 29 °C/)).toBeVisible();
  await expect(page.getByText(/Aucune plage de mesure chiffrée vérifiée pour nouveau-né/)).toBeVisible();

  await page.getByRole("button", { name: "Voir le rapport" }).click();
  const report = page.getByRole("dialog", { name: "Habitat sans titre" });
  await expect(report.getByText("Nouveau-né", { exact: true })).toBeVisible();

  const dimensionCheck = report.locator(".report-check").filter({ hasText: "Dimensions minimales" });
  await expect(dimensionCheck).toContainText("min. 30.48 × 30.48 × 30.48 cm");
  await expect(dimensionCheck).toContainText("Profil ReptiFiles pour hatchling de moins de 12 g.");
  await expect(report.getByRole("link", { name: /Enclosure Size & Cohabitation/ })).toBeVisible();
  await expect(report.getByRole("link", { name: /Lighting, Heating & Humidity/ })).toBeVisible();
});