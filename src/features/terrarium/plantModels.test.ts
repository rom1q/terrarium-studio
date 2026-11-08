import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { plantCatalog } from "../../data/plantCatalog";
import { createPlantModel, getPlantSway } from "./plantModels";

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
    let fernLeafInstances = 0;
    fern.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) fernLeafInstances += object.count;
    });

    expect(fernLeafInstances).toBeGreaterThan(80);
    expect(rosette.children.length).toBeGreaterThan(0);
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

  it("uses pointed leaf geometry with a curved surface", () => {
    const fern = createPlantModel(undefined, "Fougère", 0x65804b);
    let leafGeometry: THREE.BufferGeometry | undefined;
    fern.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry.type === "BufferGeometry") leafGeometry ??= object.geometry;
    });

    expect(leafGeometry).toBeDefined();
    expect(leafGeometry?.getAttribute("position").count).toBeGreaterThan(80);
    expect(leafGeometry?.getIndex()?.count).toBeGreaterThan(300);
    expect(leafGeometry?.getAttribute("uv").count).toBe(leafGeometry?.getAttribute("position").count);
    let leafMaterial: THREE.MeshPhysicalMaterial | undefined;
    fern.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry === leafGeometry) leafMaterial = object.material as THREE.MeshPhysicalMaterial;
    });
    expect(leafMaterial?.map).toBeDefined();
    expect(leafMaterial?.bumpMap).toBe(leafMaterial?.map);
    expect(leafMaterial?.sheen).toBeGreaterThan(0);
  });

  it("adds subtle central veins to broad rosette leaves", () => {
    const rosette = createPlantModel(undefined, "Rosette", 0x65804b);
    let veinCount = 0;
    rosette.traverse((object) => {
      if (object instanceof THREE.Line) veinCount += 1;
    });

    expect(veinCount).toBeGreaterThan(0);
  });

  it("keeps plant wind subtle, bounded, and deterministic", () => {
    const first = getPlantSway(4.2, 1.7);

    expect(getPlantSway(4.2, 1.7)).toEqual(first);
    expect(Math.abs(first.rotationX)).toBeLessThanOrEqual(0.012);
    expect(Math.abs(first.rotationZ)).toBeLessThanOrEqual(0.024);
  });
});