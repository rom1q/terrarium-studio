import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { substrateCatalog, type SubstrateTexture } from "../../domain/substrates";
import { createSubstrateScatter, createSubstrateTexture } from "./substrateTextures";

describe("substrate rendering", () => {
  it.each(["fine-sand", "gravel", "soil", "bark", "moss"] as SubstrateTexture[])("creates a varied tiling %s texture", (kind) => {
    const texture = createSubstrateTexture(kind);
    const data = texture.image.data as Uint8Array;
    const tones = new Set<number>();
    for (let index = 0; index < data.length; index += 4) tones.add(data[index]);

    expect(tones.size).toBeGreaterThan(20);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    texture.dispose();
  });

  it("scatters loose pieces only for substrates that have them, inside the terrarium floor", () => {
    expect(createSubstrateScatter(substrateCatalog["Sable fin"], 3, 1.5, 0.22)).toBeNull();

    const pieces = createSubstrateScatter(substrateCatalog["Gravier de rivière"], 3, 1.5, 0.22);
    expect(pieces).not.toBeNull();
    expect(pieces!.count).toBeGreaterThan(50);
    const box = new THREE.Box3().setFromObject(pieces!);
    expect(box.min.x).toBeGreaterThanOrEqual(-1.6);
    expect(box.max.x).toBeLessThanOrEqual(1.6);
    expect(box.min.y).toBeGreaterThanOrEqual(0.2);
  });
});
