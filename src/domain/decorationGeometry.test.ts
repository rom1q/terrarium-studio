import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { plantCatalog } from "../data/plantCatalog";
import { createRockModel } from "../features/terrarium/decorationModels";
import { createHideModel } from "../features/terrarium/hideModels";
import { createPlantModel } from "../features/terrarium/plantModels";
import { getDecorationGeometryProfile } from "./decorationGeometry";
import type { Decoration } from "./projectLogic";

function expectWithinProfile(model: THREE.Object3D, profile: ReturnType<typeof getDecorationGeometryProfile>, label: string) {
  const actual = new THREE.Box3().setFromObject(model);
  const { bounds } = profile;
  const tolerance = 0.002;

  expect(actual.min.x, `${label} minX`).toBeGreaterThanOrEqual(-bounds.halfWidth - tolerance);
  expect(actual.max.x, `${label} maxX`).toBeLessThanOrEqual(bounds.halfWidth + tolerance);
  expect(actual.min.y, `${label} minY`).toBeGreaterThanOrEqual(bounds.minY - tolerance);
  expect(actual.max.y, `${label} maxY`).toBeLessThanOrEqual(bounds.maxY + tolerance);
  expect(actual.min.z, `${label} minZ`).toBeGreaterThanOrEqual(-bounds.halfDepth - tolerance);
  expect(actual.max.z, `${label} maxZ`).toBeLessThanOrEqual(bounds.halfDepth + tolerance);
}

describe("shared decoration geometry profiles", () => {
  it("anchors height-zero objects to the substrate for every supported size", () => {
    const decorations: Decoration[] = [
      { id: 1, kind: "Plante", position: { x: 0, z: 0 } },
      { id: 2, kind: "Roche", variant: "Roche anguleuse", position: { x: 0, z: 0 } },
      { id: 3, kind: "Roche", variant: "Galet", position: { x: 0, z: 0 } },
      { id: 4, kind: "Cachette", variant: "Grotte", position: { x: 0, z: 0 } },
      { id: 5, kind: "Cachette", variant: "Tronc creux", position: { x: 0, z: 0 } },
      { id: 6, kind: "Branche", variant: "Branche droite", position: { x: 0, z: 0 } },
      { id: 7, kind: "Plateforme", position: { x: 0, z: 0 } },
      { id: 8, kind: "Gamelle", position: { x: 0, z: 0 } },
      { id: 9, kind: "Lampe chauffante", position: { x: 0, z: 0 } },
      { id: 10, kind: "Tube UVB", position: { x: 0, z: 0 } },
    ];

    decorations.forEach((decoration) => {
      const profile = getDecorationGeometryProfile(decoration, "Désertique");
      [0.5, 1, 1.5].forEach((sizeScale) => {
        expect((profile.rootOffsetY + profile.bounds.minY) * sizeScale, `${decoration.kind} at ${sizeScale * 100}%`).toBeCloseTo(0, 5);
      });
    });
  });

  it("contain every catalog plant model after profile scaling", () => {
    for (const plant of plantCatalog) {
      const decoration = { id: 1, kind: "Plante" as const, plantSpeciesId: plant.id, variant: plant.visualVariant, position: { x: 0, z: 0 } };
      const model = createPlantModel(plant.visual, plant.visualVariant, 0x65804b);
      expectWithinProfile(model, getDecorationGeometryProfile(decoration, "Désertique"), plant.id);
    }
  });

  it("contain rotated rock variants and every hide model in their shared profiles", () => {
    const rocks = ["Roche anguleuse", "Galet", "Stratifiée"] as const;
    rocks.forEach((variant, index) => {
      const decoration = { id: index + 1, kind: "Roche" as const, variant, position: { x: 0, z: 0 } };
      const model = createRockModel(variant, index + 1);
      expectWithinProfile(model, getDecorationGeometryProfile(decoration, "Désertique"), variant);
    });

    const hides = ["Grotte", "Tronc creux", "Écorce creuse"] as const;
    hides.forEach((variant, index) => {
      const decoration = { id: index + 1, kind: "Cachette" as const, variant, position: { x: 0, z: 0 } };
      expectWithinProfile(createHideModel(variant), getDecorationGeometryProfile(decoration, "Désertique"), variant);
    });
  });
});