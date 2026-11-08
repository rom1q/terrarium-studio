import * as THREE from "three";
import { plantGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant, PlantVisualProfile } from "../../domain/projectLogic";

const fallbackProfiles: Record<"Feuillage dense" | "Fougère" | "Rosette", PlantVisualProfile> = {
  "Feuillage dense": { silhouette: "broadleaf", heightScale: 0.9, spreadScale: 1, density: 8 },
  Fougère: { silhouette: "fern", heightScale: 1, spreadScale: 1, density: 7 },
  Rosette: { silhouette: "rosette", heightScale: 0.65, spreadScale: 0.9, density: 10 },
};
type LeafTextureKind = "pinnate" | "parallel";
const sharedLeafDetailTextures: Partial<Record<LeafTextureKind, THREE.DataTexture>> = {};

function hashCell(x: number, y: number, seed: number) {
  let value = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263) + Math.imul(seed + 1, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fx = x - cellX;
  const fy = y - cellY;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hashCell(cellX, cellY, seed) * (1 - sx) + hashCell(cellX + 1, cellY, seed) * sx;
  const bottom = hashCell(cellX, cellY + 1, seed) * (1 - sx) + hashCell(cellX + 1, cellY + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

function createTaperedLeafGeometry() {
  const widthSegments = 6;
  const lengthSegments = 12;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex += 1) {
    const alongLeaf = lengthIndex / lengthSegments;
    const taper = Math.pow(Math.sin(Math.PI * alongLeaf), 0.72);
    for (let widthIndex = 0; widthIndex <= widthSegments; widthIndex += 1) {
      const acrossLeaf = widthIndex / widthSegments * 2 - 1;
      const width = acrossLeaf * taper;
      const curve = (1 - acrossLeaf * acrossLeaf) * Math.sin(Math.PI * alongLeaf) * 0.35;
      vertices.push(width, alongLeaf - 0.5, curve);
      uvs.push((acrossLeaf + 1) / 2, alongLeaf);
    }
  }

  for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
    for (let widthIndex = 0; widthIndex < widthSegments; widthIndex += 1) {
      const lowerLeft = lengthIndex * (widthSegments + 1) + widthIndex;
      const upperLeft = lowerLeft + widthSegments + 1;
      indices.push(lowerLeft, lowerLeft + 1, upperLeft, lowerLeft + 1, upperLeft + 1, upperLeft);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type ArchedLeafOptions = { length: number; width: number; peak: number; bend: number; cup: number; ripple?: number };

// Leaf grows along +Y from its base and arches toward -Z; +Z is the upper face.
function createArchedLeafGeometry({ length, width, peak, bend, cup, ripple = 0 }: ArchedLeafOptions) {
  const widthSegments = 8;
  const lengthSegments = 16;
  const widthExponent = Math.log(0.5) / Math.log(peak);
  const vertices: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const centerline: THREE.Vector3[] = [];
  let y = 0;
  let z = 0;

  for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex += 1) {
    const along = lengthIndex / lengthSegments;
    const angle = bend * Math.pow(along, 1.4);
    if (lengthIndex > 0) {
      y += Math.cos(angle) * length / lengthSegments;
      z -= Math.sin(angle) * length / lengthSegments;
    }
    const halfWidth = width / 2 * (Math.pow(Math.sin(Math.PI * Math.pow(along, widthExponent)), 0.7) * 0.88 + 0.12 * (1 - along) * (1 - along));
    const shade = 0.58 + 0.42 * Math.min(1, along * 2.2);
    centerline.push(new THREE.Vector3(0, y, z));
    for (let widthIndex = 0; widthIndex <= widthSegments; widthIndex += 1) {
      const across = widthIndex / widthSegments * 2 - 1;
      const lift = Math.pow(Math.abs(across), 1.5) * halfWidth * cup + ripple * Math.sin(along * Math.PI * 9) * across * across * halfWidth * 0.5;
      vertices.push(across * halfWidth, y + Math.sin(angle) * lift, z + Math.cos(angle) * lift);
      uvs.push((across + 1) / 2, along);
      colors.push(shade * (0.96 + 0.1 * along), shade, shade * (0.94 - 0.12 * along));
    }
  }

  for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
    for (let widthIndex = 0; widthIndex < widthSegments; widthIndex += 1) {
      const lowerLeft = lengthIndex * (widthSegments + 1) + widthIndex;
      const upperLeft = lowerLeft + widthSegments + 1;
      indices.push(lowerLeft, lowerLeft + 1, upperLeft, lowerLeft + 1, upperLeft + 1, upperLeft);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, centerline };
}

// The red channel doubles as the bump height, so veins are darker in red to read as grooves.
function getLeafDetailTexture(kind: LeafTextureKind = "pinnate") {
  const cached = sharedLeafDetailTextures[kind];
  if (cached) return cached;
  const width = 128;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const seed = kind === "pinnate" ? 3 : 11;
  for (let y = 0; y < height; y += 1) {
    const alongLeaf = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const acrossLeaf = x / (width - 1);
      const edge = Math.abs(acrossLeaf - 0.5) * 2;
      const mottle = smoothNoise(acrossLeaf * 5, alongLeaf * 9, seed) * 0.65 + smoothNoise(acrossLeaf * 14, alongLeaf * 24, seed + 1) * 0.35 - 0.5;
      const streak = kind === "parallel" ? smoothNoise(acrossLeaf * 46, alongLeaf * 3, seed + 2) - 0.5 : 0;
      let tone = 0.93 + mottle * 0.1 + streak * 0.07 - Math.pow(edge, 3) * 0.14 + (alongLeaf - 0.5) * 0.04;
      let vein = 0;

      if (kind === "pinnate") {
        if (Math.abs(acrossLeaf - 0.5) < 0.015) vein = 1;
        for (let index = 0; index < 8; index += 1) {
          const progress = (alongLeaf - (0.08 + index * 0.105)) / 0.075;
          if (progress < 0 || progress > 1) continue;
          const branch = 0.055 + progress * 0.37;
          if (Math.abs(Math.abs(acrossLeaf - 0.5) - branch) < 0.009) vein = Math.max(vein, 0.55);
        }
      } else {
        const lane = acrossLeaf * 11;
        const distance = Math.abs(lane - Math.round(lane));
        if (distance < 0.07 + hashCell(Math.round(lane), 0, seed) * 0.05) vein = 0.5;
        if (alongLeaf < 0.1) tone += (0.1 - alongLeaf) * 1.4;
      }

      const hueShift = (smoothNoise(acrossLeaf * 4, alongLeaf * 6, seed + 3) - 0.5) * 0.08;
      const grain = (hashCell(x, y, seed + 4) - 0.5) * 0.025;
      const red = (tone * (1 - vein * 0.16) + hueShift + grain) * 238;
      const green = (tone * (1 - vein * 0.04) + grain) * 250;
      const blue = (tone * (1 - vein * 0.12) - hueShift * 1.2 + grain) * 226;
      const pixel = (y * width + x) * 4;
      data[pixel] = THREE.MathUtils.clamp(red, 0, 255);
      data[pixel + 1] = THREE.MathUtils.clamp(green, 0, 255);
      data[pixel + 2] = THREE.MathUtils.clamp(blue, 0, 255);
      data[pixel + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  sharedLeafDetailTextures[kind] = texture;
  return texture;
}

export type PlantSway = { rotationX: number; rotationZ: number };

export function getPlantSway(timeSeconds: number, phase: number): PlantSway {
  return {
    rotationX: Math.sin(timeSeconds * 0.9 + phase) * 0.012,
    rotationZ: Math.sin(timeSeconds * 1.35 + phase) * 0.024,
  };
}

export function createPlantModel(
  visualProfile: PlantVisualProfile | undefined,
  variant: DecorationVariant,
  plantColor: number,
): THREE.Group {
  const profile = visualProfile ?? fallbackProfiles[variant as keyof typeof fallbackProfiles] ?? fallbackProfiles["Feuillage dense"];
  const plant = new THREE.Group();
  const foliageHighlight = new THREE.Color(plantColor).lerp(new THREE.Color(0xc3ce85), 0.22);
  const createFoliageMaterial = (color: THREE.ColorRepresentation, roughness: number, texture = getLeafDetailTexture("pinnate"), vertexColors = false) => new THREE.MeshPhysicalMaterial({
    color,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.008,
    vertexColors,
    roughness,
    side: THREE.DoubleSide,
    sheen: 0.28,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xc5d69a),
  });
  const foliage = createFoliageMaterial(plantColor, 0.7);
  const foliageLight = createFoliageMaterial(foliageHighlight, 0.74);
  const parallelTexture = getLeafDetailTexture("parallel");
  const archedFoliage = createFoliageMaterial(plantColor, 0.62, undefined, true);
  const archedFoliageLight = createFoliageMaterial(foliageHighlight, 0.66, undefined, true);
  const archedStrap = createFoliageMaterial(plantColor, 0.6, parallelTexture, true);
  const archedStrapLight = createFoliageMaterial(foliageHighlight, 0.64, parallelTexture, true);
  const leafGeometry = createTaperedLeafGeometry();
  const leafVeinMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(plantColor).multiplyScalar(0.55), transparent: true, opacity: 0.5 });
  const leafInstanceBatches = new Map<THREE.MeshPhysicalMaterial, THREE.Matrix4[]>();
  const archedLeafCache = new Map<string, ReturnType<typeof createArchedLeafGeometry>>();
  const groundY = 0.04;
  const stemMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(plantColor).lerp(new THREE.Color(0x6b5a34), 0.4), roughness: 0.82 });
  const veinMaterial = new THREE.MeshStandardMaterial({ color: 0xa45559, roughness: 0.76 });
  // The shared leaf geometry is centred on its origin, so the instance sits half a length along the leaf.
  const addOrientedLeaflet = (base: THREE.Vector3, along: THREE.Vector3, across: THREE.Vector3, length: number, width: number, material: THREE.MeshPhysicalMaterial) => {
    const axisY = along.clone().normalize();
    const axisX = across.clone().addScaledVector(axisY, -across.dot(axisY)).normalize();
    const axisZ = new THREE.Vector3().crossVectors(axisX, axisY);
    const matrix = new THREE.Matrix4().compose(
      base.clone().addScaledVector(axisY, length / 2),
      new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX, axisY, axisZ)),
      new THREE.Vector3(width / 2, length, width / 5),
    );
    const batch = leafInstanceBatches.get(material) ?? [];
    batch.push(matrix);
    leafInstanceBatches.set(material, batch);
  };
  // pitch is measured from vertical, so 0 stands the leaf up and 1.57 lays it flat.
  const addArchedLeaf = (base: THREE.Vector3, angle: number, pitch: number, options: ArchedLeafOptions, material: THREE.MeshPhysicalMaterial, midrib: "line" | "red" | "none" = "line") => {
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const along = new THREE.Vector3(Math.cos(angle) * Math.sin(pitch), Math.cos(pitch), Math.sin(angle) * Math.sin(pitch));
    const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, new THREE.Vector3().crossVectors(across, along)));
    const getShape = (leafOptions: ArchedLeafOptions) => {
      const cacheKey = JSON.stringify(leafOptions);
      const cached = archedLeafCache.get(cacheKey) ?? createArchedLeafGeometry(leafOptions);
      archedLeafCache.set(cacheKey, cached);
      return cached;
    };
    // Straighten the arch until the tip stays above the ground, otherwise it would lift the whole plant.
    let fitted = options;
    let shape = getShape(fitted);
    for (let attempt = 0; attempt < 10 && fitted.bend > 0.05; attempt += 1) {
      const lowest = Math.min(...shape.centerline.map((point) => base.y + point.clone().applyQuaternion(orientation).y));
      if (lowest >= groundY) break;
      fitted = { ...fitted, bend: fitted.bend * 0.8 };
      shape = getShape(fitted);
    }
    const leaf = new THREE.Mesh(shape.geometry, material);
    leaf.quaternion.copy(orientation);
    leaf.position.copy(base);
    if (midrib !== "none") {
      const points = shape.centerline.map((point) => point.clone().add(new THREE.Vector3(0, 0, 0.004)));
      leaf.add(midrib === "red"
        ? new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.004, 4, false), veinMaterial)
        : new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), leafVeinMaterial));
    }
    plant.add(leaf);
  };
  const addStem = (start: THREE.Vector3, end: THREE.Vector3, radius = 0.012, material = stemMaterial) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, direction.length(), 6), material);
    stem.position.copy(start).add(end).multiplyScalar(0.5);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    plant.add(stem);
  };
  type FrondOptions = { base: THREE.Vector3; angle: number; length: number; startPitch: number; endPitch: number; pairs: number; leafletSize: number; radius: number };
  // The rachis bends from startPitch to endPitch (from vertical); leaflets sweep forward toward the tip.
  const addFrond = ({ base, angle, length, startPitch, endPitch, pairs, leafletSize, radius }: FrondOptions) => {
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const steps = 16;
    // Lower the frond's end pitch until the rachis and its hanging leaflets clear the ground.
    let points: THREE.Vector3[] = [];
    for (let end = endPitch; ; end = Math.max(startPitch, end - 0.15)) {
      points = [base.clone()];
      for (let step = 1; step <= steps; step += 1) {
        const pitch = THREE.MathUtils.lerp(startPitch, end, Math.pow((step - 0.5) / steps, 1.2));
        points.push(points[step - 1].clone().addScaledVector(outward, Math.sin(pitch) * length / steps).add(new THREE.Vector3(0, Math.cos(pitch) * length / steps, 0)));
      }
      if (Math.min(...points.map((point) => point.y)) >= groundY + leafletSize * 0.35 || end <= startPitch) break;
    }
    const curve = new THREE.CatmullRomCurve3(points);
    plant.add(new THREE.Mesh(new THREE.TubeGeometry(curve, steps, radius, 5, false), stemMaterial));
    for (let index = 1; index <= pairs; index += 1) {
      const along01 = 0.1 + 0.88 * index / pairs;
      const origin = curve.getPoint(along01);
      const tangent = curve.getTangent(along01);
      const size = leafletSize * (0.4 + 0.6 * Math.sin(Math.PI * Math.pow(along01, 0.75)));
      for (const sign of [-1, 1]) {
        const direction = side.clone().multiplyScalar(sign * Math.cos(0.95)).addScaledVector(tangent, Math.sin(0.95));
        direction.y -= 0.18;
        addOrientedLeaflet(origin, direction, tangent, size, size * 0.3, (index + (sign > 0 ? 1 : 0)) % 2 ? foliage : foliageLight);
      }
    }
  };

  const count = profile.density;
  switch (profile.silhouette) {
    case "rosette":
    case "spiky-rosette":
    case "aloe": {
      const isSpiky = profile.silhouette === "spiky-rosette";
      const isAloe = profile.silhouette === "aloe";
      const style: ArchedLeafOptions & { pitch: number } = isSpiky
        ? { length: 0.62, width: 0.1, peak: 0.3, pitch: 0.38, bend: 0.35, cup: 0.5 }
        : isAloe
          ? { length: 0.82, width: 0.2, peak: 0.22, pitch: 0.8, bend: 0.85, cup: 0.55 }
          : { length: 0.62, width: 0.2, peak: 0.5, pitch: 0.8, bend: 0.9, cup: 0.35 };
      const tiers = [{ size: 1, upright: 1 }, { size: 0.8, upright: 0.7 }, { size: 0.58, upright: 0.4 }];
      const leafTotal = Math.round(count * 1.8);
      for (let index = 0; index < leafTotal; index += 1) {
        const tier = tiers[index % 3];
        const variation = 0.9 + hashCell(index, 1, 7) * 0.2;
        const angle = index * 2.399;
        addArchedLeaf(
          new THREE.Vector3(Math.cos(angle) * 0.03, groundY + (index % 3) * 0.02, Math.sin(angle) * 0.03),
          angle,
          style.pitch * tier.upright + (hashCell(index, 2, 7) - 0.5) * 0.16,
          { ...style, length: style.length * tier.size * variation, width: style.width * tier.size, bend: style.bend * tier.upright },
          index % 2 ? archedFoliageLight : archedFoliage,
        );
      }
      break;
    }
    case "fern": {
      const tiers = [{ start: 0.95, end: 2.5, size: 1 }, { start: 0.6, end: 2.1, size: 0.9 }, { start: 0.28, end: 1.5, size: 0.75 }];
      const frondTotal = Math.round(count * 1.7);
      for (let index = 0; index < frondTotal; index += 1) {
        const tier = tiers[index % 3];
        const angle = index * 2.399;
        addFrond({
          base: new THREE.Vector3(Math.cos(angle) * 0.02, groundY, Math.sin(angle) * 0.02),
          angle,
          length: 0.9 * tier.size * (0.92 + hashCell(index, 4, 7) * 0.16),
          startPitch: tier.start,
          endPitch: tier.end,
          pairs: 14,
          leafletSize: 0.17 * tier.size,
          radius: 0.01,
        });
      }
      break;
    }
    case "bird-nest": {
      const style = { length: 0.78, width: 0.2, peak: 0.62, bend: 0.8, cup: 0.3, ripple: 0.3 };
      const tiers = [{ size: 1, upright: 1 }, { size: 0.85, upright: 0.7 }, { size: 0.65, upright: 0.45 }];
      const leafTotal = Math.round(count * 1.6);
      for (let index = 0; index < leafTotal; index += 1) {
        const tier = tiers[index % 3];
        const angle = index * 2.399;
        addArchedLeaf(
          new THREE.Vector3(Math.cos(angle) * 0.02, groundY, Math.sin(angle) * 0.02),
          angle,
          0.7 * tier.upright + (hashCell(index, 5, 7) - 0.5) * 0.14,
          { ...style, length: style.length * tier.size * (0.92 + hashCell(index, 6, 7) * 0.16), width: style.width * tier.size, bend: style.bend * tier.upright },
          index % 2 ? archedFoliageLight : archedFoliage,
        );
      }
      break;
    }
    case "arching-straps":
    case "grass-clump": {
      const isGrass = profile.silhouette === "grass-clump";
      const style = isGrass ? { length: 0.7, width: 0.055, peak: 0.22, cup: 0.3 } : { length: 0.85, width: 0.09, peak: 0.28, cup: 0.5 };
      const tiers = isGrass
        ? [{ size: 1, pitch: 0.45, bend: 1.1 }, { size: 0.85, pitch: 0.3, bend: 0.9 }, { size: 0.65, pitch: 0.15, bend: 0.6 }]
        : [{ size: 1, pitch: 0.62, bend: 2.2 }, { size: 0.85, pitch: 0.42, bend: 1.7 }, { size: 0.7, pitch: 0.22, bend: 1.2 }];
      const leafTotal = Math.round(count * (isGrass ? 2.6 : 2.2));
      for (let index = 0; index < leafTotal; index += 1) {
        const tier = tiers[index % 3];
        const angle = index * 2.399;
        addArchedLeaf(
          new THREE.Vector3(Math.cos(angle) * 0.02, groundY, Math.sin(angle) * 0.02),
          angle,
          tier.pitch + (hashCell(index, 8, 7) - 0.5) * 0.2,
          { ...style, length: style.length * tier.size * (0.9 + hashCell(index, 9, 7) * 0.2), width: style.width * (0.9 + tier.size * 0.1), bend: tier.bend },
          index % 2 ? archedStrapLight : archedStrap,
          "none",
        );
      }
      break;
    }
    case "broadleaf":
    case "prayer-leaves": {
      const leafTotal = profile.silhouette === "prayer-leaves" ? count : Math.round(count * 0.8);
      for (let index = 0; index < leafTotal; index += 1) {
        const angle = index * 2.399;
        const reach = 0.06 + hashCell(index, 12, 7) * 0.2;
        const stemEnd = new THREE.Vector3(Math.cos(angle) * reach, 0.2 + hashCell(index, 13, 7) * 0.3, Math.sin(angle) * reach);
        addStem(new THREE.Vector3(0, 0.04, 0), stemEnd, 0.009);
        addArchedLeaf(
          stemEnd.clone().add(new THREE.Vector3(0, 0.02, 0)),
          angle,
          1 + hashCell(index, 3, 7) * 0.45,
          { length: 0.42 * (0.85 + hashCell(index, 14, 7) * 0.3), width: 0.3, peak: 0.42, bend: 0.7, cup: 0.22 },
          index % 2 ? archedFoliageLight : archedFoliage,
          profile.silhouette === "prayer-leaves" ? "red" : "line",
        );
      }
      break;
    }
    case "ground-mat": {
      const sprigs = count * 2;
      for (let index = 0; index < sprigs; index += 1) {
        const spread = Math.sqrt(index / sprigs);
        const placement = index * 2.399;
        addFrond({
          base: new THREE.Vector3(Math.cos(placement) * (0.04 + 0.26 * spread), 0.04 + (index % 4) * 0.02, Math.sin(placement) * (0.04 + 0.26 * spread)),
          angle: hashCell(index, 10, 7) * Math.PI * 2,
          length: 0.2 + hashCell(index, 11, 7) * 0.08,
          startPitch: 1.15,
          endPitch: 1.75,
          pairs: 6,
          leafletSize: 0.07,
          radius: 0.004,
        });
      }
      break;
    }
    case "umbrella": {
      const stems = Math.max(3, count);
      for (let stemIndex = 0; stemIndex < stems; stemIndex += 1) {
        const angle = stemIndex * 2.399;
        const base = new THREE.Vector3(Math.cos(angle) * 0.14, 0.05, Math.sin(angle) * 0.14);
        const top = new THREE.Vector3(base.x * 1.2, 0.88 + (stemIndex % 2) * 0.08, base.z * 1.2);
        addStem(base, top, 0.014);
        const bractTotal = 12;
        for (let bract = 0; bract < bractTotal; bract += 1) {
          addArchedLeaf(
            top.clone().add(new THREE.Vector3(0, -0.01, 0)),
            bract * Math.PI * 2 / bractTotal + stemIndex * 0.4,
            0.75 + (bract % 2) * 0.25,
            { length: 0.42, width: 0.05, peak: 0.25, bend: 1.1, cup: 0.3 },
            bract % 2 ? archedStrapLight : archedStrap,
            "none",
          );
        }
      }
      break;
    }
  }

  leafInstanceBatches.forEach((matrices, material) => {
    const instances = new THREE.InstancedMesh(leafGeometry, material, matrices.length);
    const tint = new THREE.Color();
    matrices.forEach((matrix, index) => {
      instances.setMatrixAt(index, matrix);
      const shade = 0.88 + (Math.sin(index * 12.9898) * 43758.5453 % 1 + 1) % 1 * 0.2;
      instances.setColorAt(index, tint.setRGB(shade, shade * 1.02, shade * 0.94));
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    plant.add(instances);
  });

  const geometryBounds = plantGeometryProfiles[profile.silhouette].bounds;
  const actualBounds = new THREE.Box3().setFromObject(plant, true);
  const center = actualBounds.getCenter(new THREE.Vector3());
  const size = actualBounds.getSize(new THREE.Vector3());
  const centeringTransform = new THREE.Matrix4().makeTranslation(-center.x, -actualBounds.min.y, -center.z);
  plant.children.forEach((child) => {
    if (child instanceof THREE.InstancedMesh) {
      const instanceMatrix = new THREE.Matrix4();
      for (let index = 0; index < child.count; index += 1) {
        child.getMatrixAt(index, instanceMatrix);
        child.setMatrixAt(index, instanceMatrix.premultiply(centeringTransform));
      }
      child.instanceMatrix.needsUpdate = true;
      child.computeBoundingBox();
      child.computeBoundingSphere();
    } else {
      child.position.x -= center.x;
      child.position.y -= actualBounds.min.y;
      child.position.z -= center.z;
    }
  });
  const halfWidth = Math.max(Math.abs(actualBounds.min.x - center.x), Math.abs(actualBounds.max.x - center.x));
  const halfDepth = Math.max(Math.abs(actualBounds.min.z - center.z), Math.abs(actualBounds.max.z - center.z));
  plant.scale.set(
    geometryBounds.halfWidth / halfWidth * profile.spreadScale,
    geometryBounds.maxY / size.y * profile.heightScale,
    geometryBounds.halfDepth / halfDepth * profile.spreadScale,
  );
  return plant;
}