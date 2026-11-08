import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { rockGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant } from "../../domain/projectLogic";

type RockVariant = Extract<DecorationVariant, "Roche anguleuse" | "Galet" | "Stratifiée">;

function createFacetedGeometry(seed: number, baseColor: number) {
  const sourceGeometry = new THREE.IcosahedronGeometry(0.32, 1);
  sourceGeometry.deleteAttribute("normal");
  const geometry = mergeVertices(sourceGeometry, 1e-4);
  sourceGeometry.dispose();
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const faceColor = new THREE.Color(baseColor);
  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
    const x = positions.getX(vertexIndex);
    const y = positions.getY(vertexIndex);
    const z = positions.getZ(vertexIndex);
    const noise = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
    const variation = noise - Math.floor(noise);
    const jitter = 1 + (variation - 0.5) * 0.08;
    positions.setXYZ(vertexIndex, x * jitter, y, z * jitter);
    faceColor.setHex(baseColor).multiplyScalar(0.86 + variation * 0.22);
    colors[vertexIndex * 3] = faceColor.r;
    colors[vertexIndex * 3 + 1] = faceColor.g;
    colors[vertexIndex * 3 + 2] = faceColor.b;
  }
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createRockModel(variant: RockVariant, seed = 0, surfaceNoise?: THREE.Texture): THREE.Group {
  const rock = new THREE.Group();
  const surfaceRelief = surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.065 } : {};

  if (variant === "Galet") {
    const profile = rockGeometryProfiles.pebble;
    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(profile.radius, 24, 16),
      new THREE.MeshStandardMaterial({ color: seed % 2 ? 0xaaa18f : 0x918b80, roughness: 0.88, ...surfaceRelief }),
    );
    pebble.scale.set(profile.scale[0], profile.scale[1], profile.scale[2]);
    rock.add(pebble);
    return rock;
  }

  if (variant === "Stratifiée") {
    rockGeometryProfiles.stratified.layers.forEach((layer, index) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(layer.topRadius, layer.bottomRadius, layer.height, 12),
        new THREE.MeshStandardMaterial({
          color: index === 1 && seed % 2 ? 0x9d9385 : layer.color,
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
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.98, ...surfaceRelief }),
  );
  body.scale.set(profile.scale[0], profile.scale[1], profile.scale[2]);
  body.rotation.y = seed % 3 * 0.22;
  rock.add(body);
  return rock;
}