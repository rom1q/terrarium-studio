import * as THREE from "three";
import { getBranchPattern, sampleBranchPath, type BranchPath, type BranchStyle } from "../../domain/branchPatterns";
import type { DecorationVariant } from "../../domain/projectLogic";
import { noise3 } from "./proceduralNoise";

const RADIAL_SEGMENTS = 12;
const CUT_WOOD = new THREE.Color(0xc79f6c);

// Grooves only cut inward, so every tube stays inside the bounds computed from the same samples.
function createBranchTube(path: BranchPath, style: BranchStyle, seed: number) {
  const samples = sampleBranchPath(path);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const base = new THREE.Color(style.color);
  const groove = new THREE.Color(style.grooveColor);
  const color = new THREE.Color();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const rings: THREE.Vector3[][] = [];
  const ringColors: THREE.Color[][] = [];
  const first = new THREE.Vector3(...samples[0].tangent);
  const helper = Math.abs(first.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  normal.crossVectors(first, helper).normalize();
  let travelled = 0;

  samples.forEach((sample, index) => {
    tangent.set(...sample.tangent);
    centre.set(...sample.position);
    if (index > 0) {
      travelled += centre.distanceTo(new THREE.Vector3(...samples[index - 1].position));
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    }
    binormal.crossVectors(tangent, normal).normalize();
    const ring: THREE.Vector3[] = [];
    const colorRing: THREE.Color[] = [];
    for (let segment = 0; segment <= RADIAL_SEGMENTS; segment += 1) {
      const angle = segment / RADIAL_SEGMENTS * Math.PI * 2;
      const spiral = angle + travelled * style.twist;
      const coarse = noise3(Math.cos(spiral) * style.ridges + seed, Math.sin(spiral) * style.ridges, travelled * 3.5);
      const fine = noise3(Math.cos(spiral) * style.ridges * 2.7 + seed, Math.sin(spiral) * style.ridges * 2.7, travelled * 9);
      const ridge = coarse * 0.7 + fine * 0.3;
      const depth = 1 - THREE.MathUtils.smoothstep(ridge, 0.3, 0.65);
      const swell = 1 - 0.12 * noise3(travelled * 2.2 + seed, seed * 0.7, 3.1);
      const radius = sample.radius * swell * (1 - style.grooveDepth * depth);
      ring.push(centre.clone().addScaledVector(normal, Math.cos(angle) * radius).addScaledVector(binormal, Math.sin(angle) * radius));
      colorRing.push(color.copy(groove).lerp(base, 1 - depth * 0.85).multiplyScalar(0.88 + fine * 0.24).clone());
      uvs.push(segment / RADIAL_SEGMENTS, travelled * 1.5);
    }
    rings.push(ring);
    ringColors.push(colorRing);
  });

  rings.forEach((ring, ringIndex) => ring.forEach((vertex, segment) => {
    positions.push(vertex.x, vertex.y, vertex.z);
    const tint = ringColors[ringIndex][segment];
    colors.push(tint.r, tint.g, tint.b);
  }));
  const stride = RADIAL_SEGMENTS + 1;
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const a = ringIndex * stride + segment;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const addCap = (ringIndex: number) => {
    const capCentre = new THREE.Vector3(...samples[ringIndex].position);
    const capStart = positions.length / 3;
    positions.push(capCentre.x, capCentre.y, capCentre.z);
    colors.push(CUT_WOOD.r, CUT_WOOD.g, CUT_WOOD.b);
    uvs.push(0.5, 0.5);
    rings[ringIndex].forEach((vertex) => {
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(CUT_WOOD.r * 0.8, CUT_WOOD.g * 0.8, CUT_WOOD.b * 0.8);
      uvs.push(0.5, 0.5);
    });
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) indices.push(capStart, capStart + 1 + segment, capStart + 2 + segment);
  };
  addCap(0);
  addCap(rings.length - 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBranchModel(variant: DecorationVariant | undefined, grainTexture?: THREE.Texture): THREE.Group {
  const pattern = getBranchPattern(variant);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: pattern.style.roughness,
    side: THREE.DoubleSide,
    ...(grainTexture ? { bumpMap: grainTexture, bumpScale: 0.05 } : {}),
  });
  const branch = new THREE.Group();
  pattern.paths.forEach((path, index) => branch.add(new THREE.Mesh(createBranchTube(path, pattern.style, index * 7.3 + 1.7), material)));
  return branch;
}
