import { describe, expect, it } from "vitest";
import { speciesCatalog } from "./speciesCatalog";
import { getSpeciesStageProfile, getSubstrateGuidance } from "../domain/projectLogic";
import { isKnownSubstrate } from "../domain/substrates";

describe("sourced substrate guidance", () => {
  it("only describes known substrates and always has a verified source behind it", () => {
    const documented = speciesCatalog.filter((species) => species.substrateGuidance);

    expect(documented.length).toBeGreaterThanOrEqual(5);
    for (const species of documented) {
      expect(species.source || species.substrateSource, species.label).toBeTruthy();
      for (const [substrate, guidance] of Object.entries(species.substrateGuidance ?? {})) {
        expect(isKnownSubstrate(substrate), `${species.label} ${substrate}`).toBe(true);
        expect(guidance?.detail.length, `${species.label} ${substrate}`).toBeGreaterThan(30);
      }
    }
  });

  it("flags documented risks and leaves undocumented substrates unknown", () => {
    const bySpecies = (name: string) => {
      const species = speciesCatalog.find((item) => item.scientificName === name);
      if (!species) throw new Error(`${name} missing`);
      return species;
    };

    expect(getSubstrateGuidance(bySpecies("Pantherophis guttatus"), "Sable fin").status).toBe("avoid");
    expect(getSubstrateGuidance(bySpecies("Python regius"), "Terreau tropical").status).toBe("recommended");
    expect(getSubstrateGuidance(bySpecies("Correlophus ciliatus"), "Écorce de pin").status).toBe("avoid");
    expect(getSubstrateGuidance(bySpecies("Eublepharis macularius"), "Mélange sable-argile").status).toBe("recommended");
    expect(getSubstrateGuidance(bySpecies("Dendrobates tinctorius"), "Terreau humide").status).toBe("unknown");
    expect(bySpecies("Dendrobates tinctorius").substrateGuidance).toBeUndefined();
  });
});

describe("sourced animal catalog", () => {
  it("includes RSPCA care references for corn snakes and royal pythons", () => {
    const cornSnake = speciesCatalog.find((species) => species.scientificName === "Pantherophis guttatus");
    const royalPython = speciesCatalog.find((species) => species.scientificName === "Python regius");

    expect(cornSnake?.source?.publisher).toBe("RSPCA");
    expect(cornSnake?.source?.checkedAt).toBe("2026-11-07");
    expect(cornSnake?.minimumDimensions).toBeNull();
    expect(cornSnake?.dimensionGuidance).toContain("un tiers");
    expect(cornSnake?.environmentGuidance).toContain("16–20 °C la nuit");
    expect(cornSnake?.referenceRanges).toEqual({ hotSideTemperature: [28, 30], coolSideTemperature: [20, 24], baskingUvi: [1, 1], coolSideHumidity: [40, 50] });
    expect(cornSnake?.stageGuidance?.hatchling).toContain("5–6 jours");
    expect(cornSnake?.stageGuidance?.adult).toContain("7–14 jours");
    expect(cornSnake?.hidesAtBothEnds).toBe(true);

    expect(royalPython?.source?.publisher).toBe("RSPCA");
    expect(royalPython?.source?.checkedAt).toBe("2026-11-07");
    expect(royalPython?.minimumDimensions).toBeNull();
    expect(royalPython?.dimensionGuidance).toContain("un tiers");
    expect(royalPython?.environmentGuidance).toContain("80 %");
    expect(royalPython?.referenceRanges?.hotSideTemperature).toEqual([30, 32]);
    expect(royalPython?.referenceRanges?.coolSideHumidity).toEqual([50, 60]);
    expect(royalPython?.stageGuidance?.juvenile).toContain("5–6 jours");
    expect(royalPython?.stageGuidance?.adult).toContain("7–14 jours");
    expect(royalPython?.hidesAtBothEnds).toBe(true);
  });

  it("keeps dimension guidance separate from unsupported fixed thresholds", () => {
    const speciesWithLengthBasedEnclosure = speciesCatalog.find((species) => species.scientificName === "Pantherophis guttatus");

    expect(speciesWithLengthBasedEnclosure?.minimumDimensions).toBeNull();
    expect(speciesWithLengthBasedEnclosure?.dimensionGuidance).toBeTruthy();
  });

  it("resolves the crested gecko hatchling enclosure without adult measurement thresholds", () => {
    const crestedGecko = speciesCatalog.find((species) => species.scientificName === "Correlophus ciliatus");
    if (!crestedGecko) throw new Error("Crested gecko profile missing");

    const hatchling = getSpeciesStageProfile(crestedGecko, "hatchling");
    const juvenile = getSpeciesStageProfile(crestedGecko, "juvenile");
    const adult = getSpeciesStageProfile(crestedGecko, "adult");

    expect(hatchling.minimumDimensions).toEqual({ width: 30.48, depth: 30.48, height: 30.48 });
    expect(hatchling.referenceRanges).toBeNull();
    expect(hatchling.environmentGuidance).toContain("ne doit pas dépasser 29 °C");
    expect(hatchling.sources).toHaveLength(2);
    expect(juvenile.minimumDimensions?.height).toBe(91.44);
    expect(juvenile.referenceRanges).toEqual(crestedGecko.referenceRanges);
    expect(adult.minimumDimensions).toEqual(juvenile.minimumDimensions);
  });
});