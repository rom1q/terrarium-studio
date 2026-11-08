import { describe, expect, it } from "vitest";
import { getDefaultSubstrate, isKnownSubstrate, normalizeSubstrate, resolveSubstrate, substrateCatalog, substratesByBiotope } from "./substrates";
import { describeProjectHistoryDifference, type EditableProjectState } from "./projectHistory";

describe("substrates by biotope", () => {
  it("offers several known substrates for every biotope with no overlap", () => {
    const all = Object.values(substratesByBiotope).flat();

    for (const options of Object.values(substratesByBiotope)) {
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options.every((option) => isKnownSubstrate(option))).toBe(true);
    }
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all).size).toBe(Object.keys(substrateCatalog).length);
  });

  it("keeps a valid choice and falls back to the biotope default otherwise", () => {
    expect(resolveSubstrate("Sable fin", "Désertique")).toBe("Sable fin");
    expect(resolveSubstrate("Sable fin", "Tropical")).toBe(getDefaultSubstrate("Tropical"));
    expect(resolveSubstrate(undefined, "Paludarium")).toBe("Terreau humide");
    expect(normalizeSubstrate("Gravier fin", "Paludarium")).toBeUndefined();
    expect(isKnownSubstrate("__proto__")).toBe(false);
  });

  it("reports a substrate change only when the biotope is unchanged", () => {
    const project: EditableProjectState = {
      shape: "Basse",
      biotope: "Désertique",
      dimensions: { width: 120, depth: 60, height: 80 },
      species: "Pogona vitticeps · Dragon barbu",
      lifeStage: "adult",
      measurements: { hotSideTemperature: null, coolSideTemperature: null, baskingUvi: null, coolSideHumidity: null },
      decorations: [],
      nextId: 1,
    };

    expect(describeProjectHistoryDifference(project, { ...project, substrate: "Argile rouge" })).toContain("Substrat : Sable fin → Argile rouge");
    expect(describeProjectHistoryDifference(project, { ...project, biotope: "Tropical" }).some((line) => line.startsWith("Substrat"))).toBe(false);
  });
});
