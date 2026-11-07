import { getDecorationGeometryProfile, type DecorationGeometryProfile, type ModelOpening } from "./decorationGeometry";
import type { Biotope, Decoration, Shape } from "./projectLogic";

export type TerrariumSceneDimensions = { width: number; depth: number; height: number };
export type LayoutBounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
export type LayoutWarningType = "boundary" | "overlap" | "entry";
export type LayoutWarning = { id: string; type: LayoutWarningType; decorationIds: number[]; message: string; bounds: LayoutBounds[] };
export type DecorationLayoutWarnings = { boundaries: LayoutWarning[]; clearances: LayoutWarning[] };

type Bounds3D = LayoutBounds;
type PositionedBounds = { item: Decoration; label: string; bounds: Bounds3D; profile: DecorationGeometryProfile };

export function getTerrariumSceneDimensions(shape: Shape, dimensions: { width: number; depth: number; height: number }): TerrariumSceneDimensions {
  const width = Math.min(3.2, Math.max(1.7, dimensions.width / 58));
  const depth = Math.min(2.5, Math.max(1.25, dimensions.depth / 38));
  const heightScale = shape === "Verticale" ? 0.038 : shape === "Cubique" ? 0.03 : 0.022;
  const height = Math.min(3.1, Math.max(1.65, dimensions.height * heightScale));
  return { width, depth, height };
}

function getPositionedBounds(
  item: Decoration,
  label: string,
  dimensions: { width: number; depth: number; height: number },
  sceneDimensions: TerrariumSceneDimensions,
  biotope: Biotope,
): PositionedBounds {
  const profile = getDecorationGeometryProfile(item, biotope);
  const local = profile.bounds;
  const rotation = (item.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const size = (item.size ?? 100) / 100;
  const halfWidth = (cosine * local.halfWidth + sine * local.halfDepth) * size * dimensions.width / sceneDimensions.width;
  const halfDepth = (sine * local.halfWidth + cosine * local.halfDepth) * size * dimensions.depth / sceneDimensions.depth;
  const centerX = (item.position.x + 1) * dimensions.width / 2;
  const centerZ = (item.position.z + 1) * dimensions.depth / 2;
  const worldToCentimetersY = dimensions.height / sceneDimensions.height;
  const baseY = (item.position.y ?? 0) * dimensions.height + profile.rootOffsetY * worldToCentimetersY;
  return {
    item,
    label,
    profile,
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
  opening: ModelOpening,
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

function summarize(warnings: LayoutWarning[], safeDetail: string): string {
  if (warnings.length === 0) return safeDetail;
  const visibleWarnings = warnings.slice(0, 3).map((warning) => warning.message);
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
  const boundaries: LayoutWarning[] = [];
  const clearances: LayoutWarning[] = [];

  objects.forEach(({ item, bounds, label }) => {
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
    if (exceeded.length > 0) {
      boundaries.push({
        id: `boundary:${item.id}`,
        type: "boundary",
        decorationIds: [item.id],
        message: `${label} dépasse de ${exceeded.join(" et ")}`,
        bounds: [bounds],
      });
    }
  });

  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    const first = objects[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
      const second = objects[secondIndex];
      if (intersects(first.bounds, second.bounds)) {
        clearances.push({
          id: `overlap:${first.item.id}:${second.item.id}`,
          type: "overlap",
          decorationIds: [first.item.id, second.item.id],
          message: `${first.label} chevauche ${second.label}`,
          bounds: [first.bounds, second.bounds],
        });
      }
    }
  }

  objects.forEach(({ item, label, profile }) => {
    for (const opening of profile.openings) {
      const openingBounds = getOpeningBounds(item, opening, dimensions, sceneDimensions);
      const blocker = objects.find((candidate) => candidate.item.id !== item.id && intersects(openingBounds, candidate.bounds, 2));
      if (blocker) {
        clearances.push({
          id: `entry:${item.id}:${blocker.item.id}`,
          type: "entry",
          decorationIds: [item.id, blocker.item.id],
          message: `entrée de ${label} obstruée par ${blocker.label}`,
          bounds: [openingBounds, blocker.bounds],
        });
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

