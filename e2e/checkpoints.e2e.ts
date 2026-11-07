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