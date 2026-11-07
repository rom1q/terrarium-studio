import * as THREE from "three";
import { describe, expect, it } from "vitest";
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
});