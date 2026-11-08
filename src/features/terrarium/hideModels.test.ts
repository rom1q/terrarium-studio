import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createHideModel } from "./hideModels";

describe("createHideModel", () => {
  it("creates a through-opening for the cave and open-ended shells for wood hides", () => {
    const cave = createHideModel("Grotte");
    const trunk = createHideModel("Tronc creux");
    const bark = createHideModel("Écorce creuse");
    const caveGeometry = (cave.children[0] as THREE.Mesh).geometry as THREE.ExtrudeGeometry;
    const meshes = (root: THREE.Object3D) => {
      const result: THREE.Mesh[] = [];
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) result.push(child as THREE.Mesh);
      });
      return result;
    };
    const trunkTubes = meshes(trunk).filter((mesh) => mesh.geometry.type === "CylinderGeometry");
    const barkShells = meshes(bark).filter((mesh) => mesh.geometry.type === "CylinderGeometry");
    const caveShape = caveGeometry.parameters.shapes;

    expect(Array.isArray(caveShape) ? caveShape[0].holes : caveShape.holes).toHaveLength(1);
    expect(trunkTubes).toHaveLength(2);
    expect(trunkTubes.every((child) => (child.geometry as THREE.CylinderGeometry).parameters.openEnded)).toBe(true);
    expect(barkShells).toHaveLength(2);
    expect(barkShells.every((child) => (child.geometry as THREE.CylinderGeometry).parameters.openEnded)).toBe(true);
    expect((barkShells[0].geometry as THREE.CylinderGeometry).parameters.thetaLength).toBeCloseTo(Math.PI);
  });

  it("keeps all hide entrances clear through vertical stacking and rotation", () => {
    for (const variant of ["Grotte", "Tronc creux", "Écorce creuse"] as const) {
      const hide = createHideModel(variant);
      hide.position.set(0.3, 0.6, -0.2);
      hide.rotation.y = Math.PI / 2;
      const bounds = new THREE.Box3().setFromObject(hide);
      const size = bounds.getSize(new THREE.Vector3());

      expect(hide.position.y).toBe(0.6);
      expect(size.x).toBeGreaterThan(0.6);
      expect(size.y).toBeGreaterThan(variant === "Écorce creuse" ? 0.3 : 0.5);
      expect(size.z).toBeGreaterThan(0.5);
    }
  });

  it("applies surface relief to stone and bark exteriors", () => {
    const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);

    for (const variant of ["Grotte", "Tronc creux", "Écorce creuse"] as const) {
      const hide = createHideModel(variant, texture);
      const exteriorMeshes: THREE.Mesh[] = [];
      hide.traverse((object) => {
        if (object instanceof THREE.Mesh) exteriorMeshes.push(object);
      });

      const material = exteriorMeshes[0].material as THREE.MeshStandardMaterial;
      expect(material.bumpMap).toBe(texture);
      expect(material.bumpScale).toBeGreaterThanOrEqual(0.055);
    }
  });
});