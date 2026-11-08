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

function createRibbonBladeGeometry(curve: THREE.Curve<THREE.Vector3>, baseWidth: number, shape: "blade" | "strap", ripple = 0) {
  const segments = 14;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const start = curve.getPoint(0);
  const outward = new THREE.Vector3(curve.getPoint(1).x - start.x, 0, curve.getPoint(1).z - start.z).normalize();
  const side = new THREE.Vector3(-outward.z, 0, outward.x);

  for (let index = 0; index <= segments; index += 1) {
    const along = index / segments;
    const point = curve.getPoint(along);
    const tangent = curve.getTangent(along);
    const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const taper = shape === "strap" ? Math.pow(Math.sin(Math.PI * Math.min(0.5 + along * 0.5, 1)), 0.7) * (0.55 + Math.sin(Math.PI * along) * 0.45) : Math.pow(1 - along, 0.65) * Math.min(1, 0.45 + along * 6);
    const halfWidth = baseWidth * Math.max(taper, 0.02);
    const twist = along * 0.35;
    for (const across of [-1, 0, 1]) {
      const fold = (1 - Math.abs(across) * 0.5) * halfWidth * 0.28;
      const wave = ripple * Math.sin(along * Math.PI * 7) * Math.abs(across) * halfWidth;
      const offset = side.clone().multiplyScalar(across * halfWidth * Math.cos(twist)).addScaledVector(normal, fold + wave);
      vertices.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
      uvs.push((across + 1) / 2, along);
    }
  }

  for (let index = 0; index < segments; index += 1) {
    const lower = index * 3;
    for (let column = 0; column < 2; column += 1) {
      const a = lower + column;
      const b = a + 3;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type ArchedLeafOptions = { length: number; width: number; peak: number; bend: number; cup: number };

// Leaf grows along +Y from its base and arches toward -Z; +Z is the upper face.
function createArchedLeafGeometry({ length, width, peak, bend, cup }: ArchedLeafOptions) {
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
      const lift = Math.pow(Math.abs(across), 1.5) * halfWidth * cup;
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
  const strapFoliage = createFoliageMaterial(plantColor, 0.66, parallelTexture);
  const strapFoliageLight = createFoliageMaterial(foliageHighlight, 0.7, parallelTexture);
  const archedFoliage = createFoliageMaterial(plantColor, 0.62, undefined, true);
  const archedFoliageLight = createFoliageMaterial(foliageHighlight, 0.66, undefined, true);
  const leafGeometry = createTaperedLeafGeometry();
  const leafVeinMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(plantColor).multiplyScalar(0.55), transparent: true, opacity: 0.5 });
  const leafInstanceBatches = new Map<THREE.MeshPhysicalMaterial, THREE.Matrix4[]>();
  const stemMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(plantColor).lerp(new THREE.Color(0x6b5a34), 0.4), roughness: 0.82 });
  const veinMaterial = new THREE.MeshStandardMaterial({ color: 0xa45559, roughness: 0.76 });
  const addBlade = (x: number, y: number, z: number, length: number, width: number, angle: number, lean: number, material = foliage, rotationX = 0) => {
    const position = new THREE.Vector3(x, y, z);
    const rotation = new THREE.Euler(-Math.sin(angle) * lean + rotationX, angle, Math.cos(angle) * lean);
    const scale = new THREE.Vector3(width / 2, length, width / 5);
    const batch = leafInstanceBatches.get(material) ?? [];
    batch.push(new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), scale));
    leafInstanceBatches.set(material, batch);
  };
  // pitch is measured from vertical, so 0 stands the leaf up and 1.57 lays it flat.
  const addArchedLeaf = (base: THREE.Vector3, angle: number, pitch: number, options: ArchedLeafOptions, material: THREE.MeshPhysicalMaterial, redMidrib = false) => {
    const { geometry, centerline } = createArchedLeafGeometry(options);
    const leaf = new THREE.Mesh(geometry, material);
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const along = new THREE.Vector3(Math.cos(angle) * Math.sin(pitch), Math.cos(pitch), Math.sin(angle) * Math.sin(pitch));
    leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, new THREE.Vector3().crossVectors(across, along)));
    leaf.position.copy(base);
    const midrib = centerline.map((point) => point.clone().add(new THREE.Vector3(0, 0, 0.004)));
    leaf.add(redMidrib
      ? new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(midrib), 12, 0.004, 4, false), veinMaterial)
      : new THREE.Line(new THREE.BufferGeometry().setFromPoints(midrib), leafVeinMaterial));
    plant.add(leaf);
  };
  const addStem = (start: THREE.Vector3, end: THREE.Vector3, radius = 0.012, material = stemMaterial) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, direction.length(), 6), material);
    stem.position.copy(start).add(end).multiplyScalar(0.5);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    plant.add(stem);
  };
  const addFrond = (angle: number, length: number, leafletCount: number, leafletSize: number) => {
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const points = [
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(direction.x * 0.12, length * 0.55, direction.z * 0.12),
      new THREE.Vector3(direction.x * 0.42, length * 0.93, direction.z * 0.42),
      new THREE.Vector3(direction.x * 0.7, length * 0.74, direction.z * 0.7),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    plant.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.012, 5, false), stemMaterial));
    for (let index = 1; index <= leafletCount; index += 1) {
      const position = curve.getPoint(index / (leafletCount + 1));
      const taper = Math.sin(Math.PI * index / (leafletCount + 1));
      for (const side of [-1, 1]) {
        addBlade(
          position.x - direction.z * side * leafletSize * 0.42,
          position.y,
          position.z + direction.x * side * leafletSize * 0.42,
          leafletSize * (0.68 + taper * 0.32),
          leafletSize * 0.24,
          angle + side * 0.72,
          side * 0.9,
          index % 2 ? foliage : foliageLight,
          side * Math.cos(angle) * 0.3,
        );
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
          : { length: 0.62, width: 0.2, peak: 0.5, pitch: 1.05, bend: 1, cup: 0.35 };
      const tiers = [{ size: 1, upright: 1 }, { size: 0.8, upright: 0.7 }, { size: 0.58, upright: 0.4 }];
      const leafTotal = Math.round(count * 1.8);
      for (let index = 0; index < leafTotal; index += 1) {
        const tier = tiers[index % 3];
        const variation = 0.9 + hashCell(index, 1, 7) * 0.2;
        const angle = index * 2.399;
        addArchedLeaf(
          new THREE.Vector3(Math.cos(angle) * 0.03, 0.1 + (index % 3) * 0.03, Math.sin(angle) * 0.03),
          angle,
          style.pitch * tier.upright + (hashCell(index, 2, 7) - 0.5) * 0.16,
          { ...style, length: style.length * tier.size * variation, width: style.width * tier.size, bend: style.bend * tier.upright },
          index % 2 ? archedFoliageLight : archedFoliage,
        );
      }
      break;
    }
    case "fern": {
      for (let frond = 0; frond < count; frond += 1) {
        addFrond(frond * Math.PI * 2 / count, 0.82, 8, 0.16);
      }
      break;
    }
    case "bird-nest": {
      for (let index = 0; index < count; index += 1) {
        const angle = index * Math.PI * 2 / count;
        const length = 0.55 + (index % 3) * 0.07;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.08, 0),
          new THREE.Vector3(Math.cos(angle) * 0.12, length * 0.68, Math.sin(angle) * 0.12),
          new THREE.Vector3(Math.cos(angle) * 0.25, length, Math.sin(angle) * 0.25),
          new THREE.Vector3(Math.cos(angle) * 0.42, length * 0.72, Math.sin(angle) * 0.42),
        ]);
        plant.add(new THREE.Mesh(createRibbonBladeGeometry(curve, 0.075, "strap", 0.22), index % 2 ? foliageLight : foliage));
      }
      break;
    }
    case "arching-straps":
    case "grass-clump": {
      const bladeCount = profile.silhouette === "grass-clump" ? count : Math.max(7, count);
      for (let index = 0; index < bladeCount; index += 1) {
        const angle = index * Math.PI * 2 / bladeCount;
        const height = profile.silhouette === "grass-clump" ? 0.62 + (index % 4) * 0.07 : 0.82 + (index % 3) * 0.06;
        const reach = profile.silhouette === "grass-clump" ? 0.2 : 0.48;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.06, 0),
          new THREE.Vector3(Math.cos(angle) * reach * 0.3, height * 0.72, Math.sin(angle) * reach * 0.3),
          new THREE.Vector3(Math.cos(angle) * reach, height * 0.7, Math.sin(angle) * reach),
        ]);
        const bladeMaterial = index % 2 ? strapFoliageLight : strapFoliage;
        const isGrass = profile.silhouette === "grass-clump";
        plant.add(new THREE.Mesh(createRibbonBladeGeometry(curve, isGrass ? 0.03 : 0.062, isGrass ? "blade" : "strap"), bladeMaterial));
      }
      break;
    }
    case "broadleaf":
    case "prayer-leaves": {
      const stemCount = profile.silhouette === "prayer-leaves" ? Math.max(3, Math.round(count / 2)) : Math.max(4, Math.round(count / 3));
      for (let stemIndex = 0; stemIndex < stemCount; stemIndex += 1) {
        const angle = stemIndex * Math.PI * 2 / stemCount;
        const stemEnd = new THREE.Vector3(Math.cos(angle) * 0.18, 0.42 + (stemIndex % 2) * 0.06, Math.sin(angle) * 0.18);
        addStem(new THREE.Vector3(0, 0.04, 0), stemEnd);
        const leafBase = stemEnd.clone().add(new THREE.Vector3(0, 0.03, 0));
        addArchedLeaf(
          leafBase,
          angle,
          0.95 + hashCell(stemIndex, 3, 7) * 0.35,
          { length: 0.4, width: 0.27, peak: 0.42, bend: 0.75, cup: 0.22 },
          stemIndex % 2 ? archedFoliageLight : archedFoliage,
          profile.silhouette === "prayer-leaves",
        );
      }
      break;
    }
    case "ground-mat": {
      const clusters = Math.max(8, count);
      for (let index = 0; index < clusters; index += 1) {
        const angle = index * 2.399;
        const radius = 0.08 + 0.28 * Math.sqrt(index / clusters);
        const center = new THREE.Vector3(Math.cos(angle) * radius, 0.08 + (index % 3) * 0.015, Math.sin(angle) * radius);
        for (let leaf = 0; leaf < 5; leaf += 1) {
          const leafAngle = angle + leaf * Math.PI * 2 / 5;
          addBlade(
            center.x + Math.cos(leafAngle) * 0.035,
            center.y,
            center.z + Math.sin(leafAngle) * 0.035,
            0.18,
            0.075,
            leafAngle,
            Math.cos(leafAngle) * 0.3,
            leaf % 2 ? foliage : foliageLight,
          );
        }
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
        for (let bract = 0; bract < 8; bract += 1) {
          const bractAngle = bract * Math.PI / 4;
          addBlade(
            top.x + Math.cos(bractAngle) * 0.12,
            top.y - 0.04,
            top.z + Math.sin(bractAngle) * 0.12,
            0.24,
            0.045,
            bractAngle,
            Math.cos(bractAngle) * 0.94,
            bract % 2 ? foliageLight : foliage,
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
  const actualBounds = new THREE.Box3().setFromObject(plant);
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