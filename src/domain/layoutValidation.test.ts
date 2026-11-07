import { describe, expect, it } from "vitest";
import { analyzeDecorationLayout, formatDecorationLayoutWarnings } from "./layoutValidation";
import type { Decoration } from "./projectLogic";

const dimensions = { width: 120, depth: 60, height: 80 };

describe("decoration layout validation", () => {
  it("reports objects whose rotated or resized volume crosses a terrarium wall", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 1, z: 0 }, size: 125, rotation: 45 };
    const warnings = analyzeDecorationLayout([rock], dimensions, "Basse");

    expect(warnings.boundaries.some((warning) => warning.includes("paroi droite"))).toBe(true);
    expect(formatDecorationLayoutWarnings(warnings).boundaries).toContain("Roche 01");
  });

  it("checks every side wall as well as the floor and ceiling", () => {
    const edgeDecorations: Decoration[] = [
      { id: 1, kind: "Roche", position: { x: -1, z: 0 } },
      { id: 2, kind: "Roche", position: { x: 1, z: 0 } },
      { id: 3, kind: "Roche", position: { x: 0, z: -1 } },
      { id: 4, kind: "Roche", position: { x: 0, z: 1 } },
    ];
    const wallWarnings = analyzeDecorationLayout(edgeDecorations, dimensions, "Basse").boundaries.join(" ");
    const verticalWarnings = analyzeDecorationLayout([
      { id: 5, kind: "Lampe chauffante", position: { x: 0, y: 0, z: 0 } },
      { id: 6, kind: "Lampe chauffante", position: { x: 0, y: 1, z: 0 } },
    ], dimensions, "Basse").boundaries.join(" ");

    expect(wallWarnings).toContain("paroi gauche");
    expect(wallWarnings).toContain("paroi droite");
    expect(wallWarnings).toContain("paroi arrière");
    expect(wallWarnings).toContain("paroi avant");
    expect(verticalWarnings).toContain("sous le sol");
    expect(verticalWarnings).toContain("au-dessus du plafond");
  });

  it("detects intersecting objects and a hide entrance blocked by another object", () => {
    const hide: Decoration = { id: 1, kind: "Cachette", variant: "Grotte", position: { x: 0, z: 0 } };
    const rock: Decoration = { id: 2, kind: "Roche", position: { x: 0, z: 0.6 } };
    const warnings = analyzeDecorationLayout([hide, rock], dimensions, "Basse");

    expect(warnings.clearances.some((warning) => warning.includes("chevauche"))).toBe(true);
    expect(warnings.clearances.some((warning) => warning.includes("entrée de Cachette 01 obstruée"))).toBe(true);
  });

  it("allows vertically separated stacking and centered objects within all walls", () => {
    const rock: Decoration = { id: 1, kind: "Roche", position: { x: 0, z: 0 } };
    const plant: Decoration = { id: 2, kind: "Plante", plantSpeciesId: "echeveria-elegans", position: { x: 0, y: 0.4, z: 0 } };
    const warnings = analyzeDecorationLayout([rock, plant], dimensions, "Basse");

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
      { id: 2, kind: "Roche", position: { x: -0.5, z: 0.55 } },
      { id: 3, kind: "Cachette", position: { x: 0.38, z: -0.42 } },
    ];
    const warnings = analyzeDecorationLayout(starterDecorations, dimensions, "Basse", "Désertique");

    expect(warnings.boundaries).toEqual([]);
    expect(warnings.clearances).toEqual([]);
  });
});