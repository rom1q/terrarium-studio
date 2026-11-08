import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { plantCatalog } from "../../data/plantCatalog";
import { createPlantModel } from "./plantModels";

describe("species-specific plant models", () => {
  it("creates a distinct non-empty model for each catalog profile", () => {
    const models = plantCatalog.map((profile) => createPlantModel(profile.visual, profile.visualVariant, 0x65804b));
    const signatures = models.map((model) => {
      const geometryCounts = new Map<string, number>();
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry.type;
        geometryCounts.set(geometry, (geometryCounts.get(geometry) ?? 0) + 1);
      });
      return JSON.stringify({ scale: model.scale.toArray(), geometryCounts: [...geometryCounts].sort() });
    });

    expect(models).toHaveLength(12);
    expect(models.every((model) => model.children.length > 0)).toBe(true);
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(10);
  });

  it("keeps generic visual styles available without a botanical profile", () => {
    const fern = createPlantModel(undefined, "Fougère", 0x65804b);
    const rosette = createPlantModel(undefined, "Rosette", 0x65804b);
    const foliage = createPlantModel(undefined, "Feuillage dense", 0x65804b);

    expect(fern.children.length).toBeGreaterThan(rosette.children.length);
    expect(new Set([fern.scale.y, rosette.scale.y, foliage.scale.y]).size).toBeGreaterThan(1);
  });

  it("uses distinct natural leaf tones in the same model", () => {
    const fern = createPlantModel(undefined, "Fougère", 0x65804b);
    const leafColors = new Set<number>();
    fern.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      if (object.material.side === THREE.DoubleSide) leafColors.add(object.material.color.getHex());
    });

    expect(leafColors.size).toBeGreaterThan(1);
  });
});