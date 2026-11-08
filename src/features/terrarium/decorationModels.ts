import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { rockGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant } from "../../domain/projectLogic";
import { fbm, noise3 } from "./proceduralNoise";
import { sculpt } from "./sculpt";

type RockVariant = Extract<DecorationVariant, "Roche anguleuse" | "Galet" | "Stratifiée">;

function createFacetedGeometry(seed: number, baseColor: number) {
  const sourceGeometry = new THREE.IcosahedronGeometry(0.32, 2);
  sourceGeometry.deleteAttribute("normal");
  sourceGeometry.deleteAttribute("uv");
  const geometry = mergeVertices(sourceGeometry, 1e-4);
  sourceGeometry.dispose();
  geometry.computeVertexNormals();
  const base = new THREE.Color(baseColor);
  const offsetX = seed * 3.1;
  const offsetY = seed * 1.3;
  const offsetZ = seed * 1.7;
  // Horizontal growth is capped (and the vertical axis only shrinks) so every rotation stays inside the shared bounds.
  sculpt(geometry, (position, normal, color) => {
    const lumps = fbm(position.x * 4 + offsetX, position.y * 4 + offsetY, position.z * 4 + offsetZ);
    const factor = 0.7 + lumps * 0.45;
    const delta = new THREE.Vector3(position.x * (factor - 1), position.y * (Math.min(factor, 1) - 1), position.z * (factor - 1));
    const length = delta.length();
    const strata = fbm(position.x * 2 + offsetX, position.y * 7, position.z * 2 + offsetZ);
    color.copy(base).multiplyScalar(0.74 + strata * 0.42 + THREE.MathUtils.clamp(position.y, -0.32, 0.32) * 0.35);
    if (length < 1e-6) return 0;
    normal.copy(delta).divideScalar(length);
    return length;
  });
  return geometry;
}

function createPebbleGeometry(radius: number, seed: number, baseColor: number) {
  const geometry = new THREE.SphereGeometry(radius, 32, 20);
  const base = new THREE.Color(baseColor);
  const offset = seed * 2.3;
  sculpt(geometry, (position, normal, color) => {
    const lumps = fbm(position.x * 5 + offset, position.y * 5, position.z * 5 + offset);
    const speckle = noise3(position.x * 26 + offset, position.y * 26, position.z * 26);
    color.copy(base).multiplyScalar(0.88 + lumps * 0.2 + (speckle > 0.72 ? -0.14 : 0));
    normal.copy(position).normalize();
    return -(1 - lumps) * 0.03;
  });
  return geometry;
}

function createStrataGeometry(layer: { topRadius: number; bottomRadius: number; height: number }, baseColor: number, seed: number) {
  const geometry = new THREE.CylinderGeometry(layer.topRadius, layer.bottomRadius, layer.height, 24, 3);
  const base = new THREE.Color(baseColor);
  const offset = seed * 1.9;
  sculpt(geometry, (position, normal, color) => {
    const lumps = fbm(position.x * 5 + offset, position.y * 9, position.z * 5);
    color.copy(base).multiplyScalar(0.8 + lumps * 0.4);
    const radial = Math.hypot(position.x, position.z);
    if (radial < 1e-4) return 0;
    normal.set(position.x / radial, 0, position.z / radial);
    return -(0.01 + lumps * lumps * 0.07);
  });
  return geometry;
}

export function createRockModel(variant: RockVariant, seed = 0, surfaceNoise?: THREE.Texture): THREE.Group {
  const rock = new THREE.Group();
  const surfaceRelief = surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.065 } : {};

  if (variant === "Galet") {
    const profile = rockGeometryProfiles.pebble;
    const pebble = new THREE.Mesh(
      createPebbleGeometry(profile.radius, seed, seed % 2 ? 0xaaa18f : 0x918b80),
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88, ...surfaceRelief }),
    );
    pebble.scale.set(profile.scale[0], profile.scale[1], profile.scale[2]);
    rock.add(pebble);
    return rock;
  }

  if (variant === "Stratifiée") {
    rockGeometryProfiles.stratified.layers.forEach((layer, index) => {
      const mesh = new THREE.Mesh(
        createStrataGeometry(layer, index === 1 && seed % 2 ? 0x9d9385 : layer.color, seed + index),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.96,
          flatShading: true,
          ...surfaceRelief,
        }),
      );
      mesh.position.y = layer.y;
      mesh.rotation.y = index * 0.18;
      rock.add(mesh);
    });
    return rock;
  }

  const profile = rockGeometryProfiles.angular;
  const baseColor = seed % 2 ? 0x80796d : 0x978875;
  const body = new THREE.Mesh(
    createFacetedGeometry(seed, baseColor),
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.98, flatShading: true, ...surfaceRelief }),
  );
  body.scale.set(profile.scale[0], profile.scale[1], profile.scale[2]);
  body.rotation.y = seed % 3 * 0.22;
  rock.add(body);
  return rock;
}