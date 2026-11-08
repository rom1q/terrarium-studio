import type { LocalModelBounds } from "./decorationGeometry";
import type { DecorationVariant } from "./projectLogic";

export type BranchVariant = Extract<DecorationVariant, "Branche droite" | "Branche fourchue" | "Branche tortueuse" | "Bois flotté" | "Liane" | "Racine de mangrove">;
type Point = readonly [number, number, number];
export type BranchPath = { points: readonly Point[]; radius: number; tipRadius: number };
export type BranchStyle = {
  color: number;
  grooveColor: number;
  roughness: number;
  /** Fraction of the radius that grooves can cut inward. */
  grooveDepth: number;
  /** Radians of spiral per unit of length. */
  twist: number;
  /** Ridge frequency around the trunk. */
  ridges: number;
  description: string;
};
export type BranchSample = { position: Point; tangent: Point; radius: number };
export type BranchPattern = { paths: readonly BranchPath[]; bounds: LocalModelBounds; style: BranchStyle };

const SUBDIVISIONS = 10;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

// Shared by the model and the bounds so the rendered tube can never leave its declared box.
export function sampleBranchPath(path: BranchPath): BranchSample[] {
  const points = path.points;
  const reflect = (anchor: Point, neighbour: Point): Point => [2 * anchor[0] - neighbour[0], 2 * anchor[1] - neighbour[1], 2 * anchor[2] - neighbour[2]];
  const extended = [reflect(points[0], points[1]), ...points, reflect(points[points.length - 1], points[points.length - 2])];
  const positions: Point[] = [];
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    for (let step = 0; step < SUBDIVISIONS; step += 1) {
      const t = step / SUBDIVISIONS;
      const [p0, p1, p2, p3] = [extended[segment], extended[segment + 1], extended[segment + 2], extended[segment + 3]];
      positions.push([0, 1, 2].map((axis) => catmullRom(p0[axis], p1[axis], p2[axis], p3[axis], t)) as unknown as Point);
    }
  }
  positions.push(points[points.length - 1]);

  return positions.map((position, index) => {
    const before = positions[Math.max(index - 1, 0)];
    const after = positions[Math.min(index + 1, positions.length - 1)];
    const delta = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
    const length = Math.hypot(delta[0], delta[1], delta[2]) || 1;
    return {
      position,
      tangent: [delta[0] / length, delta[1] / length, delta[2] / length] as unknown as Point,
      radius: lerp(path.radius, path.tipRadius, index / (positions.length - 1)),
    };
  });
}

function computeBranchBounds(paths: readonly BranchPath[]): LocalModelBounds {
  let halfWidth = 0;
  let halfDepth = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    for (const { position, tangent, radius } of sampleBranchPath(path)) {
      // A circular cross-section perpendicular to the tangent reaches radius * sqrt(1 - tangent_axis^2) along each axis.
      const reach = (axis: number) => radius * Math.sqrt(Math.max(0, 1 - tangent[axis] ** 2));
      halfWidth = Math.max(halfWidth, Math.abs(position[0]) + reach(0));
      halfDepth = Math.max(halfDepth, Math.abs(position[2]) + reach(2));
      minY = Math.min(minY, position[1] - reach(1));
      maxY = Math.max(maxY, position[1] + reach(1));
    }
  }
  const round = (value: number) => Math.ceil(value * 1000) / 1000;
  return { halfWidth: round(halfWidth), halfDepth: round(halfDepth), minY: Math.floor(minY * 1000) / 1000, maxY: round(maxY) };
}

function definePattern(paths: readonly BranchPath[], style: BranchStyle): BranchPattern {
  return { paths, bounds: computeBranchBounds(paths), style };
}

export const branchPatterns: Record<BranchVariant, BranchPattern> = {
  "Branche droite": definePattern(
    [{ points: [[-0.48, 0.16, 0], [0.48, 0.78, 0]], radius: 0.075, tipRadius: 0.054 }],
    { color: 0x805f42, grooveColor: 0x45301f, roughness: 0.95, grooveDepth: 0.22, twist: 0.4, ridges: 3, description: "Branche rectiligne à écorce rugueuse" },
  ),
  "Branche fourchue": definePattern(
    [
      { points: [[-0.48, 0.16, 0], [0.48, 0.78, 0]], radius: 0.075, tipRadius: 0.054 },
      { points: [[0.06, 0.48, 0], [-0.2, 0.9, 0.18]], radius: 0.045, tipRadius: 0.032 },
      { points: [[0.23, 0.59, 0], [0.38, 0.98, -0.16]], radius: 0.04, tipRadius: 0.029 },
    ],
    { color: 0x705238, grooveColor: 0x3f2b1b, roughness: 0.95, grooveDepth: 0.22, twist: 0.4, ridges: 3, description: "Branche ramifiée à écorce rugueuse" },
  ),
  "Branche tortueuse": definePattern(
    [
      { points: [[-0.5, 0.14, 0.02], [-0.3, 0.3, 0.12], [-0.08, 0.36, -0.1], [0.16, 0.58, -0.02], [0.32, 0.7, 0.12], [0.5, 0.9, 0.02]], radius: 0.075, tipRadius: 0.035 },
      { points: [[-0.08, 0.36, -0.1], [-0.2, 0.58, -0.2], [-0.3, 0.82, -0.14]], radius: 0.04, tipRadius: 0.02 },
      { points: [[0.16, 0.58, -0.02], [0.12, 0.82, 0.1], [0.2, 1.02, 0.06]], radius: 0.035, tipRadius: 0.018 },
    ],
    { color: 0x8d4a33, grooveColor: 0x5a2e20, roughness: 0.72, grooveDepth: 0.1, twist: 2.2, ridges: 2, description: "Bois noueux et vrillé à écorce lisse rouge" },
  ),
  "Bois flotté": definePattern(
    [
      { points: [[-0.5, 0.1, 0], [-0.34, 0.2, 0.04], [-0.1, 0.27, 0.02], [0.14, 0.27, -0.03], [0.36, 0.19, -0.02], [0.5, 0.1, 0.02]], radius: 0.1, tipRadius: 0.085 },
      { points: [[0, 0.27, 0], [0.08, 0.46, 0.05], [0.2, 0.6, 0.03]], radius: 0.05, tipRadius: 0.03 },
    ],
    { color: 0xb8aa90, grooveColor: 0x8a7d66, roughness: 0.88, grooveDepth: 0.16, twist: 0.8, ridges: 4, description: "Bois blanchi, lissé et fissuré par l’eau" },
  ),
  Liane: definePattern(
    [
      { points: [[-0.46, 0.95, 0], [-0.2, 0.84, 0.1], [-0.3, 0.62, -0.1], [-0.04, 0.5, 0.1], [-0.1, 0.3, -0.08], [0.18, 0.2, 0.08], [0.42, 0.1, -0.04]], radius: 0.028, tipRadius: 0.02 },
      { points: [[-0.2, 0.84, 0.1], [0.04, 0.78, 0.2], [0.2, 0.62, 0.14]], radius: 0.016, tipRadius: 0.01 },
    ],
    { color: 0x5a432e, grooveColor: 0x2f2217, roughness: 0.9, grooveDepth: 0.3, twist: 9, ridges: 3, description: "Tige souple et fibreuse qui serpente" },
  ),
  "Racine de mangrove": definePattern(
    [
      { points: [[0, 0.1, 0], [0, 0.4, 0], [0.02, 0.72, 0]], radius: 0.08, tipRadius: 0.06 },
      { points: [[0, 0.62, 0], [0.2, 0.6, 0.08], [0.38, 0.4, 0.12], [0.46, 0.05, 0.14]], radius: 0.04, tipRadius: 0.022 },
      { points: [[0, 0.58, 0], [-0.2, 0.55, -0.06], [-0.36, 0.35, -0.1], [-0.46, 0.05, -0.12]], radius: 0.04, tipRadius: 0.022 },
      { points: [[0, 0.55, 0], [0.06, 0.5, -0.22], [0.1, 0.3, -0.36], [0.12, 0.05, -0.42]], radius: 0.038, tipRadius: 0.022 },
      { points: [[0, 0.55, 0], [-0.08, 0.5, 0.2], [-0.12, 0.3, 0.34], [-0.14, 0.05, 0.4]], radius: 0.038, tipRadius: 0.022 },
    ],
    { color: 0x5d3b2b, grooveColor: 0x34211a, roughness: 0.93, grooveDepth: 0.2, twist: 1.2, ridges: 5, description: "Racines-échasses arquées de palétuvier" },
  ),
};

export function getBranchPattern(variant: DecorationVariant | undefined): BranchPattern {
  return variant && Object.prototype.hasOwnProperty.call(branchPatterns, variant) ? branchPatterns[variant as BranchVariant] : branchPatterns["Branche fourchue"];
}
