import * as THREE from "three";
import type { DecorationVariant } from "../../domain/projectLogic";

type RockVariant = Extract<DecorationVariant, "Roche anguleuse" | "Galet" | "Stratifiée">;

function createFacetedGeometry(seed: number, baseColor: number) {
  const geometry = new THREE.DodecahedronGeometry(0.32, 0);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  const third = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const faceColor = new THREE.Color(baseColor);

  for (let faceIndex = 0; faceIndex < positions.count / 3; faceIndex += 1) {
    const vertexIndex = faceIndex * 3;
    first.fromBufferAttribute(positions, vertexIndex);
    second.fromBufferAttribute(positions, vertexIndex + 1);
    third.fromBufferAttribute(positions, vertexIndex + 2);
    normal.subVectors(second, first).cross(new THREE.Vector3().subVectors(third, first)).normalize();
    const variation = 0.82 + ((faceIndex * 17 + seed * 11) % 9) * 0.035;
    const lighting = normal.y > 0.45 ? 1.08 : normal.y < -0.35 ? 0.78 : 0.94;
    faceColor.setHex(baseColor).multiplyScalar(variation * lighting);

    for (let corner = 0; corner < 3; corner += 1) {
      const colorIndex = (vertexIndex + corner) * 3;
      colors[colorIndex] = faceColor.r;
      colors[colorIndex + 1] = faceColor.g;
      colors[colorIndex + 2] = faceColor.b;
    }
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createRockModel(variant: RockVariant, seed = 0): THREE.Group {
  const rock = new THREE.Group();

  if (variant === "Galet") {
    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 24, 16),
      new THREE.MeshStandardMaterial({ color: seed % 2 ? 0xaaa18f : 0x918b80, roughness: 0.72 }),
    );
    pebble.scale.set(1.25, 0.72, 0.95);
    rock.add(pebble);
    return rock;
  }

  if (variant === "Stratifiée") {
    const layers = [
      { color: 0x655f57, y: -0.1, height: 0.12, topRadius: 0.28, bottomRadius: 0.37 },
      { color: 0xc3b79f, y: 0, height: 0.075, topRadius: 0.39, bottomRadius: 0.3 },
      { color: 0x91877a, y: 0.09, height: 0.095, topRadius: 0.27, bottomRadius: 0.35 },
    ] as const;

    layers.forEach((layer, index) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(layer.topRadius, layer.bottomRadius, layer.height, 12),
        new THREE.MeshStandardMaterial({
          color: index === 1 && seed % 2 ? 0x9d9385 : layer.color,
          roughness: 0.96,
          flatShading: true,
        }),
      );
      mesh.position.y = layer.y;
      mesh.rotation.y = index * 0.18;
      rock.add(mesh);
    });
    return rock;
  }

  const baseColor = seed % 2 ? 0x80796d : 0x978875;
  const body = new THREE.Mesh(
    createFacetedGeometry(seed, baseColor),
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.98, flatShading: true }),
  );
  body.scale.set(1.2, 0.82, 0.95);
  body.rotation.y = seed % 3 * 0.22;
  rock.add(body);
  return rock;
}