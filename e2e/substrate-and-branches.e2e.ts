import { expect, test } from "@playwright/test";

test("substrate choices follow the biotope and appear in the report", async ({ page }) => {
  await page.goto("/");
  const options = page.locator(".substrate-option");

  await expect(options).toHaveText(["Sable fin", "Mélange sable-argile", "Gravier fin", "Argile rouge"]);
  await options.filter({ hasText: "Argile rouge" }).click();
  await expect(options.filter({ hasText: "Argile rouge" })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Espèce de reptile ou amphibien").selectOption({ label: "Correlophus ciliatus · Gecko à crête" });
  await page.locator(".biotope-option").filter({ hasText: "Tropical" }).click();
  await expect(options).toHaveText(["Terreau tropical", "Fibre de coco", "Écorce de pin", "Mousse sphaigne"]);
  await expect(options.first()).toHaveAttribute("aria-pressed", "true");

  await options.filter({ hasText: "Écorce de pin" }).click();
  await page.getByRole("button", { name: "Voir le rapport" }).click();
  const report = page.getByRole("dialog", { name: "Habitat sans titre" });
  await expect(report.locator(".report-facts div").filter({ hasText: "Substrat" })).toContainText("Écorce de pin");
});

test("substrate guidance cites the species reference and flags risky choices", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Espèce de reptile ou amphibien").selectOption({ label: "Correlophus ciliatus · Gecko à crête" });
  await page.locator(".biotope-option").filter({ hasText: "Tropical" }).click();
  const guidance = page.getByRole("status", { name: "Repère substrat" });

  await expect(guidance).toContainText("Repère favorable");
  await expect(guidance).toContainText("60 % terreau organique");
  await page.locator(".substrate-option").filter({ hasText: "Écorce de pin" }).click();
  await expect(guidance).toContainText("À éviter selon la référence");
  await expect(guidance).toContainText("cèdre");
  await expect(page.getByRole("link", { name: /Substrate Options/ })).toBeVisible();

  await page.locator(".substrate-option").filter({ hasText: "Mousse sphaigne" }).click();
  await expect(guidance).toContainText("non documenté");
});

test("every branch pattern can be chosen for a branch", async ({ page }) => {
  await page.goto("/");
  const branch = page.locator(".decor-item").filter({ hasText: "Branche · Branche fourchue" });
  const type = branch.getByLabel("Type de Branche");

  await expect(type.locator("option")).toHaveText(["Branche droite", "Branche fourchue", "Branche tortueuse", "Bois flotté", "Liane", "Racine de mangrove"]);
  await type.selectOption("Racine de mangrove");
  await expect(page.locator(".decor-item").filter({ hasText: "Branche · Racine de mangrove" })).toHaveCount(1);
});
