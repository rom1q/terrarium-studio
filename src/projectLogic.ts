export type Shape = "Basse" | "Cubique" | "Verticale";
export type Biotope = "Désertique" | "Tropical" | "Paludarium";
export type LifeStage = "juvenile" | "adult";
export type BiotopeCompatibilityStatus = "compatible" | "incompatible" | "unknown";
export type BiotopeGuidance = { status: BiotopeCompatibilityStatus; detail: string };
export const decorationVariants = {
  Plante: ["Feuillage dense", "Fougère", "Rosette"],
  Roche: ["Roche anguleuse", "Galet", "Stratifiée"],
  Cachette: ["Grotte", "Tronc creux", "Écorce creuse"],
} as const;
export type DecorationKind = keyof typeof decorationVariants;
export type DecorationVariant = (typeof decorationVariants)[DecorationKind][number];
export const defaultDecorationVariant: Record<DecorationKind, DecorationVariant> = {
  Plante: "Feuillage dense",
  Roche: "Roche anguleuse",
  Cachette: "Grotte",
};
export const plantStylesByBiotope: Record<Biotope, readonly Extract<DecorationVariant, "Feuillage dense" | "Fougère" | "Rosette">[]> = {
  Désertique: ["Rosette"],
  Tropical: ["Feuillage dense", "Fougère"],
  Paludarium: ["Feuillage dense", "Fougère"],
};
export type Decoration = { id: number; kind: DecorationKind; variant?: DecorationVariant; position: { x: number; y?: number; z: number }; size?: number; rotation?: number };
export type DecorationAxis = "x" | "y" | "z";
export type PositionedDecoration = Decoration & { xCm: number; yCm: number; zCm: number; nearestWallCm: number };
export type SpeciesSource = { title: string; publisher: string; url: string; checkedAt: string };
export type Measurements = { hotSideTemperature: number | null; coolSideTemperature: number | null; baskingUvi: number | null; coolSideHumidity: number | null };
export type MeasurementKey = keyof Measurements;
export type ReferenceRanges = Partial<Record<MeasurementKey, readonly [number, number]>>;
export type CheckStatus = "met" | "insufficient" | "attention" | "unknown";
export type SpeciesProfile = {
  label: string;
  scientificName: string;
  commonName: string;
  source: SpeciesSource | null;
  stageGuidance?: Partial<Record<LifeStage, string>>;
  minimumDimensions: { width: number; depth: number; height: number } | null;
  referenceRanges: ReferenceRanges | null;
  hidesAtBothEnds: boolean | null;
  biotopeGuidance?: Partial<Record<Biotope, BiotopeGuidance>>;
};
export type StoredProject = {
  id: string;
  name: string;
  shape: Shape;
  biotope: Biotope;
  dimensions: { width: number; depth: number; height: number };
  species: string;
  decorations: Decoration[];
  nextId: number;
  lifeStage?: LifeStage;
  measurements?: Measurements;
};
export type ProjectExport = { format: "terrarium-studio-project"; version: 1; exportedAt: string; project: StoredProject };
export type ProjectCheck = { label: string; status: CheckStatus; detail: string };
export type ProjectCheckSummary = {
  checks: ProjectCheck[];
  hasInsufficientCheck: boolean;
  hasAttentionCheck: boolean;
  allChecksDocumented: boolean;
  overallStatus: string;
};
export type ProjectCheckInput = {
  species: Pick<SpeciesProfile, "minimumDimensions" | "referenceRanges" | "hidesAtBothEnds">;
  dimensions: { width: number; depth: number; height: number };
  decorations: Decoration[];
  measurements: Measurements;
  lifeStage?: LifeStage;
};

export const PROJECT_EXPORT_FORMAT = "terrarium-studio-project";

export function getBiotopeGuidance(species: Pick<SpeciesProfile, "biotopeGuidance">, biotope: Biotope): BiotopeGuidance {
  return species.biotopeGuidance?.[biotope] ?? { status: "unknown", detail: "Compatibilité non documentée par une source vérifiée." };
}

export function resolveBiotopeSelection(species: SpeciesProfile, requestedBiotope: Biotope): Biotope {
  if (getBiotopeGuidance(species, requestedBiotope).status !== "incompatible") return requestedBiotope;
  const biotopes: Biotope[] = ["Désertique", "Tropical", "Paludarium"];
  return biotopes.find((biotope) => getBiotopeGuidance(species, biotope).status === "compatible") ?? requestedBiotope;
}

export function getDecorationVariantsForBiotope(kind: DecorationKind, biotope: Biotope): readonly DecorationVariant[] {
  return kind === "Plante" ? plantStylesByBiotope[biotope] : decorationVariants[kind];
}

export function getDefaultDecorationVariant(kind: DecorationKind, biotope: Biotope): DecorationVariant {
  return kind === "Plante" ? plantStylesByBiotope[biotope][0] : defaultDecorationVariant[kind];
}

export function measureDecorationPlacement(
  decorations: Decoration[],
  dimensions: { width: number; depth: number; height: number },
): PositionedDecoration[] {
  return decorations.map((item) => {
    const x = (item.position.x + 1) * dimensions.width / 2;
    const z = (item.position.z + 1) * dimensions.depth / 2;
    return {
      ...item,
      xCm: Math.round(x),
      yCm: Math.round((item.position.y ?? 0) * dimensions.height),
      zCm: Math.round(z),
      nearestWallCm: Math.round(Math.min(x, dimensions.width - x, z, dimensions.depth - z)),
    };
  });
}

export function positionDecorationAtCm(
  decorations: Decoration[],
  id: number,
  axis: DecorationAxis,
  centimeters: number,
  dimensions: { width: number; depth: number; height: number },
): Decoration[] {
  const axisLength = axis === "x" ? dimensions.width : axis === "y" ? dimensions.height : dimensions.depth;
  if (!Number.isFinite(centimeters) || !Number.isFinite(axisLength) || axisLength <= 0) return decorations;
  const clampedCentimeters = Math.min(axisLength, Math.max(0, centimeters));
  const normalizedPosition = axis === "y" ? clampedCentimeters / axisLength : clampedCentimeters * 2 / axisLength - 1;
  return decorations.map((item) => item.id === id
    ? { ...item, position: { ...item.position, [axis]: normalizedPosition } }
    : item);
}

export function resizeDecoration(decorations: Decoration[], id: number, size: number): Decoration[] {
  if (!Number.isFinite(size)) return decorations;
  const normalizedSize = Math.min(150, Math.max(50, size));
  return decorations.map((item) => item.id === id ? { ...item, size: normalizedSize } : item);
}

export function rotateDecoration(decorations: Decoration[], id: number, degrees: number): Decoration[] {
  if (!Number.isFinite(degrees)) return decorations;
  const rotation = ((degrees % 360) + 360) % 360;
  return decorations.map((item) => item.id === id ? { ...item, rotation } : item);
}

export function duplicateDecoration(decorations: Decoration[], id: number, newId: number): Decoration[] {
  const source = decorations.find((item) => item.id === id);
  if (!source || !Number.isInteger(newId) || newId < 1 || decorations.some((item) => item.id === newId)) return decorations;
  const offset = (coordinate: number) => coordinate >= 0.85 ? coordinate - 0.15 : coordinate + 0.15;
  const clamp = (coordinate: number) => Math.min(1, Math.max(-1, coordinate));
  return [...decorations, {
    ...source,
    id: newId,
    position: { ...source.position, x: clamp(offset(source.position.x)), z: clamp(offset(source.position.z)) },
  }];
}

export function updateDecorationVariant(decorations: Decoration[], id: number, variant: string): Decoration[] {
  const target = decorations.find((item) => item.id === id);
  if (!target || !decorationVariants[target.kind].some((option) => option === variant)) return decorations;
  return decorations.map((item) => item.id === id ? { ...item, variant: variant as DecorationVariant } : item);
}

export function isStoredProject(value: unknown, allowedSpecies: readonly string[]): value is StoredProject {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;
  const dimensions = project.dimensions;
  const isValidDimensions = typeof dimensions === "object" && dimensions !== null &&
    ["width", "depth", "height"].every((key) => {
      const dimension = (dimensions as Record<string, unknown>)[key];
      return typeof dimension === "number" && Number.isFinite(dimension);
    });
  const isValidDecorations = Array.isArray(project.decorations) && project.decorations.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const decoration = item as Record<string, unknown>;
    const position = decoration.position;
    const isValidKind = ["Plante", "Cachette", "Roche"].includes(decoration.kind as string);
    const allowedVariants: readonly string[] = isValidKind ? decorationVariants[decoration.kind as DecorationKind] : [];
    const isValidVariant = decoration.variant === undefined || (typeof decoration.variant === "string" && allowedVariants.includes(decoration.variant));
    const isValidPosition = typeof position === "object" && position !== null &&
      typeof (position as Record<string, unknown>).x === "number" &&
      typeof (position as Record<string, unknown>).z === "number" &&
      ((position as Record<string, unknown>).y === undefined || (typeof (position as Record<string, unknown>).y === "number" && Number.isFinite((position as Record<string, unknown>).y) && (position as Record<string, number>).y >= 0 && (position as Record<string, number>).y <= 1));
    return Number.isInteger(decoration.id) &&
      isValidKind && isValidVariant &&
      isValidPosition &&
      (decoration.size === undefined || (typeof decoration.size === "number" && Number.isFinite(decoration.size) && decoration.size >= 50 && decoration.size <= 150)) &&
      (decoration.rotation === undefined || (typeof decoration.rotation === "number" && Number.isFinite(decoration.rotation) && decoration.rotation >= 0 && decoration.rotation < 360));
  });
  const measurements = project.measurements;
  const isValidLifeStage = project.lifeStage === undefined || project.lifeStage === "juvenile" || project.lifeStage === "adult";
  const isValidMeasurements = measurements === undefined || (
    typeof measurements === "object" && measurements !== null &&
    (["hotSideTemperature", "coolSideTemperature", "baskingUvi", "coolSideHumidity"] as const).every((key) => {
      const measurement = (measurements as Record<string, unknown>)[key];
      return measurement === null || (typeof measurement === "number" && Number.isFinite(measurement));
    })
  );

  return typeof project.id === "string" && typeof project.name === "string" &&
    ["Basse", "Cubique", "Verticale"].includes(project.shape as string) &&
    ["Désertique", "Tropical", "Paludarium"].includes(project.biotope as string) &&
    isValidDimensions && isValidLifeStage && typeof project.species === "string" && allowedSpecies.includes(project.species) &&
    isValidDecorations && isValidMeasurements && Number.isInteger(project.nextId);
}

export function parseProjectExport(value: unknown, allowedSpecies: readonly string[]): StoredProject | null {
  if (typeof value !== "object" || value === null) return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.format !== PROJECT_EXPORT_FORMAT || envelope.version !== 1 || typeof envelope.exportedAt !== "string" || Number.isNaN(Date.parse(envelope.exportedAt))) return null;
  const projectValue = envelope.project;
  if (!isStoredProject(projectValue, allowedSpecies)) return null;

  const project = projectValue;
  const dimensions = [project.dimensions.width, project.dimensions.depth, project.dimensions.height];
  const decorationIds = project.decorations.map((item) => item.id);
  const validDimensions = dimensions.every((dimension) => dimension >= 0 && dimension <= 1000);
  const validPositions = project.decorations.every((item) => Number.isFinite(item.position.x) && Number.isFinite(item.position.z) && Math.abs(item.position.x) <= 1 && Math.abs(item.position.z) <= 1 && (item.position.y === undefined || (Number.isFinite(item.position.y) && item.position.y >= 0 && item.position.y <= 1)));
  const validIds = decorationIds.every((id) => id > 0) && new Set(decorationIds).size === decorationIds.length && project.nextId > Math.max(0, ...decorationIds);
  if (!validDimensions || !validPositions || !validIds || !project.name.trim() || project.name.length > 60) return null;
  return project;
}

export function calculateProjectChecks({ species, dimensions, decorations, measurements, lifeStage = "adult" }: ProjectCheckInput): ProjectCheckSummary {
  const minimumDimensions = lifeStage === "adult" ? species.minimumDimensions : null;
  const referenceRanges = lifeStage === "adult" ? species.referenceRanges : null;
  const hidesAtBothEnds = lifeStage === "adult" ? species.hidesAtBothEnds : null;
  const dimensionsMeetMinimum = minimumDimensions !== null &&
    dimensions.width >= minimumDimensions.width &&
    dimensions.depth >= minimumDimensions.depth &&
    dimensions.height >= minimumDimensions.height;
  const hasHideAtLeftEnd = decorations.some((item) => item.kind === "Cachette" && item.position.x <= -0.5);
  const hasHideAtRightEnd = decorations.some((item) => item.kind === "Cachette" && item.position.x >= 0.5);
  const hideEndCount = Number(hasHideAtLeftEnd) + Number(hasHideAtRightEnd);
  const hidingCheck: ProjectCheck = hidesAtBothEnds === null
    ? { label: "Cachettes aux deux extrémités", status: "unknown", detail: "Non documenté" }
    : {
      label: "Cachettes aux deux extrémités",
      status: hideEndCount === 2 ? "met" : "insufficient",
      detail: hideEndCount === 2 ? "2/2 extrémités couvertes" : `${hideEndCount}/2 extrémités · cachette manquante dans le quart ${hasHideAtLeftEnd ? "droit" : "gauche"}`,
    };
  const rangeCheck = (label: string, key: MeasurementKey, unit: string): ProjectCheck => {
    const range = referenceRanges?.[key];
    const value = measurements[key];
    if (!range) return { label, status: "unknown", detail: "Non documenté" };
    const rangeLabel = `${range[0]}–${range[1]} ${unit}`;
    if (value === null) return { label, status: "unknown", detail: `À mesurer · repère ${rangeLabel}` };
    const isInRange = value >= range[0] && value <= range[1];
    return {
      label,
      status: isInRange ? "met" : "attention",
      detail: `${value} ${unit} · ${isInRange ? "dans la plage" : "hors plage"} ${rangeLabel}`,
    };
  };
  const checks: ProjectCheck[] = [
    {
      label: "Dimensions minimales",
      status: minimumDimensions === null ? "unknown" : dimensionsMeetMinimum ? "met" : "insufficient",
      detail: minimumDimensions === null ? "Non documenté" : `${dimensionsMeetMinimum ? "Respecté" : "Insuffisant"} · min. ${minimumDimensions.width} × ${minimumDimensions.depth} × ${minimumDimensions.height} cm`,
    },
    rangeCheck("Zone chaude", "hotSideTemperature", "°C"),
    rangeCheck("Zone fraîche", "coolSideTemperature", "°C"),
    rangeCheck("UVI zone de basking", "baskingUvi", "UVI"),
    rangeCheck("Humidité côté frais", "coolSideHumidity", "%"),
    hidingCheck,
    { label: "Autre enrichissement", status: "unknown", detail: "Non documenté" },
  ];
  const hasInsufficientCheck = checks.some((check) => check.status === "insufficient");
  const hasAttentionCheck = checks.some((check) => check.status === "attention");
  const allChecksDocumented = checks.every((check) => check.status !== "unknown");
  const overallStatus = hasInsufficientCheck ? "Repères à compléter" : hasAttentionCheck ? "Mesure à vérifier" : allChecksDocumented ? "Dans les repères consultés" : "À documenter";
  return { checks, hasInsufficientCheck, hasAttentionCheck, allChecksDocumented, overallStatus };
}

export type RenameProjectResult =
  | { ok: true; project: StoredProject; projects: StoredProject[] }
  | { ok: false; reason: "not-found" | "empty-name" | "duplicate-name" };

export function renameSavedProjectRecord(projects: StoredProject[], id: string, name: string): RenameProjectResult {
  const existing = projects.find((project) => project.id === id);
  if (!existing) return { ok: false, reason: "not-found" };
  const normalizedName = name.trim();
  if (!normalizedName) return { ok: false, reason: "empty-name" };
  if (projects.some((project) => project.id !== id && project.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
    return { ok: false, reason: "duplicate-name" };
  }
  const project = { ...existing, name: normalizedName };
  return { ok: true, project, projects: projects.map((item) => item.id === id ? project : item) };
}

export function removeSavedProjectRecord(projects: StoredProject[], id: string): StoredProject[] {
  return projects.filter((project) => project.id !== id);
}