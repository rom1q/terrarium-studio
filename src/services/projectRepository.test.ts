import { afterEach, describe, expect, it, vi } from "vitest";
import { getUniqueProjectName, readCurrentProject, readSavedProjects, writeProjectCollection } from "./projectRepository";
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
});