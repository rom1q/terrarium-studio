import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { rockGeometryProfiles } from "../../domain/decorationGeometry";
import { createRockModel } from "./decorationModels";

describe("createRockModel", () => {
  it("uses distinct geometry and material treatments for each rock variant", () => {
    const angular = createRockModel("Roche anguleuse", 1);
    const pebble = createRockModel("Galet", 1);
    const layered = createRockModel("Stratifiée", 1);

    expect(angular.children).toHaveLength(1);
    expect((angular.children[0] as THREE.Mesh).geometry.getAttribute("color")).toBeDefined();
    expect(((angular.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    expect(pebble.children).toHaveLength(1);
    expect((pebble.children[0] as THREE.Mesh).geometry.type).toBe("SphereGeometry");
    expect(layered.children).toHaveLength(3);
    expect(layered.children.every((child) => (child as THREE.Mesh).geometry.type === "CylinderGeometry")).toBe(true);
    expect(new Set(layered.children.map((child) => (child as THREE.Mesh).material)).size).toBe(3);
    expect(new Set([angular.children[0], pebble.children[0], layered.children[0]].map((child) => (child as THREE.Mesh).geometry.type)).size).toBe(3);
  });

  it("keeps a visible footprint when vertically offset", () => {
    const rock = createRockModel("Stratifiée");
    const bounds = new THREE.Box3().setFromObject(rock);
    const size = bounds.getSize(new THREE.Vector3());

    expect(size.x).toBeGreaterThan(0.7);
    expect(size.y).toBeGreaterThan(0.2);
    expect(size.z).toBeGreaterThan(0.5);
  });

  it("varies angular rock silhouettes deterministically while keeping their bounds", () => {
    const rocks = Array.from({ length: 20 }, (_, index) => createRockModel("Roche anguleuse", index + 1));
    const vertices = (rock: THREE.Group) => ((rock.children[0] as THREE.Mesh).geometry.getAttribute("position").array);

    expect(new Set(rocks.map((rock) => Array.from(vertices(rock)).join(","))).size).toBe(rocks.length);
    expect(Array.from(vertices(rocks[3]))).toEqual(Array.from(vertices(createRockModel("Roche anguleuse", 4))));
    for (const rock of rocks) {
      const bounds = new THREE.Box3().setFromObject(rock);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-rockGeometryProfiles.angular.bounds.halfWidth);
      expect(bounds.max.x).toBeLessThanOrEqual(rockGeometryProfiles.angular.bounds.halfWidth);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-rockGeometryProfiles.angular.bounds.halfDepth);
      expect(bounds.max.z).toBeLessThanOrEqual(rockGeometryProfiles.angular.bounds.halfDepth);
    }
  });

  it("applies a shared surface relief texture to every rock variant", () => {
    const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);

    for (const variant of ["Roche anguleuse", "Galet", "Stratifiée"] as const) {
      const rock = createRockModel(variant, 1, texture);
      rock.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        expect((object.material as THREE.MeshStandardMaterial).bumpMap).toBe(texture);
      });
    }
  });
});