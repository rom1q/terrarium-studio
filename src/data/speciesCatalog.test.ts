import { describe, expect, it } from "vitest";
import { speciesCatalog } from "./speciesCatalog";

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
    expect(cornSnake?.stageGuidance?.juvenile).toContain("5–6 jours");
    expect(cornSnake?.hidesAtBothEnds).toBe(true);

    expect(royalPython?.source?.publisher).toBe("RSPCA");
    expect(royalPython?.source?.checkedAt).toBe("2026-11-07");
    expect(royalPython?.minimumDimensions).toBeNull();
    expect(royalPython?.dimensionGuidance).toContain("un tiers");
    expect(royalPython?.environmentGuidance).toContain("80 %");
    expect(royalPython?.referenceRanges?.hotSideTemperature).toEqual([30, 32]);
    expect(royalPython?.referenceRanges?.coolSideHumidity).toEqual([50, 60]);
    expect(royalPython?.stageGuidance?.juvenile).toContain("7–14 jours");
    expect(royalPython?.hidesAtBothEnds).toBe(true);
  });

  it("keeps dimension guidance separate from unsupported fixed thresholds", () => {
    const speciesWithLengthBasedEnclosure = speciesCatalog.find((species) => species.scientificName === "Pantherophis guttatus");

    expect(speciesWithLengthBasedEnclosure?.minimumDimensions).toBeNull();
    expect(speciesWithLengthBasedEnclosure?.dimensionGuidance).toBeTruthy();
  });
});