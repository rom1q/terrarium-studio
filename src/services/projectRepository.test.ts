import { afterEach, describe, expect, it, vi } from "vitest";
import { getUniqueProjectName, MAX_SAVED_PROJECT_CHECKPOINTS, readCurrentProject, readSavedProjectCheckpoints, readSavedProjects, removeSavedProjectCheckpoints, writeProjectCheckpoint, writeProjectCollection } from "./projectRepository";
import type { StoredProject } from "../domain/projectLogic";

const speciesLabels = ["Test animal"];
const project: StoredProject = {
  id: "project-1",
  name: "Habitat test",
  shape: "Basse",
  biotope: "Tropical",
  dimensions: { width: 120, depth: 60, height: 80 },
  species: speciesLabels[0],
  decorations: [],
  nextId: 1,
};

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("project repository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes and reads the saved project collection", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    expect(writeProjectCollection([project], project)).toBe(true);
    expect(readSavedProjects(speciesLabels)).toEqual([project]);
    expect(readCurrentProject(speciesLabels)).toEqual(project);
  });

  it("restores the previous collection when writing the current project fails", () => {
    const values = new Map<string, string>([
      ["terrarium-studio-projects", "previous-projects"],
      ["terrarium-studio-current-project", "previous-current"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === "terrarium-studio-current-project") throw new Error("Storage full");
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key),
    });

    expect(writeProjectCollection([project], project)).toBe(false);
    expect(values.get("terrarium-studio-projects")).toBe("previous-projects");
    expect(values.get("terrarium-studio-current-project")).toBe("previous-current");
  });

  it("chooses a unique name for imported projects", () => {
    const second = { ...project, id: "project-2", name: "Habitat test (importé 1)" };

    expect(getUniqueProjectName([project, second], project.name)).toBe("Habitat test (importé 2)");
  });

  it("stores named, versioned checkpoints per project and retains only the newest twelve", () => {
    const storage = createMemoryStorage();
    for (let index = 1; index <= MAX_SAVED_PROJECT_CHECKPOINTS + 2; index += 1) {
      expect(writeProjectCheckpoint({ ...project, dimensions: { ...project.dimensions, width: 120 + index } }, `  Étape ${index}  `, speciesLabels, storage)).not.toBeNull();
    }
    const stored = JSON.parse(storage.values.get("terrarium-studio-project-checkpoints") ?? "null");
    const checkpoints = readSavedProjectCheckpoints(project.id, speciesLabels, storage);

    expect(stored.version).toBe(1);
    expect(checkpoints).toHaveLength(MAX_SAVED_PROJECT_CHECKPOINTS);
    expect(checkpoints[0].label).toBe("Étape 3");
    expect(checkpoints.at(-1)?.project.dimensions.width).toBe(134);
    expect(readSavedProjectCheckpoints("another-project", speciesLabels, storage)).toEqual([]);
  });

  it("leaves previous checkpoint data intact when storage quota is exhausted", () => {
    const storage = createMemoryStorage();
    const first = writeProjectCheckpoint(project, "Point initial", speciesLabels, storage);
    const previousValue = storage.values.get("terrarium-studio-project-checkpoints");
    storage.setItem = () => { throw new Error("Storage full"); };

    expect(first).not.toBeNull();
    expect(writeProjectCheckpoint({ ...project, name: "Updated" }, "Point suivant", speciesLabels, storage)).toBeNull();
    expect(storage.values.get("terrarium-studio-project-checkpoints")).toBe(previousValue);
  });

  it("removes checkpoints only for the deleted project", () => {
    const storage = createMemoryStorage();
    writeProjectCheckpoint(project, "Point A", speciesLabels, storage);
    writeProjectCheckpoint({ ...project, id: "project-2", name: "Second project" }, "Point B", ["Test animal"], storage);

    expect(removeSavedProjectCheckpoints(project.id, storage)).toBe(true);
    expect(readSavedProjectCheckpoints(project.id, speciesLabels, storage)).toEqual([]);
    expect(readSavedProjectCheckpoints("project-2", ["Test animal"], storage)).toHaveLength(1);
  });
});