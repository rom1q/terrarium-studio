import { describe, expect, it } from "vitest";
import {
  calculateProjectChecks,
  defaultDecorationVariant,
  decorationVariants,
  duplicateDecoration,
  getEquipmentZoneSources,
  getBiotopeGuidance,
  getHabitatZoneGuidance,
  getPlantBiotopeStatus,
  getDecorationVariantsForBiotope,
  getDefaultDecorationVariant,
  isStoredProject,
  measureDecorationPlacement,
  parseProjectExport,
  positionDecorationAtCm,
  PROJECT_EXPORT_FORMAT,
  removeSavedProjectRecord,
  resolveBiotopeSelection,
  resizeDecoration,
  rotateDecoration,
  renameSavedProjectRecord,
  setDecorationPlantSpecies,
  updateDecorationVariant,
  type Measurements,
  type ProjectExport,
  type SpeciesProfile,
  type StoredProject,
} from "./projectLogic";
import { plantCatalog } from "../data/plantCatalog";

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
    ["height above terrarium", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], position: { x: 0, y: 1.1, z: 0 } }] } }],
    ["decoration size outside supported range", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], size: 151 }] } }],
    ["decoration rotation outside supported range", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], rotation: 360 }] } }],
    ["variant incompatible with decoration kind", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], kind: "Plante", variant: "Grotte" }] } }],
    ["unknown botanical species", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], kind: "Plante", plantSpeciesId: "unknown-plant" }] } }],
    ["botanical species on a non-plant decoration", { ...projectExport, project: { ...project, decorations: [{ ...project.decorations[0], plantSpeciesId: "echeveria-elegans" }] } }],
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
    expect(measureDecorationPlacement(project.decorations, { width: 120, depth: 60, height: 80 })).toEqual([
      { ...project.decorations[0], xCm: 30, yCm: 0, zCm: 30, nearestWallCm: 30 },
      { ...project.decorations[1], xCm: 90, yCm: 0, zCm: 30, nearestWallCm: 30 },
    ]);
  });

  it("sets a decoration position in centimetres and clamps it to the edge", () => {
    const decoration = project.decorations[0];
    const positioned = positionDecorationAtCm([decoration], decoration.id, "x", 30, { width: 120, depth: 60, height: 80 });

    expect(positioned[0].position.x).toBe(-0.5);
    expect(measureDecorationPlacement(positioned, { width: 120, depth: 60, height: 80 })[0].xCm).toBe(30);
    expect(positionDecorationAtCm([decoration], decoration.id, "x", 500, { width: 120, depth: 60, height: 80 })[0].position.x).toBe(1);
  });

  it("supports vertical stacking and clamps it to the ceiling", () => {
    const decoration = project.decorations[0];
    const elevated = positionDecorationAtCm([decoration], decoration.id, "y", 40, { width: 120, depth: 60, height: 80 });

    expect(elevated[0].position.y).toBe(0.5);
    expect(measureDecorationPlacement(elevated, { width: 120, depth: 60, height: 80 })[0].yCm).toBe(40);
    expect(positionDecorationAtCm([decoration], decoration.id, "y", 100, { width: 120, depth: 60, height: 80 })[0].position.y).toBe(1);
  });

  it("clamps visual size changes to 50–150 percent", () => {
    const decoration = project.decorations[0];

    expect(resizeDecoration([decoration], decoration.id, 125)[0].size).toBe(125);
    expect(resizeDecoration([decoration], decoration.id, 200)[0].size).toBe(150);
    expect(resizeDecoration([decoration], decoration.id, 20)[0].size).toBe(50);
  });

  it("normalizes decoration rotation to one turn", () => {
    const decoration = project.decorations[0];

    expect(rotateDecoration([decoration], decoration.id, -90)[0].rotation).toBe(270);
    expect(rotateDecoration([decoration], decoration.id, 450)[0].rotation).toBe(90);
  });

  it("duplicates a decoration with its settings and an offset position", () => {
    const source = { ...project.decorations[0], size: 120, rotation: 45, position: { x: 0.9, y: 0.4, z: -0.5 } };
    const duplicated = duplicateDecoration([source], source.id, 3);

    expect(duplicated[1]).toEqual({ ...source, id: 3, position: { x: 0.75, y: 0.4, z: -0.35 } });
    expect(duplicateDecoration([source], source.id, source.id)).toEqual([source]);
  });

  it("sets only variants allowed for each decoration kind", () => {
    const plant = { id: 3, kind: "Plante" as const, position: { x: 0, z: 0 } };
    const rock = { id: 4, kind: "Roche" as const, position: { x: 0, z: 0 } };
    const hide = { id: 5, kind: "Cachette" as const, position: { x: 0, z: 0 } };
    const branch = { id: 6, kind: "Branche" as const, position: { x: 0, z: 0 } };
    const platform = { id: 7, kind: "Plateforme" as const, position: { x: 0, z: 0 } };
    const bowl = { id: 8, kind: "Gamelle" as const, position: { x: 0, z: 0 } };
    const lamp = { id: 9, kind: "Lampe chauffante" as const, position: { x: 0, y: 1, z: 0 } };
    const uvb = { id: 10, kind: "Tube UVB" as const, position: { x: 0, y: 1, z: 0 } };
    const decorations = [plant, rock, hide, branch, platform, bowl, lamp, uvb];

    expect(defaultDecorationVariant).toEqual({ Plante: "Feuillage dense", Roche: "Roche anguleuse", Cachette: "Grotte", Branche: "Branche fourchue", Plateforme: "Plateforme en bois", Gamelle: "Gamelle d’eau", "Lampe chauffante": "Spot chauffant", "Tube UVB": "Tube UVB" });
    expect(decorationVariants.Plante).toContain("Fougère");
    expect(updateDecorationVariant(decorations, plant.id, "Fougère")[0].variant).toBe("Fougère");
    expect(updateDecorationVariant(decorations, rock.id, "Galet")[1].variant).toBe("Galet");
    expect(updateDecorationVariant(decorations, hide.id, "Tronc creux")[2].variant).toBe("Tronc creux");
    expect(updateDecorationVariant(decorations, branch.id, "Branche droite")[3].variant).toBe("Branche droite");
    expect(updateDecorationVariant(decorations, platform.id, "Plateau en liège")[4].variant).toBe("Plateau en liège");
    expect(updateDecorationVariant(decorations, bowl.id, "Coupelle sèche")[5].variant).toBe("Coupelle sèche");
    expect(updateDecorationVariant(decorations, lamp.id, "Spot chauffant")[6].variant).toBe("Spot chauffant");
    expect(updateDecorationVariant(decorations, uvb.id, "Tube UVB")[7].variant).toBe("Tube UVB");
    expect(updateDecorationVariant(decorations, plant.id, "Grotte")).toBe(decorations);
  });

  it("accepts catalog objects in saved project exports", () => {
    const catalogProject = {
      ...project,
      decorations: [
        { id: 3, kind: "Plante", variant: "Rosette", plantSpeciesId: "echeveria-elegans", position: { x: 0, y: 0.4, z: 0 }, rotation: 90 },
        { id: 4, kind: "Branche", variant: "Branche fourchue", position: { x: 0.2, y: 0.4, z: 0 } },
        { id: 5, kind: "Plateforme", variant: "Plateforme en bois", position: { x: 0.2, y: 0.5, z: 0.1 } },
        { id: 6, kind: "Gamelle", variant: "Gamelle d’eau", position: { x: -0.2, z: -0.1 } },
      ],
      nextId: 7,
    };

    expect(parseProjectExport({ ...projectExport, project: catalogProject }, speciesLabels)?.decorations).toEqual(catalogProject.decorations);
  });

  it("accepts heating and UVB equipment in saved projects", () => {
    const equipmentProject = {
      ...project,
      decorations: [
        { id: 3, kind: "Lampe chauffante", variant: "Spot chauffant", position: { x: -0.5, y: 0.92, z: -0.4 } },
        { id: 4, kind: "Tube UVB", variant: "Tube UVB", position: { x: 0, y: 0.94, z: -0.3 }, rotation: 90 },
      ],
      nextId: 5,
    };

    expect(parseProjectExport({ ...projectExport, project: equipmentProject }, speciesLabels)?.decorations).toEqual(equipmentProject.decorations);
  });

  it("suggests different plant styles by biotope without changing non-plant variants", () => {
    expect(getDecorationVariantsForBiotope("Plante", "Désertique")).toEqual(["Rosette"]);
    expect(getDecorationVariantsForBiotope("Plante", "Tropical")).toContain("Fougère");
    expect(getDecorationVariantsForBiotope("Plante", "Paludarium")).not.toEqual(getDecorationVariantsForBiotope("Plante", "Désertique"));
    expect(getDecorationVariantsForBiotope("Roche", "Désertique")).toEqual(decorationVariants.Roche);
    expect(getDefaultDecorationVariant("Plante", "Désertique")).toBe("Rosette");
  });
});

describe("biotope compatibility", () => {
  const sourcedPogona: SpeciesProfile = {
    ...pogona,
    biotopeGuidance: {
      Désertique: { status: "compatible", detail: "Habitat sec." },
      Tropical: { status: "incompatible", detail: "Humidité hors profil." },
      Paludarium: { status: "incompatible", detail: "Configuration humide." },
    },
  };

  it("blocks known incompatible biotopes and selects the compatible alternative", () => {
    expect(getBiotopeGuidance(sourcedPogona, "Tropical").status).toBe("incompatible");
    expect(resolveBiotopeSelection(sourcedPogona, "Paludarium")).toBe("Désertique");
  });

  it("keeps undocumented combinations as unknown and selectable", () => {
    expect(getBiotopeGuidance(pogona, "Paludarium").status).toBe("unknown");
    expect(resolveBiotopeSelection(pogona, "Paludarium")).toBe("Paludarium");
  });
});

describe("habitat zone guidance", () => {
  it("creates overlays only for documented ranges and hide requirements", () => {
    expect(getHabitatZoneGuidance(pogona)).toEqual([
      { key: "hot", status: "documented", range: [38, 42] },
      { key: "cool", status: "documented", range: [22, 26] },
      { key: "uv", status: "documented", range: [3, 5] },
      { key: "retreat", status: "documented" },
    ]);
  });

  it("keeps absent zone data unknown without inferring numeric ranges", () => {
    expect(getHabitatZoneGuidance({ referenceRanges: null, hidesAtBothEnds: null })).toEqual([
      { key: "hot", status: "unknown" },
      { key: "cool", status: "unknown" },
      { key: "uv", status: "unknown" },
      { key: "retreat", status: "unknown" },
    ]);
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

describe("botanical plant catalog", () => {
  it("offers a broad, balanced plant choice by growing conditions", () => {
    expect(plantCatalog).toHaveLength(12);
    expect(plantCatalog.filter((plant) => getPlantBiotopeStatus(plant, "Désertique") === "recommended")).toHaveLength(3);
    expect(plantCatalog.filter((plant) => getPlantBiotopeStatus(plant, "Tropical") === "recommended")).toHaveLength(6);
    expect(plantCatalog.filter((plant) => getPlantBiotopeStatus(plant, "Paludarium") === "recommended")).toHaveLength(3);
    expect(plantCatalog.find((plant) => plant.id === "aloe-vera")?.toxicityNote).toContain("reptiles n’est pas documentée");
  });

  it("recommends plants from sourced growing conditions without asserting reptile safety", () => {
    const fern = plantCatalog.find((plant) => plant.id === "nephrolepis-exaltata");
    const succulent = plantCatalog.find((plant) => plant.id === "echeveria-elegans");

    expect(fern?.source.publisher).toBe("NC State Extension");
    expect(getPlantBiotopeStatus(fern!, "Tropical")).toBe("recommended");
    expect(getPlantBiotopeStatus(fern!, "Paludarium")).toBe("unknown");
    expect(getPlantBiotopeStatus(succulent!, "Désertique")).toBe("recommended");
  });

  it("assigns only known plants to plant decorations and selects their matching visual form", () => {
    const decoration = { id: 8, kind: "Plante" as const, position: { x: 0, z: 0 } };
    const assigned = setDecorationPlantSpecies([decoration], decoration.id, "echeveria-elegans");

    expect(assigned[0]).toMatchObject({ plantSpeciesId: "echeveria-elegans", variant: "Rosette" });
    expect(setDecorationPlantSpecies([decoration], decoration.id, "unknown-plant")).toEqual([decoration]);
    expect(setDecorationPlantSpecies([decoration], decoration.id, undefined)[0]).toEqual(decoration);
  });
});

describe("equipment zone sources", () => {
  it("maps thermal and UV zones to their matching equipment", () => {
    const equipment = [
      { id: 10, kind: "Lampe chauffante" as const, position: { x: -0.4, y: 0.9, z: -0.2 } },
      { id: 11, kind: "Tube UVB" as const, position: { x: 0.3, y: 0.95, z: 0.1 }, rotation: 30 },
      { id: 12, kind: "Branche" as const, position: { x: 0, z: 0 } },
    ];

    expect(getEquipmentZoneSources(equipment)).toEqual({
      heat: [{ id: 10, x: -0.4, z: -0.2, rotation: 0 }],
      uv: [{ id: 11, x: 0.3, z: 0.1, rotation: 30 }],
    });
    expect(getEquipmentZoneSources([equipment[2]])).toEqual({ heat: [], uv: [] });
  });
});