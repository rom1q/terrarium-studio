import * as THREE from "three";
import { plantGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant, PlantVisualProfile } from "../../domain/projectLogic";

const fallbackProfiles: Record<"Feuillage dense" | "Fougère" | "Rosette", PlantVisualProfile> = {
  "Feuillage dense": { silhouette: "broadleaf", heightScale: 0.9, spreadScale: 1, density: 8 },
  Fougère: { silhouette: "fern", heightScale: 1, spreadScale: 1, density: 7 },
  Rosette: { silhouette: "rosette", heightScale: 0.65, spreadScale: 0.9, density: 10 },
};

export function createPlantModel(
  visualProfile: PlantVisualProfile | undefined,
  variant: DecorationVariant,
  plantColor: number,
): THREE.Group {
  const profile = visualProfile ?? fallbackProfiles[variant as keyof typeof fallbackProfiles] ?? fallbackProfiles["Feuillage dense"];
  const plant = new THREE.Group();
  const foliage = new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.78, side: THREE.DoubleSide });
  const foliageLight = new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.82, side: THREE.DoubleSide });
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x526d3e, roughness: 0.86 });
  const veinMaterial = new THREE.MeshStandardMaterial({ color: 0xa45559, roughness: 0.76 });
  const addBlade = (x: number, y: number, z: number, length: number, width: number, angle: number, lean: number, material = foliage) => {
    const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), material);
    blade.scale.set(width / 2, length / 2, width / 5);
    blade.position.set(x, y, z);
    blade.rotation.set(-Math.sin(angle) * lean, angle, Math.cos(angle) * lean);
    plant.add(blade);
    return blade;
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
        const leaflet = addBlade(
          position.x - direction.z * side * leafletSize * 0.42,
          position.y,
          position.z + direction.x * side * leafletSize * 0.42,
          leafletSize * (0.68 + taper * 0.32),
          leafletSize * 0.24,
          angle + side * 0.72,
          side * 0.9,
          index % 2 ? foliage : foliageLight,
        );
        leaflet.rotation.x = side * Math.cos(angle) * 0.3;
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
      const leafLength = isSpiky ? 0.62 : isAloe ? 0.82 : 0.62;
      const leafWidth = isSpiky ? 0.095 : isAloe ? 0.16 : 0.16;
      for (let index = 0; index < count; index += 1) {
        const angle = index * Math.PI * 2 / count;
        const ring = index < count * 0.7 ? 0 : 1;
        const size = ring === 0 ? 1 : 0.62;
        const lean = (isSpiky ? 0.28 : isAloe ? 0.5 : 0.82) * size;
        addBlade(
          Math.cos(angle) * (isSpiky ? 0.11 : isAloe ? 0.14 : 0.1) * size,
          0.12 + ring * 0.035,
          Math.sin(angle) * (isSpiky ? 0.11 : isAloe ? 0.14 : 0.1) * size,
          leafLength * size,
          leafWidth * size,
          angle,
          Math.cos(angle) * lean,
          index % 2 ? foliageLight : foliage,
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
        plant.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.033, 6, false), foliage));
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
        const bladeMaterial = index % 2 ? foliageLight : foliage;
        plant.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, profile.silhouette === "grass-clump" ? 0.018 : 0.027, 5, false), bladeMaterial));
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
        const leaf = addBlade(stemEnd.x, stemEnd.y + 0.08, stemEnd.z, 0.34, 0.2, angle, Math.cos(angle) * 0.34, stemIndex % 2 ? foliageLight : foliage);
        if (profile.silhouette === "prayer-leaves") {
          const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.27, 4), veinMaterial);
          vein.position.copy(leaf.position).add(new THREE.Vector3(0, -0.02, 0.012));
          vein.rotation.y = angle;
          vein.rotation.z = leaf.rotation.z;
          plant.add(vein);
        }
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

  const geometryBounds = plantGeometryProfiles[profile.silhouette].bounds;
  const actualBounds = new THREE.Box3().setFromObject(plant);
  const center = actualBounds.getCenter(new THREE.Vector3());
  const size = actualBounds.getSize(new THREE.Vector3());
  plant.children.forEach((child) => {
    child.position.x -= center.x;
    child.position.y -= actualBounds.min.y;
    child.position.z -= center.z;
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