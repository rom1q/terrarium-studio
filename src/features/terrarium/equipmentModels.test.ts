import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getDecorationGeometryProfile } from "../../domain/decorationGeometry";
import type { Decoration } from "../../domain/projectLogic";
import { createHeatLampModel, createPlatformModel, createUvbModel } from "./equipmentModels";

const glow = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
const grain = glow;
const frame = new THREE.MeshStandardMaterial();

function solidBounds(model: THREE.Object3D) {
  const box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) box.union(new THREE.Box3().setFromObject(object, true));
  });
  return box;
}

describe("equipment models", () => {
  const cases: [Decoration["kind"], string | undefined, THREE.Object3D][] = [
    ["Plateforme", "Plateforme en bois", createPlatformModel("Plateforme en bois", grain, grain)],
    ["Plateforme", "Plateau en liège", createPlatformModel("Plateau en liège", grain, grain)],
    ["Lampe chauffante", undefined, createHeatLampModel(frame, glow)],
    ["Tube UVB", undefined, createUvbModel(frame, glow)],
  ];

  it.each(cases)("keeps the %s %s inside its shared geometry profile", (kind, variant, model) => {
    const decoration = { id: 1, kind, ...(variant ? { variant: variant as Decoration["variant"] } : {}), position: { x: 0, z: 0 } } as Decoration;
    const { bounds } = getDecorationGeometryProfile(decoration, "Tropical");
    const box = solidBounds(model);
    const tolerance = 0.002;

    expect(box.min.x).toBeGreaterThanOrEqual(-bounds.halfWidth - tolerance);
    expect(box.max.x).toBeLessThanOrEqual(bounds.halfWidth + tolerance);
    expect(box.min.z).toBeGreaterThanOrEqual(-bounds.halfDepth - tolerance);
    expect(box.max.z).toBeLessThanOrEqual(bounds.halfDepth + tolerance);
    expect(box.min.y).toBeGreaterThanOrEqual(bounds.minY - tolerance);
    expect(box.max.y).toBeLessThanOrEqual(bounds.maxY + tolerance);
  });

  it("builds a wooden platform from separate planks and a cork one as a single slab", () => {
    const wood = createPlatformModel("Plateforme en bois", grain, grain);
    const cork = createPlatformModel("Plateau en liège", grain, grain);

    expect(wood.children.length).toBeGreaterThan(cork.children.length);
    expect(wood.children.filter((child) => child instanceof THREE.Mesh && child.geometry.type === "BoxGeometry").length).toBeGreaterThanOrEqual(9);
  });

  it("lights the heat lamp and UVB tube with additive glow sprites", () => {
    for (const model of [createHeatLampModel(frame, glow), createUvbModel(frame, glow)]) {
      const sprites = model.children.filter((child) => child instanceof THREE.Sprite) as THREE.Sprite[];

      expect(sprites).toHaveLength(1);
      expect(sprites[0].material.blending).toBe(THREE.AdditiveBlending);
    }
  });
});
