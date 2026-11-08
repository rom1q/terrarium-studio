import * as THREE from "three";
import type { SubstrateProfile, SubstrateTexture } from "../../domain/substrates";

function hash(x: number, y: number, seed: number) {
  let value = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263) + Math.imul(seed + 1, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

const wrap = (value: number, period: number) => ((value % period) + period) % period;

// Value noise that repeats every `period` cells so the texture tiles without seams.
function periodicNoise(u: number, v: number, period: number, seed: number) {
  const x = u * period;
  const y = v * period;
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fx = x - cellX;
  const fy = y - cellY;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const corner = (dx: number, dy: number) => hash(wrap(cellX + dx, period), wrap(cellY + dy, period), seed);
  const top = corner(0, 0) * (1 - sx) + corner(1, 0) * sx;
  const bottom = corner(0, 1) * (1 - sx) + corner(1, 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

// Nearest and second-nearest feature-point distances on a wrapping grid (cell size is 1 / cells).
function cellular(u: number, v: number, cellsX: number, cellsY: number, seed: number) {
  const x = u * cellsX;
  const y = v * cellsY;
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  let nearest = Infinity;
  let second = Infinity;
  let id = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const gx = wrap(cellX + dx, cellsX);
      const gy = wrap(cellY + dy, cellsY);
      const pointX = cellX + dx + hash(gx, gy, seed);
      const pointY = cellY + dy + hash(gx, gy, seed + 5);
      const distance = Math.hypot(pointX - x, pointY - y);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        id = hash(gx, gy, seed + 9);
      } else if (distance < second) second = distance;
    }
  }
  return { nearest, second, id };
}

function sampleTone(kind: SubstrateTexture, u: number, v: number, pixelHash: number) {
  switch (kind) {
    case "fine-sand": {
      const ripples = periodicNoise(u * 0.5 + v * 0.1, v * 0.5, 6, 1);
      return 0.8 + ripples * 0.2 + (pixelHash - 0.5) * 0.12;
    }
    case "soil": {
      const crumbs = periodicNoise(u, v, 16, 2) * 0.6 + periodicNoise(u, v, 40, 3) * 0.4;
      return 0.58 + crumbs * 0.42 + (pixelHash - 0.5) * 0.08;
    }
    case "gravel": {
      const cell = cellular(u, v, 14, 14, 4);
      const edge = THREE.MathUtils.smoothstep(cell.second - cell.nearest, 0, 0.35);
      return (0.5 + cell.id * 0.4) * (0.55 + 0.45 * edge) + (pixelHash - 0.5) * 0.05;
    }
    case "bark": {
      const chip = cellular(u, v, 9, 22, 6);
      const edge = THREE.MathUtils.smoothstep(chip.second - chip.nearest, 0, 0.3);
      const fibre = periodicNoise(u * 0.5, v, 12, 7);
      return (0.5 + chip.id * 0.35) * (0.6 + 0.4 * edge) * (0.85 + fibre * 0.3) + (pixelHash - 0.5) * 0.05;
    }
    case "moss": {
      const fluff = periodicNoise(u, v, 10, 8) * 0.4 + periodicNoise(u, v, 24, 9) * 0.35 + periodicNoise(u, v, 48, 10) * 0.25;
      return 0.55 + fluff * 0.5 + (pixelHash - 0.5) * 0.1;
    }
  }
}

export function createSubstrateTexture(kind: SubstrateTexture) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tone = THREE.MathUtils.clamp(sampleTone(kind, x / size, y / size, hash(x, y, 11)), 0, 1) * 255;
      const index = (y * size + x) * 4;
      data[index] = tone;
      data[index + 1] = tone;
      data[index + 2] = tone;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// Loose pieces (pebbles, bark chunks, moss tufts) resting on the substrate surface.
export function createSubstrateScatter(profile: SubstrateProfile, width: number, depth: number, surfaceY: number): THREE.InstancedMesh | null {
  const scatter = profile.scatter;
  if (!scatter) return null;
  const count = Math.min(900, Math.round(scatter.density * width * depth / 4.5));
  const geometry = scatter.shape === "chunk"
    ? new THREE.BoxGeometry(1, 0.5, 0.6)
    : scatter.shape === "tuft" ? new THREE.SphereGeometry(1, 6, 4) : new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: scatter.shape !== "tuft" });
  const pieces = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const tint = new THREE.Color();
  for (let index = 0; index < count; index += 1) {
    const size = scatter.size * (0.55 + hash(index, 1, 21) * 0.9);
    const flatten = scatter.shape === "tuft" ? 0.55 : scatter.shape === "chunk" ? 1 : 0.6;
    scale.set(size * (0.8 + hash(index, 2, 21) * 0.5), size * flatten, size * (0.8 + hash(index, 3, 21) * 0.5));
    position.set(
      (hash(index, 4, 21) - 0.5) * (width - 0.1),
      surfaceY + scale.y * 0.3,
      (hash(index, 5, 21) - 0.5) * (depth - 0.1),
    );
    euler.set(scatter.shape === "chunk" ? (hash(index, 6, 21) - 0.5) * 0.4 : 0, hash(index, 7, 21) * Math.PI * 2, scatter.shape === "chunk" ? (hash(index, 8, 21) - 0.5) * 0.4 : 0);
    rotation.setFromEuler(euler);
    pieces.setMatrixAt(index, matrix.compose(position, rotation, scale));
    pieces.setColorAt(index, tint.setHex(scatter.colors[Math.floor(hash(index, 9, 21) * scatter.colors.length)]));
  }
  pieces.instanceMatrix.needsUpdate = true;
  if (pieces.instanceColor) pieces.instanceColor.needsUpdate = true;
  pieces.receiveShadow = true;
  return pieces;
}
