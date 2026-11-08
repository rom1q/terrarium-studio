import { describe, expect, it } from "vitest";
import { analyzeDecorationLayout, applyDecorationLayoutSuggestion, formatDecorationLayoutWarnings } from "./layoutValidation";
import type { Decoration } from "./projectLogic";

const dimensions = { width: 120, depth: 60, height: 80 };

describe("decoration layout validation", () => {
  it("reports objects whose rotated or resized volume crosses a terrarium wall", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 1, z: 0 }, size: 125, rotation: 45 };
    const warnings = analyzeDecorationLayout([rock], dimensions, "Basse");

    expect(warnings.boundaries.some((warning) => warning.message.includes("paroi droite"))).toBe(true);
    expect(warnings.boundaries[0].decorationIds).toEqual([1]);
    expect(warnings.boundaries[0].bounds).toHaveLength(1);
    expect(formatDecorationLayoutWarnings(warnings).boundaries).toContain("Roche 01");
  });

  it("suggests and applies the smallest safe correction for a wall overhang", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 1, z: 0.55 }, size: 70 };
    const warnings = analyzeDecorationLayout([rock], dimensions, "Basse");
    const suggestion = warnings.boundaries[0].suggestions[0];

    expect(suggestion).toBeDefined();
    expect(suggestion.decorationId).toBe(rock.id);
    expect(suggestion.position.x).toBeLessThan(rock.position.x);
    expect(analyzeDecorationLayout(applyDecorationLayoutSuggestion([rock], suggestion), dimensions, "Basse").boundaries).toEqual([]);
  });

  it("checks every side wall as well as the floor and ceiling", () => {
    const edgeDecorations: Decoration[] = [
      { id: 1, kind: "Roche", position: { x: -1, z: 0 } },
      { id: 2, kind: "Roche", position: { x: 1, z: 0 } },
      { id: 3, kind: "Roche", position: { x: 0, z: -1 } },
      { id: 4, kind: "Roche", position: { x: 0, z: 1 } },
    ];
    const wallWarnings = analyzeDecorationLayout(edgeDecorations, dimensions, "Basse").boundaries.map((warning) => warning.message).join(" ");
    const verticalWarnings = analyzeDecorationLayout([
      { id: 5, kind: "Lampe chauffante", position: { x: 0, y: -0.1, z: 0 } },
      { id: 6, kind: "Lampe chauffante", position: { x: 0, y: 1, z: 0 } },
    ], dimensions, "Basse").boundaries.map((warning) => warning.message).join(" ");

    expect(wallWarnings).toContain("paroi gauche");
    expect(wallWarnings).toContain("paroi droite");
    expect(wallWarnings).toContain("paroi arrière");
    expect(wallWarnings).toContain("paroi avant");
    expect(verticalWarnings).toContain("sous le sol");
    expect(verticalWarnings).toContain("au-dessus du plafond");
  });

  it("keeps height-zero decorations on the floor at every supported size", () => {
    const kinds: Decoration["kind"][] = ["Plante", "Roche", "Cachette", "Branche", "Plateforme", "Gamelle", "Lampe chauffante", "Tube UVB"];

    kinds.forEach((kind) => [50, 100, 150].forEach((size) => {
      const item: Decoration = { id: size, kind, position: { x: 0, y: 0, z: 0 }, size };
      const warnings = analyzeDecorationLayout([item], dimensions, "Basse");
      expect(warnings.boundaries.some((warning) => warning.message.includes("sous le sol")), `${kind} at ${size}%`).toBe(false);
    }));
  });

  it("detects intersecting objects and a hide entrance blocked by another object", () => {
    const hide: Decoration = { id: 1, kind: "Cachette", variant: "Grotte", position: { x: 0, z: 0 } };
    const rock: Decoration = { id: 2, kind: "Roche", position: { x: 0, z: 0.6 } };
    const warnings = analyzeDecorationLayout([hide, rock], dimensions, "Basse");

    const overlapWarning = warnings.clearances.find((warning) => warning.type === "overlap");
    expect(overlapWarning).toBeDefined();
    expect(overlapWarning?.suggestions.length).toBeGreaterThan(0);
    const entryWarning = warnings.clearances.find((warning) => warning.message.includes("entrée de Cachette 01 obstruée"));
    expect(entryWarning?.decorationIds).toEqual([1, 2]);
    expect(entryWarning?.bounds).toHaveLength(2);
    expect(entryWarning?.suggestions.length).toBeGreaterThan(0);
    const corrected = applyDecorationLayoutSuggestion([hide, rock], entryWarning!.suggestions[0]);
    expect(analyzeDecorationLayout(corrected, dimensions, "Basse").clearances.some((warning) => warning.id === entryWarning?.id)).toBe(false);
  });

  it("allows vertically separated stacking and centered objects within all walls", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 0, z: 0 } };
    const plant: Decoration = { id: 2, kind: "Plante", plantSpeciesId: "echeveria-elegans", position: { x: 0, y: 0.4, z: 0 } };
    const warnings = analyzeDecorationLayout([rock, plant], dimensions, "Basse");

    expect(warnings.boundaries).toEqual([]);
    expect(warnings.clearances).toEqual([]);
  });

  it("does not offer a correction when the placement is already clear", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 0, z: 0 } };
    const warnings = analyzeDecorationLayout([rock], dimensions, "Basse");

    expect(warnings.boundaries).toEqual([]);
    expect(warnings.clearances).toEqual([]);
  });

  it("does not report false wall warnings for centered default-sized decorations", () => {
    const decorations: Decoration[] = [
      { id: 1, kind: "Cachette", variant: "Grotte", position: { x: -0.5, z: 0 } },
      { id: 2, kind: "Cachette", variant: "Grotte", position: { x: 0.5, z: 0 } },
    ];

    expect(analyzeDecorationLayout(decorations, dimensions, "Basse").boundaries).toEqual([]);
  });

  it("uses the desert rosette profile for an unselected default plant", () => {
    const plant: Decoration = { id: 1, kind: "Plante", position: { x: -0.62, z: -0.42 } };

    expect(analyzeDecorationLayout([plant], dimensions, "Basse", "Désertique").boundaries).toEqual([]);
  });

  it("keeps the starter composition inside the terrarium with hide entrances clear", () => {
    const starterDecorations: Decoration[] = [
      { id: 1, kind: "Plante", position: { x: -0.62, z: -0.42 } },
      { id: 2, kind: "Roche", position: { x: -0.5, z: 0.55 }, size: 70 },
      { id: 3, kind: "Cachette", position: { x: 0.38, z: -0.42 } },
    ];
    const warnings = analyzeDecorationLayout(starterDecorations, dimensions, "Basse", "Désertique");

    expect(warnings.boundaries).toEqual([]);
    expect(warnings.clearances).toEqual([]);
  });
});