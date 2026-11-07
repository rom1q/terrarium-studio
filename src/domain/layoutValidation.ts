import { plantCatalog } from "../data/plantCatalog";
import type { Biotope, Decoration, DecorationVariant, Shape } from "./projectLogic";

export type TerrariumSceneDimensions = { width: number; depth: number; height: number };
export type DecorationLayoutWarnings = { boundaries: string[]; clearances: string[] };

type LocalBounds = { halfWidth: number; halfDepth: number; minY: number; maxY: number };
type Bounds3D = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
type PositionedBounds = { item: Decoration; label: string; bounds: Bounds3D };
type HideOpening = { x: number; z: number; axis: "x" | "z"; halfWidth: number; halfDepth: number; minY: number; maxY: number };

type GenericPlantVariant = Extract<DecorationVariant, "Feuillage dense" | "Fougère" | "Rosette">;
const fallbackPlantProfiles: Record<GenericPlantVariant, { heightScale: number; spreadScale: number; radius: number }> = {
  "Feuillage dense": { heightScale: 0.9, spreadScale: 1, radius: 0.36 },
  Fougère: { heightScale: 1, spreadScale: 1, radius: 0.8 },
  Rosette: { heightScale: 0.65, spreadScale: 0.9, radius: 0.45 },
};

export function getTerrariumSceneDimensions(shape: Shape, dimensions: { width: number; depth: number; height: number }): TerrariumSceneDimensions {
  const width = Math.min(3.2, Math.max(1.7, dimensions.width / 58));
  const depth = Math.min(2.5, Math.max(1.25, dimensions.depth / 38));
  const heightScale = shape === "Verticale" ? 0.038 : shape === "Cubique" ? 0.03 : 0.022;
  const height = Math.min(3.1, Math.max(1.65, dimensions.height * heightScale));
  return { width, depth, height };
}

function getLocalBounds(item: Decoration, biotope: Biotope): LocalBounds {
  switch (item.kind) {
    case "Plante": {
      const visual = plantCatalog.find((plant) => plant.id === item.plantSpeciesId)?.visual;
      const variant = item.variant === "Feuillage dense" || item.variant === "Fougère" || item.variant === "Rosette"
        ? item.variant
        : biotope === "Désertique" ? "Rosette" : "Feuillage dense";
      const fallback = fallbackPlantProfiles[variant];
      const spreadScale = visual?.spreadScale ?? fallback.spreadScale;
      const heightScale = visual?.heightScale ?? fallback.heightScale;
      const radius = !visual ? fallback.radius : visual.silhouette === "fern" ? 0.8 : visual.silhouette === "ground-mat" ? 0.48 : visual.silhouette === "umbrella" ? 0.34 : visual.silhouette === "broadleaf" || visual.silhouette === "prayer-leaves" ? 0.36 : visual.silhouette === "spiky-rosette" ? 0.43 : visual.silhouette === "grass-clump" ? 0.35 : 0.5;
      return { halfWidth: radius * spreadScale, halfDepth: radius * spreadScale, minY: 0, maxY: 1.1 * heightScale };
    }
    case "Roche":
      if (item.variant === "Galet") return { halfWidth: 0.4, halfDepth: 0.31, minY: 0.18, maxY: 0.41 };
      if (item.variant === "Stratifiée") return { halfWidth: 0.43, halfDepth: 0.39, minY: 0.02, maxY: 0.32 };
      return { halfWidth: 0.4, halfDepth: 0.32, minY: 0.18, maxY: 0.45 };
    case "Cachette":
      if (item.variant === "Tronc creux") return { halfWidth: 0.515, halfDepth: 0.35, minY: -0.01, maxY: 0.69 };
      if (item.variant === "Écorce creuse") return { halfWidth: 0.36, halfDepth: 0.41, minY: 0, maxY: 0.36 };
      return { halfWidth: 0.505, halfDepth: 0.385, minY: 0, maxY: 1.03 };
    case "Branche":
      return { halfWidth: 0.52, halfDepth: item.variant !== "Branche droite" ? 0.22 : 0.08, minY: 0.085, maxY: item.variant !== "Branche droite" ? 1.02 : 0.83 };
    case "Plateforme":
      return { halfWidth: 0.46, halfDepth: 0.31, minY: 0.01, maxY: 0.53 };
    case "Gamelle":
      return { halfWidth: 0.3, halfDepth: 0.3, minY: 0, maxY: 0.16 };
    case "Lampe chauffante":
      return { halfWidth: 0.26, halfDepth: 0.26, minY: -0.32, maxY: 0.2 };
    case "Tube UVB":
      return { halfWidth: 0.51, halfDepth: 0.05, minY: -0.09, maxY: 0.08 };
  }
}

function getHideOpenings(item: Decoration): HideOpening[] {
  if (item.kind !== "Cachette") return [];
  if (item.variant === "Tronc creux") {
    return [-1, 1].map((direction) => ({
      x: direction * 0.48,
      z: 0,
      axis: "x",
      halfWidth: 0.25,
      halfDepth: 0.2,
      minY: 0.08,
      maxY: 0.6,
    }));
  }
  if (item.variant === "Écorce creuse") {
    return [-1, 1].map((direction) => ({
      x: 0,
      z: direction * 0.41,
      axis: "z",
      halfWidth: 0.31,
      halfDepth: 0.2,
      minY: 0,
      maxY: 0.36,
    }));
  }
  return [-1, 1].map((direction) => ({
    x: 0,
    z: direction * 0.48,
    axis: "z",
    halfWidth: 0.245,
    halfDepth: 0.18,
    minY: 0,
    maxY: 0.58,
  }));
}

function getPositionedBounds(
  item: Decoration,
  label: string,
  dimensions: { width: number; depth: number; height: number },
  sceneDimensions: TerrariumSceneDimensions,
  biotope: Biotope,
): PositionedBounds {
  const local = getLocalBounds(item, biotope);
  const rotation = (item.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const size = (item.size ?? 100) / 100;
  const halfWidth = (cosine * local.halfWidth + sine * local.halfDepth) * size * dimensions.width / sceneDimensions.width;
  const halfDepth = (sine * local.halfWidth + cosine * local.halfDepth) * size * dimensions.depth / sceneDimensions.depth;
  const centerX = (item.position.x + 1) * dimensions.width / 2;
  const centerZ = (item.position.z + 1) * dimensions.depth / 2;
  const baseY = (item.position.y ?? 0) * dimensions.height;
  const worldToCentimetersY = dimensions.height / sceneDimensions.height;
  return {
    item,
    label,
    bounds: {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: baseY + local.minY * size * worldToCentimetersY,
      maxY: baseY + local.maxY * size * worldToCentimetersY,
      minZ: centerZ - halfDepth,
      maxZ: centerZ + halfDepth,
    },
  };
}

function rotatePoint(x: number, z: number, rotation: number) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return { x: cosine * x + sine * z, z: -sine * x + cosine * z };
}

function getOpeningBounds(
  item: Decoration,
  opening: HideOpening,
  dimensions: { width: number; depth: number; height: number },
  sceneDimensions: TerrariumSceneDimensions,
): Bounds3D {
  const rotation = (item.rotation ?? 0) * Math.PI / 180;
  const size = (item.size ?? 100) / 100;
  const center = rotatePoint(opening.x, opening.z, rotation);
  const localHalfWidth = opening.axis === "z" ? opening.halfWidth : opening.halfDepth;
  const localHalfDepth = opening.axis === "z" ? opening.halfDepth : opening.halfWidth;
  const halfWidth = (Math.abs(Math.cos(rotation)) * localHalfWidth + Math.abs(Math.sin(rotation)) * localHalfDepth) * size * dimensions.width / sceneDimensions.width;
  const halfDepth = (Math.abs(Math.sin(rotation)) * localHalfWidth + Math.abs(Math.cos(rotation)) * localHalfDepth) * size * dimensions.depth / sceneDimensions.depth;
  const centerX = (item.position.x + 1) * dimensions.width / 2 + center.x * size * dimensions.width / sceneDimensions.width;
  const centerZ = (item.position.z + 1) * dimensions.depth / 2 + center.z * size * dimensions.depth / sceneDimensions.depth;
  const baseY = (item.position.y ?? 0) * dimensions.height;
  const worldToCentimetersY = dimensions.height / sceneDimensions.height;
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: baseY + opening.minY * size * worldToCentimetersY,
    maxY: baseY + opening.maxY * size * worldToCentimetersY,
    minZ: centerZ - halfDepth,
    maxZ: centerZ + halfDepth,
  };
}

function overlapOnAxis(firstMin: number, firstMax: number, secondMin: number, secondMax: number): number {
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}

function intersects(first: Bounds3D, second: Bounds3D, toleranceCm = 1): boolean {
  return overlapOnAxis(first.minX, first.maxX, second.minX, second.maxX) > toleranceCm &&
    overlapOnAxis(first.minY, first.maxY, second.minY, second.maxY) > toleranceCm &&
    overlapOnAxis(first.minZ, first.maxZ, second.minZ, second.maxZ) > toleranceCm;
}

function summarize(warnings: string[], safeDetail: string): string {
  if (warnings.length === 0) return safeDetail;
  const visibleWarnings = warnings.slice(0, 3);
  if (warnings.length > visibleWarnings.length) visibleWarnings.push(`+ ${warnings.length - visibleWarnings.length} autre(s)`);
  return visibleWarnings.join(" · ");
}

export function analyzeDecorationLayout(
  decorations: Decoration[],
  dimensions: { width: number; depth: number; height: number },
  shape: Shape,
  biotope: Biotope = "Désertique",
): DecorationLayoutWarnings {
  if (![dimensions.width, dimensions.depth, dimensions.height].every((value) => Number.isFinite(value) && value > 0)) {
    return { boundaries: [], clearances: [] };
  }

  const sceneDimensions = getTerrariumSceneDimensions(shape, dimensions);
  const objects = decorations.map((item, index) => getPositionedBounds(item, `${item.kind} ${String(index + 1).padStart(2, "0")}`, dimensions, sceneDimensions, biotope));
  const boundaries: string[] = [];
  const clearances: string[] = [];

  objects.forEach(({ bounds, label }) => {
    const exceeded: string[] = [];
    const addExceedance = (side: string, centimeters: number) => {
      if (centimeters > 1) exceeded.push(`${Math.ceil(centimeters)} cm ${side}`);
    };
    addExceedance("paroi gauche", -bounds.minX);
    addExceedance("paroi droite", bounds.maxX - dimensions.width);
    addExceedance("paroi arrière", -bounds.minZ);
    addExceedance("paroi avant", bounds.maxZ - dimensions.depth);
    addExceedance("sous le sol", -bounds.minY);
    addExceedance("au-dessus du plafond", bounds.maxY - dimensions.height);
    if (exceeded.length > 0) boundaries.push(`${label} dépasse de ${exceeded.join(" et ")}`);
  });

  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    const first = objects[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
      const second = objects[secondIndex];
      if (intersects(first.bounds, second.bounds)) clearances.push(`${first.label} chevauche ${second.label}`);
    }
  }

  objects.forEach(({ item, label }) => {
    for (const opening of getHideOpenings(item)) {
      const openingBounds = getOpeningBounds(item, opening, dimensions, sceneDimensions);
      const blocker = objects.find((candidate) => candidate.item.id !== item.id && intersects(openingBounds, candidate.bounds, 2));
      if (blocker) {
        clearances.push(`entrée de ${label} obstruée par ${blocker.label}`);
        break;
      }
    }
  });

  return { boundaries, clearances };
}

export function formatDecorationLayoutWarnings(warnings: DecorationLayoutWarnings): { boundaries: string; clearances: string } {
  return {
    boundaries: summarize(warnings.boundaries, "Aucun débordement des parois, du sol ou du plafond détecté."),
    clearances: summarize(warnings.clearances, "Aucun chevauchement ni accès obstrué détecté."),
  };
}

