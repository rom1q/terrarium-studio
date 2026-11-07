import { plantCatalog } from "../data/plantCatalog";
import type { Biotope, Decoration, DecorationVariant, PlantSilhouette } from "./projectLogic";

export type LocalModelBounds = { halfWidth: number; halfDepth: number; minY: number; maxY: number };
export type ModelOpening = { x: number; z: number; axis: "x" | "z"; halfWidth: number; halfDepth: number; minY: number; maxY: number };
export type DecorationGeometryProfile = { bounds: LocalModelBounds; rootOffsetY: number; openings: readonly ModelOpening[] };

type GenericPlantVariant = Extract<DecorationVariant, "Feuillage dense" | "Fougère" | "Rosette">;

export const plantGeometryProfiles: Record<PlantSilhouette, { bounds: LocalModelBounds }> = {
  fern: { bounds: { halfWidth: 0.8, halfDepth: 0.8, minY: 0, maxY: 1.1 } },
  "arching-straps": { bounds: { halfWidth: 0.5, halfDepth: 0.5, minY: 0, maxY: 1.1 } },
  rosette: { bounds: { halfWidth: 0.45, halfDepth: 0.45, minY: 0, maxY: 1.1 } },
  "spiky-rosette": { bounds: { halfWidth: 0.43, halfDepth: 0.43, minY: 0, maxY: 1.1 } },
  aloe: { bounds: { halfWidth: 0.5, halfDepth: 0.5, minY: 0, maxY: 1.1 } },
  broadleaf: { bounds: { halfWidth: 0.36, halfDepth: 0.36, minY: 0, maxY: 1.1 } },
  "prayer-leaves": { bounds: { halfWidth: 0.36, halfDepth: 0.36, minY: 0, maxY: 1.1 } },
  "bird-nest": { bounds: { halfWidth: 0.5, halfDepth: 0.5, minY: 0, maxY: 1.1 } },
  "ground-mat": { bounds: { halfWidth: 0.48, halfDepth: 0.48, minY: 0, maxY: 1.1 } },
  umbrella: { bounds: { halfWidth: 0.34, halfDepth: 0.34, minY: 0, maxY: 1.1 } },
  "grass-clump": { bounds: { halfWidth: 0.35, halfDepth: 0.35, minY: 0, maxY: 1.1 } },
};

export const genericPlantProfiles: Record<GenericPlantVariant, { silhouette: PlantSilhouette; heightScale: number; spreadScale: number }> = {
  "Feuillage dense": { silhouette: "broadleaf", heightScale: 0.9, spreadScale: 1 },
  Fougère: { silhouette: "fern", heightScale: 1, spreadScale: 1 },
  Rosette: { silhouette: "rosette", heightScale: 0.65, spreadScale: 0.9 },
};

export const rockGeometryProfiles = {
  angular: { radius: 0.32, scale: [1.2, 0.82, 0.95] as const, rootOffsetY: 0.263, bounds: { halfWidth: 0.42, halfDepth: 0.42, minY: -0.263, maxY: 0.263 } },
  pebble: { radius: 0.32, scale: [1.25, 0.72, 0.95] as const, rootOffsetY: 0.2304, bounds: { halfWidth: 0.4, halfDepth: 0.304, minY: -0.2304, maxY: 0.2304 } },
  stratified: {
    rootOffsetY: 0.16,
    layers: [
      { color: 0x655f57, y: -0.1, height: 0.12, topRadius: 0.28, bottomRadius: 0.37 },
      { color: 0xc3b79f, y: 0, height: 0.075, topRadius: 0.39, bottomRadius: 0.3 },
      { color: 0x91877a, y: 0.09, height: 0.095, topRadius: 0.27, bottomRadius: 0.35 },
    ],
    bounds: { halfWidth: 0.454, halfDepth: 0.454, minY: -0.16, maxY: 0.1375 },
  },
} as const;

export const hideGeometryProfiles = {
  cave: {
    outline: { halfWidth: 0.48, shoulderY: 0.4, topY: 0.98 },
    entrance: { halfWidth: 0.245, shoulderY: 0.27, topY: 0.58 },
    depth: 0.72,
    bevel: 0.025,
    curveSegments: 12,
    position: { y: 0.025, z: -0.36 },
    bounds: { halfWidth: 0.505, halfDepth: 0.385, minY: 0, maxY: 1.03 },
    openings: [-1, 1].map((direction) => ({ x: 0, z: direction * 0.48, axis: "z" as const, halfWidth: 0.245, halfDepth: 0.18, minY: 0, maxY: 0.58 })),
  },
  trunk: {
    length: 0.96,
    segments: 16,
    outerRadii: { top: 0.32, bottom: 0.35 },
    innerRadii: { top: 0.255, bottom: 0.285 },
    centerY: 0.34,
    rim: { radius: 0.29, tube: 0.035, radialSegments: 8, tubularSegments: 24 },
    bounds: { halfWidth: 0.515, halfDepth: 0.35, minY: -0.01, maxY: 0.69 },
    openings: [-1, 1].map((direction) => ({ x: direction * 0.48, z: 0, axis: "x" as const, halfWidth: 0.25, halfDepth: 0.2, minY: 0.08, maxY: 0.6 })),
  },
  bark: {
    outerRadius: 0.36,
    innerRadius: 0.29,
    length: 0.82,
    segments: 20,
    thetaStart: Math.PI / 2,
    thetaLength: Math.PI,
    centerY: 0,
    bounds: { halfWidth: 0.36, halfDepth: 0.41, minY: 0, maxY: 0.36 },
    openings: [-1, 1].map((direction) => ({ x: 0, z: direction * 0.41, axis: "z" as const, halfWidth: 0.31, halfDepth: 0.2, minY: 0, maxY: 0.36 })),
  },
} as const;

export const otherDecorationGeometryProfiles = {
  branch: {
    straight: {
      segments: [{ start: [-0.48, 0.16, 0], end: [0.48, 0.78, 0], radius: 0.075 }],
      bounds: { halfWidth: 0.52, halfDepth: 0.08, minY: 0.085, maxY: 0.83 },
    },
    forked: {
      segments: [
        { start: [-0.48, 0.16, 0], end: [0.48, 0.78, 0], radius: 0.075 },
        { start: [0.06, 0.48, 0], end: [-0.2, 0.9, 0.18], radius: 0.045 },
        { start: [0.23, 0.59, 0], end: [0.38, 0.98, -0.16], radius: 0.04 },
      ],
      bounds: { halfWidth: 0.52, halfDepth: 0.22, minY: 0.085, maxY: 1.02 },
    },
  },
  platform: {
    slab: { width: 0.92, height: 0.1, depth: 0.62, y: 0.48 },
    support: { width: 0.07, height: 0.42, depth: 0.07, x: [-0.36, 0.36], y: 0.22, z: [-0.22, 0.22] },
    bounds: { halfWidth: 0.46, halfDepth: 0.31, minY: 0.01, maxY: 0.53 },
  },
  bowl: {
    body: { topRadius: 0.28, bottomRadius: 0.21, height: 0.15, y: 0.075 },
    bottom: { radius: 0.21, height: 0.025, y: 0.02 },
    rim: { radius: 0.245, tube: 0.022, y: 0.145 },
    water: { radius: 0.18, height: 0.012, y: 0.075 },
    bounds: { halfWidth: 0.28, halfDepth: 0.28, minY: 0, maxY: 0.167 },
  },
  heater: {
    shade: { topRadius: 0.13, bottomRadius: 0.26, height: 0.22, y: -0.08 },
    bulb: { radius: 0.1, y: -0.22 },
    cable: { radius: 0.018, height: 0.18, y: 0.1 },
    bounds: { halfWidth: 0.26, halfDepth: 0.26, minY: -0.32, maxY: 0.2 },
  },
  uvb: {
    tube: { radius: 0.035, length: 0.95, y: -0.05 },
    mount: { width: 1.02, height: 0.07, depth: 0.1, y: 0.04 },
    bounds: { halfWidth: 0.51, halfDepth: 0.05, minY: -0.09, maxY: 0.08 },
  },
} as const;

function makeProfile(bounds: LocalModelBounds, rootOffsetY = 0, openings: readonly ModelOpening[] = []): DecorationGeometryProfile {
  return { bounds, rootOffsetY, openings };
}

export function getDecorationGeometryProfile(item: Decoration, biotope: Biotope): DecorationGeometryProfile {
  switch (item.kind) {
    case "Plante": {
      const catalogProfile = plantCatalog.find((plant) => plant.id === item.plantSpeciesId)?.visual;
      const genericVariant = item.variant === "Feuillage dense" || item.variant === "Fougère" || item.variant === "Rosette"
        ? item.variant
        : biotope === "Désertique" ? "Rosette" : "Feuillage dense";
      const genericProfile = genericPlantProfiles[genericVariant];
      const silhouette = catalogProfile?.silhouette ?? genericProfile.silhouette;
      const silhouetteBounds = plantGeometryProfiles[silhouette].bounds;
      const spreadScale = catalogProfile?.spreadScale ?? genericProfile.spreadScale;
      const heightScale = catalogProfile?.heightScale ?? genericProfile.heightScale;
      return makeProfile({
        halfWidth: silhouetteBounds.halfWidth * spreadScale,
        halfDepth: silhouetteBounds.halfDepth * spreadScale,
        minY: silhouetteBounds.minY,
        maxY: silhouetteBounds.maxY * heightScale,
      });
    }
    case "Roche": {
      const profile = item.variant === "Galet" ? rockGeometryProfiles.pebble : item.variant === "Stratifiée" ? rockGeometryProfiles.stratified : rockGeometryProfiles.angular;
      return makeProfile(profile.bounds, profile.rootOffsetY);
    }
    case "Cachette": {
      const profile = item.variant === "Tronc creux" ? hideGeometryProfiles.trunk : item.variant === "Écorce creuse" ? hideGeometryProfiles.bark : hideGeometryProfiles.cave;
      return makeProfile(profile.bounds, 0, profile.openings);
    }
    case "Branche":
      return makeProfile((item.variant === "Branche droite" ? otherDecorationGeometryProfiles.branch.straight : otherDecorationGeometryProfiles.branch.forked).bounds);
    case "Plateforme":
      return makeProfile(otherDecorationGeometryProfiles.platform.bounds);
    case "Gamelle":
      return makeProfile(otherDecorationGeometryProfiles.bowl.bounds);
    case "Lampe chauffante":
      return makeProfile(otherDecorationGeometryProfiles.heater.bounds);
    case "Tube UVB":
      return makeProfile(otherDecorationGeometryProfiles.uvb.bounds);
  }
}