import { getDecorationGeometryProfile, type DecorationGeometryProfile, type ModelOpening } from "./decorationGeometry";
import type { Biotope, Decoration, Shape } from "./projectLogic";

export type TerrariumSceneDimensions = { width: number; depth: number; height: number };
export type LayoutBounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
export type LayoutWarningType = "boundary" | "overlap" | "entry";
export type LayoutSuggestion = { id: string; decorationId: number; position: { x: number; y: number; z: number }; distanceCm: number; message: string };
export type LayoutWarning = { id: string; type: LayoutWarningType; decorationIds: number[]; message: string; bounds: LayoutBounds[]; suggestions: LayoutSuggestion[] };
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

function getDecorationLayoutWarnings(
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
        suggestions: [],
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
          suggestions: [],
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
          suggestions: [],
        });
        break;
      }
    }
  });

  return { boundaries, clearances };
}

type AxisMove = { x: number; y: number; z: number };

function getSeparationMoves(obstacle: Bounds3D, moving: Bounds3D): AxisMove[] {
  return [
    { x: obstacle.minX - moving.maxX - 2, y: 0, z: 0 },
    { x: obstacle.maxX - moving.minX + 2, y: 0, z: 0 },
    { x: 0, y: obstacle.minY - moving.maxY - 2, z: 0 },
    { x: 0, y: obstacle.maxY - moving.minY + 2, z: 0 },
    { x: 0, y: 0, z: obstacle.minZ - moving.maxZ - 2 },
    { x: 0, y: 0, z: obstacle.maxZ - moving.minZ + 2 },
  ];
}

function toSuggestionPosition(item: Decoration, move: AxisMove, dimensions: { width: number; depth: number; height: number }) {
  return {
    x: item.position.x + move.x * 2 / dimensions.width,
    y: (item.position.y ?? 0) + move.y / dimensions.height,
    z: item.position.z + move.z * 2 / dimensions.depth,
  };
}

function getSuggestionMessage(move: AxisMove): string {
  const axis = Math.abs(move.x) > 0 ? move.x < 0 ? "la gauche" : "la droite"
    : Math.abs(move.y) > 0 ? move.y < 0 ? "le bas" : "le haut"
      : move.z < 0 ? "l’arrière" : "l’avant";
  const distance = Math.ceil(Math.hypot(move.x, move.y, move.z));
  return `Déplacer de ${distance} cm vers ${axis}`;
}

function getCorrectionMoves(
  warning: LayoutWarning,
  decorations: Decoration[],
  dimensions: { width: number; depth: number; height: number },
): { item: Decoration; moves: AxisMove[] } | null {
  if (warning.type === "boundary") {
    const item = decorations.find((decoration) => decoration.id === warning.decorationIds[0]);
    const bounds = warning.bounds[0];
    if (!item || !bounds) return null;
    const move = {
      x: bounds.minX < 0 ? -bounds.minX + 2 : bounds.maxX > dimensions.width ? dimensions.width - bounds.maxX - 2 : 0,
      y: bounds.minY < 0 ? -bounds.minY + 2 : bounds.maxY > dimensions.height ? dimensions.height - bounds.maxY - 2 : 0,
      z: bounds.minZ < 0 ? -bounds.minZ + 2 : bounds.maxZ > dimensions.depth ? dimensions.depth - bounds.maxZ - 2 : 0,
    };
    return { item, moves: [move] };
  }

  const item = decorations.find((decoration) => decoration.id === warning.decorationIds[1]);
  const obstacle = warning.bounds[0];
  const moving = warning.bounds[1];
  if (!item || !obstacle || !moving) return null;
  return { item, moves: getSeparationMoves(obstacle, moving) };
}

function expandCorrectionMoves(moves: AxisMove[]): AxisMove[] {
  const increments = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300];
  const expanded = [...moves];
  for (const move of moves) {
    for (const axis of ["x", "y", "z"] as const) {
      if (move[axis] === 0) continue;
      increments.forEach((increment) => {
        const candidate = { ...move, [axis]: move[axis] + Math.sign(move[axis]) * increment };
        if (!expanded.some((existing) => existing.x === candidate.x && existing.y === candidate.y && existing.z === candidate.z)) expanded.push(candidate);
      });
    }
  }
  return expanded;
}

function hasSameWarning(warnings: DecorationLayoutWarnings, warning: LayoutWarning): boolean {
  return [...warnings.boundaries, ...warnings.clearances].some((candidate) => candidate.id === warning.id);
}

function createSuggestions(
  warning: LayoutWarning,
  decorations: Decoration[],
  dimensions: { width: number; depth: number; height: number },
  shape: Shape,
  biotope: Biotope,
  existingWarnings: DecorationLayoutWarnings,
): LayoutSuggestion[] {
  const correction = getCorrectionMoves(warning, decorations, dimensions);
  if (!correction) return [];
  const { item } = correction;
  const existingWarningIds = new Set([...existingWarnings.boundaries, ...existingWarnings.clearances].map((candidate) => candidate.id));

  return expandCorrectionMoves(correction.moves)
    .map((move, index) => {
      const position = toSuggestionPosition(item, move, dimensions);
      if (position.x < -1 || position.x > 1 || position.z < -1 || position.z > 1 || position.y < 0 || position.y > 1) return null;
      const updatedDecorations = decorations.map((decoration) => decoration.id === item.id ? { ...decoration, position } : decoration);
      const updatedWarnings = getDecorationLayoutWarnings(updatedDecorations, dimensions, shape, biotope);
      const introducedWarning = [...updatedWarnings.boundaries, ...updatedWarnings.clearances].some((candidate) =>
        candidate.decorationIds.includes(item.id) && !existingWarningIds.has(candidate.id),
      );
      if (hasSameWarning(updatedWarnings, warning) || introducedWarning) return null;

      const distanceCm = Math.ceil(Math.hypot(move.x, move.y, move.z));
      return {
        id: `${warning.id}:suggestion:${index}`,
        decorationId: item.id,
        position,
        distanceCm,
        message: getSuggestionMessage(move),
      };
    })
    .filter((suggestion): suggestion is LayoutSuggestion => suggestion !== null)
    .sort((first, second) => first.distanceCm - second.distanceCm)
    .slice(0, 3);
}

export function analyzeDecorationLayout(
  decorations: Decoration[],
  dimensions: { width: number; depth: number; height: number },
  shape: Shape,
  biotope: Biotope = "Désertique",
): DecorationLayoutWarnings {
  const warnings = getDecorationLayoutWarnings(decorations, dimensions, shape, biotope);
  const addSuggestions = (warning: LayoutWarning) => ({
    ...warning,
    suggestions: createSuggestions(warning, decorations, dimensions, shape, biotope, warnings),
  });
  return {
    boundaries: warnings.boundaries.map(addSuggestions),
    clearances: warnings.clearances.map(addSuggestions),
  };
}

export function applyDecorationLayoutSuggestion(decorations: Decoration[], suggestion: LayoutSuggestion): Decoration[] {
  return decorations.map((item) => item.id === suggestion.decorationId
    ? { ...item, position: suggestion.position }
    : item);
}

export function formatDecorationLayoutWarnings(warnings: DecorationLayoutWarnings): { boundaries: string; clearances: string } {
  return {
    boundaries: summarize(warnings.boundaries, "Aucun débordement des parois, du sol ou du plafond détecté."),
    clearances: summarize(warnings.clearances, "Aucun chevauchement ni accès obstrué détecté."),
  };
}

