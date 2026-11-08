import * as THREE from "three";
import { hideGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant } from "../../domain/projectLogic";

type HideVariant = Extract<DecorationVariant, "Grotte" | "Tronc creux" | "Écorce creuse">;

function lattice(x: number, y: number, z: number) {
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function noise3(x: number, y: number, z: number) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const cellZ = Math.floor(z);
  const fx = x - cellX;
  const fy = y - cellY;
  const fz = z - cellZ;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const lerpX = (dy: number, dz: number) => lattice(cellX, cellY + dy, cellZ + dz) * (1 - sx) + lattice(cellX + 1, cellY + dy, cellZ + dz) * sx;
  const lerpY = (dz: number) => lerpX(0, dz) * (1 - sy) + lerpX(1, dz) * sy;
  return lerpY(0) * (1 - sz) + lerpY(1) * sz;
}

function fbm(x: number, y: number, z: number) {
  return noise3(x, y, z) * 0.6 + noise3(x * 2.3, y * 2.3, z * 2.3) * 0.3 + noise3(x * 5.1, y * 5.1, z * 5.1) * 0.1;
}

// Moves each vertex along its normal and bakes a per-vertex colour; offsets stay inward so shared bounds hold.
// The callback may overwrite `normal` to choose the displacement direction, e.g. when duplicated vertices must move together.
function sculpt(geometry: THREE.BufferGeometry, shape: (position: THREE.Vector3, normal: THREE.Vector3, color: THREE.Color) => number) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(positions.count * 3);
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    position.fromBufferAttribute(positions, index);
    normal.fromBufferAttribute(normals, index);
    const offset = shape(position, normal, color);
    positions.setXYZ(index, position.x + normal.x * offset, position.y + normal.y * offset, position.z + normal.z * offset);
    colors.set([color.r, color.g, color.b], index * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
}

let sharedWoodRingTexture: THREE.DataTexture | undefined;

function getWoodRingTexture() {
  if (sharedWoodRingTexture) return sharedWoodRingTexture;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x / (size - 1) - 0.5;
      const dy = y / (size - 1) - 0.5;
      const distance = Math.hypot(dx, dy);
      const wobble = noise3(dx * 9, dy * 9, 2.5) * 0.04;
      const ring = 0.5 + 0.5 * Math.sin((distance + wobble) * 190);
      const crack = Math.abs(Math.sin(Math.atan2(dy, dx) * 3 + noise3(dx * 6, dy * 6, 7) * 2)) < 0.025 ? 0.7 : 1;
      const tone = (0.72 + ring * 0.28) * crack;
      const index = (y * size + x) * 4;
      data[index] = 212 * tone;
      data[index + 1] = 165 * tone;
      data[index + 2] = 108 * tone;
      data[index + 3] = 255;
    }
  }
  sharedWoodRingTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  sharedWoodRingTexture.colorSpace = THREE.SRGBColorSpace;
  sharedWoodRingTexture.minFilter = THREE.LinearMipmapLinearFilter;
  sharedWoodRingTexture.magFilter = THREE.LinearFilter;
  sharedWoodRingTexture.generateMipmaps = true;
  sharedWoodRingTexture.needsUpdate = true;
  return sharedWoodRingTexture;
}

function createCaveShell(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.cave;
  const wallSteps = 6;
  const silhouette = new THREE.Shape();
  silhouette.moveTo(-profile.outline.halfWidth, 0);
  for (let step = 1; step <= wallSteps; step += 1) silhouette.lineTo(-profile.outline.halfWidth, profile.outline.shoulderY * step / wallSteps);
  silhouette.quadraticCurveTo(0, profile.outline.topY, profile.outline.halfWidth, profile.outline.shoulderY);
  for (let step = 1; step <= wallSteps; step += 1) silhouette.lineTo(profile.outline.halfWidth, profile.outline.shoulderY * (1 - step / wallSteps));
  silhouette.closePath();

  const entrance = new THREE.Path();
  entrance.moveTo(-profile.entrance.halfWidth, 0.012);
  for (let step = 1; step <= wallSteps; step += 1) entrance.lineTo(-profile.entrance.halfWidth, 0.012 + (profile.entrance.shoulderY - 0.012) * step / wallSteps);
  entrance.quadraticCurveTo(0, profile.entrance.topY, profile.entrance.halfWidth, profile.entrance.shoulderY);
  for (let step = 1; step <= wallSteps; step += 1) entrance.lineTo(profile.entrance.halfWidth, 0.012 + (profile.entrance.shoulderY - 0.012) * (1 - step / wallSteps));
  entrance.closePath();
  silhouette.holes.push(entrance);

  const geometry = new THREE.ExtrudeGeometry(silhouette, { depth: profile.depth, steps: 5, bevelEnabled: true, bevelSegments: 2, bevelSize: profile.bevel, bevelThickness: profile.bevel, curveSegments: profile.curveSegments });
  const dark = new THREE.Color(0x5b5145);
  const light = new THREE.Color(0xa59580);
  const soil = new THREE.Color(0x5a4631);
  const { halfWidth, shoulderY, topY } = profile.entrance;
  sculpt(geometry, (position, normal, color) => {
    const roofY = shoulderY + (topY - shoulderY) * 0.5 * (1 - (position.x / halfWidth) ** 2);
    const edge = Math.max(Math.abs(position.x) - halfWidth, position.y - roofY);
    const weight = THREE.MathUtils.smoothstep(edge, 0.015, 0.16);
    const lumps = fbm(position.x * 4.5, position.y * 4.5, position.z * 4.5);
    const strata = fbm(position.x * 2, position.y * 9, position.z * 2);
    color.copy(dark).lerp(light, THREE.MathUtils.clamp(0.25 + lumps * 0.75, 0, 1)).multiplyScalar(0.82 + strata * 0.36 + Math.max(normal.y, 0) * 0.07);
    color.lerp(soil, THREE.MathUtils.smoothstep(0.1 - position.y, 0, 0.1) * 0.55);
    if (edge < 0.01 || (position.y < 0.03 && Math.abs(position.x) < halfWidth + 0.01)) color.multiplyScalar(0.45);
    normal.set(position.x, position.y - 0.25, position.z - profile.depth / 2).normalize();
    return -weight * (0.02 + 0.13 * lumps * lumps);
  });

  const cave = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.98, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.055 } : {}) }),
  );
  cave.position.z = profile.position.z;
  cave.position.y = profile.position.y;
  return cave;
}

function createTrunkShell(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.trunk;
  const trunk = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.94, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.06 } : {}) });
  const interior = new THREE.MeshStandardMaterial({ color: 0x352a21, roughness: 1, side: THREE.DoubleSide });
  const outerGeometry = new THREE.CylinderGeometry(profile.outerRadii.top, profile.outerRadii.bottom, profile.length, profile.segments * 4, 24, true);
  const grooves = new THREE.Color(0x3b281c);
  const barkMid = new THREE.Color(0x7a553b);
  const ridgeTop = new THREE.Color(0x9b7352);
  const moss = new THREE.Color(0x5d6a38);
  sculpt(outerGeometry, (position, _normal, color) => {
    const angle = Math.atan2(position.z, position.x);
    const around = [Math.cos(angle), Math.sin(angle)];
    const ridge = noise3(around[0] * 3.2, around[1] * 3.2, position.y * 1.1) * 0.65 + noise3(around[0] * 7.5, around[1] * 7.5, position.y * 2.4) * 0.35;
    color.copy(grooves).lerp(barkMid, THREE.MathUtils.smoothstep(ridge, 0.2, 0.6)).lerp(ridgeTop, THREE.MathUtils.smoothstep(ridge, 0.6, 0.9));
    const mossy = THREE.MathUtils.smoothstep(around[0], 0.3, 0.9) * THREE.MathUtils.smoothstep(noise3(position.x * 6, position.y * 6, position.z * 6), 0.6, 0.85);
    color.lerp(moss, mossy * 0.5);
    return -0.045 * (1 - ridge);
  });
  const outer = new THREE.Mesh(outerGeometry, bark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(profile.innerRadii.top, profile.innerRadii.bottom, profile.length, profile.segments, 1, true), interior);
  outer.rotation.z = Math.PI / 2;
  inner.rotation.z = Math.PI / 2;
  outer.position.y = profile.centerY;
  inner.position.y = profile.centerY;
  trunk.add(outer, inner);

  const cutWood = new THREE.MeshStandardMaterial({ map: getWoodRingTexture(), roughness: 0.9, side: THREE.DoubleSide });
  for (const direction of [-1, 1]) {
    const radii = direction < 0 ? profile.outerRadii.top : profile.outerRadii.bottom;
    const innerRadius = direction < 0 ? profile.innerRadii.top : profile.innerRadii.bottom;
    const cut = new THREE.Mesh(new THREE.RingGeometry(innerRadius, radii, 32, 1), cutWood);
    cut.rotation.y = Math.PI / 2;
    cut.position.set(direction * profile.length / 2, profile.centerY, 0);
    trunk.add(cut);
  }
  return trunk;
}

function createBarkShelter(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.bark;
  const shelter = new THREE.Group();
  const outerBark = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.98, side: THREE.DoubleSide, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.06 } : {}) });
  const innerBark = new THREE.MeshStandardMaterial({ color: 0x5c4230, roughness: 1, side: THREE.DoubleSide, flatShading: true });
  const outerGeometry = new THREE.CylinderGeometry(profile.outerRadius, profile.outerRadius, profile.length, profile.segments * 2, 16, true, profile.thetaStart, profile.thetaLength);
  const grooves = new THREE.Color(0x35241a);
  const plates = new THREE.Color(0x80603f);
  const plateTop = new THREE.Color(0xa07c55);
  sculpt(outerGeometry, (position, _normal, color) => {
    const angle = Math.atan2(position.z, position.x);
    const plate = noise3(Math.cos(angle) * 3, Math.sin(angle) * 3, position.y * 2.6) * 0.6 + noise3(Math.cos(angle) * 7, Math.sin(angle) * 7, position.y * 6) * 0.4;
    color.copy(grooves).lerp(plates, THREE.MathUtils.smoothstep(plate, 0.25, 0.55)).lerp(plateTop, THREE.MathUtils.smoothstep(plate, 0.6, 0.85));
    return -0.035 * (1 - THREE.MathUtils.smoothstep(plate, 0.3, 0.6));
  });
  const outer = new THREE.Mesh(outerGeometry, outerBark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(profile.innerRadius, profile.innerRadius, profile.length, profile.segments, 1, true, profile.thetaStart, profile.thetaLength), innerBark);
  const shell = new THREE.Group();
  shell.add(outer, inner);
  // The shell's two open edges lie on the z = 0 plane, so a thin strip closes each one.
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x8c6c49, roughness: 0.95, side: THREE.DoubleSide });
  for (const direction of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(profile.outerRadius - profile.innerRadius, profile.length), edgeMaterial);
    strip.position.x = direction * (profile.outerRadius + profile.innerRadius) / 2;
    shell.add(strip);
  }
  shell.rotation.x = Math.PI / 2;
  shell.position.y = profile.centerY;
  shelter.add(shell);
  return shelter;
}

export function createHideModel(variant: HideVariant, surfaceNoise?: THREE.Texture): THREE.Group {
  const hide = new THREE.Group();
  if (variant === "Grotte") hide.add(createCaveShell(surfaceNoise));
  else if (variant === "Tronc creux") hide.add(createTrunkShell(surfaceNoise));
  else hide.add(createBarkShelter(surfaceNoise));
  return hide;
}