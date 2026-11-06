import { describe, expect, it } from "vitest";
import {
  calculateProjectChecks,
  isStoredProject,
  measureDecorationPlacement,
  parseProjectExport,
  positionDecorationAtCm,
  PROJECT_EXPORT_FORMAT,
  removeSavedProjectRecord,
  resizeDecoration,
  renameSavedProjectRecord,
  type Measurements,
  type ProjectExport,
  type SpeciesProfile,
  type StoredProject,
} from "./projectLogic";

const speciesLabels = ["Pogona vitticeps · Dragon barbu", "Dendrobates tinctorius · Dendrobate"];

const pogona: SpeciesProfile = {
  label: speciesLabels[0],
  scientificName: "Pogona vitticeps",
  commonName: "Dragon barbu",
  source: null,
  minimumDimensions: { width: 120, depth: 60, height: 60 },
  referenceRanges: {
    hotSideTemperature: [38, 42],
    coolSideTemperature: [22, 26],
    baskingUvi: [3, 5],
    coolSideHumidity: [30, 40],
  },
  hidesAtBothEnds: true,
};

const measurements: Measurements = {
  hotSideTemperature: 40,
  coolSideTemperature: 24,
  baskingUvi: 4,
  coolSideHumidity: 35,
};

const project: StoredProject = {
  id: "project-1",
  name: "Habitat test",
  shape: "Basse",
  biotope: "Tropical",
  dimensions: { width: 120, depth: 60, height: 80 },
  species: speciesLabels[0],
  lifeStage: "adult",
  decorations: [
    { id: 1, kind: "Cachette", position: { x: -0.5, z: 0 } },
    { id: 2, kind: "Cachette", position: { x: 0.5, z: 0 } },
  ],
  nextId: 3,
  measurements,
};

const projectExport: ProjectExport = {
  format: PROJECT_EXPORT_FORMAT,
  version: 1,
  exportedAt: "2026-11-06T12:00:00.000Z",
  project,
};

describe("project export validation", () => {
  it("accepts a valid project export", () => {
    expect(parseProjectExport(projectExport, speciesLabels)).toEqual(project);
  });

  it("preserves life stage in project exports", () => {
    const juvenileProject = { ...project, lifeStage: "juvenile" as const };

    expect(parseProjectExport({ ...projectExport, project: juvenileProject }, speciesLabels)?.lifeStage).toBe("juvenile");
  });

  it("accepts older projects without measurements", () => {
    const { measurements: _measurements, lifeStage: _lifeStage, ...legacyProject } = project;
    expect(isStoredProject(legacyProject, speciesLabels)).toBe(true);
    expect(parseProjectExport({ ...projectExport, project: legacyProject }, speciesLabels)).toEqual(legacyProject);
  });

  it.each([
    ["unsupported version", { ...projectExport, version: 2 }],
    ["invalid timestamp", { ...projectExport, exportedAt: "not-a-date" }],
    ["invalid life stage", { ...projectExport, project: { ...project, lifeStage: "hatchling" } }],
    ["unknown species", { ...projectExport, project: { ...project, species: "Unknown species" } }],
    ["oversized dimensions", { ...projectExport, project: { ...project, dimensions: { ...project.dimensions, width: 1001 } } }],
    ["position outside terrarium", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], position: { x: 1.1, z: 0 } }] } }],
    ["decoration size outside supported range", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], size: 151 }] } }],
    ["duplicate decoration IDs", { ...projectExport, project: { ...project, decorations: [project.decorations[0], { ...project.decorations[1], id: project.decorations[0].id }] } }],
  ])("rejects %s", (_reason, invalidExport) => {
    expect(parseProjectExport(invalidExport, speciesLabels)).toBeNull();
  });
});

describe("project checks", () => {
  it("accepts inclusive measurement bounds and hides at both ends", () => {
    const result = calculateProjectChecks({
      species: pogona,
      dimensions: project.dimensions,
      decorations: project.decorations,
      measurements: { ...measurements, hotSideTemperature: 38, coolSideTemperature: 26, baskingUvi: 3, coolSideHumidity: 40 },
    });

    expect(result.checks.find((check) => check.label === "Zone chaude")?.status).toBe("met");
    expect(result.checks.find((check) => check.label === "Zone fraîche")?.status).toBe("met");
    expect(result.checks.find((check) => check.label === "Cachettes aux deux extrémités")?.detail).toBe("2/2 extrémités couvertes");
    expect(result.overallStatus).toBe("À documenter");
  });

  it("marks measurements outside the reference range for review", () => {
    const result = calculateProjectChecks({
      species: pogona,
      dimensions: project.dimensions,
      decorations: project.decorations,
      measurements: { ...measurements, hotSideTemperature: 37.9 },
    });

    expect(result.checks.find((check) => check.label === "Zone chaude")?.status).toBe("attention");
    expect(result.overallStatus).toBe("Mesure à vérifier");
  });

  it("does not count central hides as covering both ends", () => {
    const result = calculateProjectChecks({
      species: pogona,
      dimensions: project.dimensions,
      decorations: [project.decorations[0], { id: 3, kind: "Cachette", position: { x: 0.49, z: 0 } }],
      measurements,
    });

    expect(result.checks.find((check) => check.label === "Cachettes aux deux extrémités")?.detail).toContain("cachette manquante");
  });

  it("keeps unreferenced criteria unknown", () => {
    const unreferencedSpecies = { ...pogona, minimumDimensions: null, referenceRanges: null, hidesAtBothEnds: null };
    const result = calculateProjectChecks({
      species: unreferencedSpecies,
      dimensions: project.dimensions,
      decorations: [],
      measurements,
    });

    expect(result.checks.every((check) => check.status === "unknown")).toBe(true);
    expect(result.overallStatus).toBe("À documenter");
  });

  it("reports insufficient dimensions", () => {
    const result = calculateProjectChecks({
      species: pogona,
      dimensions: { width: 119, depth: 60, height: 60 },
      decorations: project.decorations,
      measurements,
    });

    expect(result.checks[0].status).toBe("insufficient");
    expect(result.overallStatus).toBe("Repères à compléter");
  });

  it("does not apply adult thresholds to a juvenile", () => {
    const result = calculateProjectChecks({
      species: pogona,
      lifeStage: "juvenile",
      dimensions: { width: 30, depth: 30, height: 30 },
      decorations: [],
      measurements: { hotSideTemperature: 10, coolSideTemperature: 10, baskingUvi: 0, coolSideHumidity: 100 },
    });

    expect(result.checks.every((check) => check.status === "unknown")).toBe(true);
    expect(result.overallStatus).toBe("À documenter");
  });
});

describe("dimensioned plan placement", () => {
  it("converts normalized positions to centimetres and nearest-wall distance", () => {
    expect(measureDecorationPlacement(project.decorations, { width: 120, depth: 60 })).toEqual([
      { ...project.decorations[0], xCm: 30, zCm: 30, nearestWallCm: 30 },
      { ...project.decorations[1], xCm: 90, zCm: 30, nearestWallCm: 30 },
    ]);
  });

  it("sets a decoration position in centimetres and clamps it to the edge", () => {
    const decoration = project.decorations[0];
    const positioned = positionDecorationAtCm([decoration], decoration.id, "x", 30, { width: 120, depth: 60 });

    expect(positioned[0].position.x).toBe(-0.5);
    expect(measureDecorationPlacement(positioned, { width: 120, depth: 60 })[0].xCm).toBe(30);
    expect(positionDecorationAtCm([decoration], decoration.id, "x", 500, { width: 120, depth: 60 })[0].position.x).toBe(1);
  });

  it("clamps visual size changes to 50–150 percent", () => {
    const decoration = project.decorations[0];

    expect(resizeDecoration([decoration], decoration.id, 125)[0].size).toBe(125);
    expect(resizeDecoration([decoration], decoration.id, 200)[0].size).toBe(150);
    expect(resizeDecoration([decoration], decoration.id, 20)[0].size).toBe(50);
  });
});

describe("saved project management", () => {
  it("renames a project without mutating the original collection", () => {
    const result = renameSavedProjectRecord([project], project.id, "  Nouveau nom  ");

    expect(result).toMatchObject({ ok: true, project: { name: "Nouveau nom" } });
    expect(project.name).toBe("Habitat test");
  });

  it.each([
    ["empty-name", "   "],
    ["duplicate-name", "EXISTANT"],
  ] as const)("rejects a %s", (reason, name) => {
    const existing = { ...project, id: "project-2", name: "Existant" };
    expect(renameSavedProjectRecord([project, existing], project.id, name)).toEqual({ ok: false, reason });
  });

  it("removes only the requested project", () => {
    const second = { ...project, id: "project-2", name: "Autre habitat" };

    expect(removeSavedProjectRecord([project, second], project.id)).toEqual([second]);
    expect(removeSavedProjectRecord([project], "missing")).toEqual([project]);
  });
});