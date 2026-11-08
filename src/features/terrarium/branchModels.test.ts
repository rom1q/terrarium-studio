import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { branchPatterns, type BranchVariant } from "../../domain/branchPatterns";
import { getDecorationGeometryProfile } from "../../domain/decorationGeometry";
import { decorationVariants } from "../../domain/projectLogic";
import { createBranchModel } from "./branchModels";

const variants = Object.keys(branchPatterns) as BranchVariant[];

describe("branch patterns", () => {
  it("exposes every pattern as a selectable branch variant", () => {
    expect([...decorationVariants.Branche].sort()).toEqual([...variants].sort());
    expect(variants.length).toBeGreaterThanOrEqual(6);
  });

  it("builds a distinct, finite model for each pattern", () => {
    const signatures = new Set<string>();
    for (const variant of variants) {
      const model = createBranchModel(variant);
      const box = new THREE.Box3().setFromObject(model, true);
      const size = box.getSize(new THREE.Vector3());

      expect(box.min.toArray().concat(box.max.toArray()).every(Number.isFinite), variant).toBe(true);
      expect(size.x + size.y + size.z, variant).toBeGreaterThan(0.6);
      signatures.add(`${model.children.length}:${size.toArray().map((value) => value.toFixed(2)).join(",")}`);
    }

    expect(signatures.size).toBe(variants.length);
  });

  it("keeps each model inside its shared geometry profile and on the ground", () => {
    for (const variant of variants) {
      const model = createBranchModel(variant);
      const { bounds } = getDecorationGeometryProfile({ id: 1, kind: "Branche", variant, position: { x: 0, z: 0 } }, "Tropical");
      const box = new THREE.Box3().setFromObject(model, true);
      const tolerance = 0.002;

      expect(box.min.x, `${variant} minX`).toBeGreaterThanOrEqual(-bounds.halfWidth - tolerance);
      expect(box.max.x, `${variant} maxX`).toBeLessThanOrEqual(bounds.halfWidth + tolerance);
      expect(box.min.z, `${variant} minZ`).toBeGreaterThanOrEqual(-bounds.halfDepth - tolerance);
      expect(box.max.z, `${variant} maxZ`).toBeLessThanOrEqual(bounds.halfDepth + tolerance);
      expect(box.min.y, `${variant} minY`).toBeGreaterThanOrEqual(bounds.minY - tolerance);
      expect(box.max.y, `${variant} maxY`).toBeLessThanOrEqual(bounds.maxY + tolerance);
      expect(box.min.y - bounds.minY, `${variant} rests on the substrate`).toBeLessThan(0.03);
    }
  });

  it("falls back to the forked branch for an unknown variant", () => {
    expect(createBranchModel(undefined).children).toHaveLength(branchPatterns["Branche fourchue"].paths.length);
  });
});
