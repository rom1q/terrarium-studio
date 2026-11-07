import { describe, expect, it } from "vitest";
import { createProjectHistory, MAX_PROJECT_HISTORY, projectHistoryReducer } from "./projectHistory";
import type { EditableProjectState } from "./projectHistory";

const project: EditableProjectState = {
  shape: "Basse",
  biotope: "Désertique",
  dimensions: { width: 120, depth: 60, height: 80 },
  species: "Pogona vitticeps · Dragon barbu",
  lifeStage: "adult",
  measurements: { hotSideTemperature: null, coolSideTemperature: null, baskingUvi: null, coolSideHumidity: null },
  decorations: [{ id: 1, kind: "Roche", position: { x: 0, z: 0 } }],
  nextId: 2,
};

describe("project history", () => {
  it("undoes and redoes labeled changes across project settings and decorations", () => {
    const changed = projectHistoryReducer(createProjectHistory(project), {
      type: "set",
      label: "Configuration habitat",
      update: (current) => ({
        ...current,
        shape: "Cubique",
        biotope: "Tropical",
        dimensions: { ...current.dimensions, width: 140 },
        species: "Eublepharis macularius · Gecko léopard",
        lifeStage: "juvenile",
        measurements: { ...current.measurements, hotSideTemperature: 39 },
        decorations: [{ ...current.decorations[0], position: { x: 0.2, z: 0 } }],
      }),
    });
    const undone = projectHistoryReducer(changed, { type: "undo" });
    const redone = projectHistoryReducer(undone, { type: "redo" });

    expect(undone.entries[undone.cursor].project).toEqual(project);
    expect(redone.entries[redone.cursor].label).toBe("Configuration habitat");
    expect(redone.entries[redone.cursor].project.shape).toBe("Cubique");
    expect(redone.entries[redone.cursor].project.biotope).toBe("Tropical");
    expect(redone.entries[redone.cursor].project.dimensions.width).toBe(140);
    expect(redone.entries[redone.cursor].project.species).toContain("Gecko léopard");
    expect(redone.entries[redone.cursor].project.lifeStage).toBe("juvenile");
    expect(redone.entries[redone.cursor].project.measurements.hotSideTemperature).toBe(39);
    expect(redone.entries[redone.cursor].project.decorations[0].position.x).toBe(0.2);
  });

  it("coalesces numeric edits for one field until blur", () => {
    const initial = createProjectHistory(project);
    const firstEdit = projectHistoryReducer(initial, { type: "set", groupKey: "dimension:width", label: "Largeur: 1 cm", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 1 } }) });
    const secondEdit = projectHistoryReducer(firstEdit, { type: "set", groupKey: "dimension:width", label: "Largeur: 1200 cm", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 1200 } }) });
    const finished = projectHistoryReducer(secondEdit, { type: "finish-group" });
    const nextEdit = projectHistoryReducer(finished, { type: "set", groupKey: "dimension:width", label: "Largeur: 140 cm", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 140 } }) });

    expect(secondEdit.entries).toHaveLength(2);
    expect(secondEdit.entries[secondEdit.cursor].label).toBe("Largeur: 1200 cm");
    expect(projectHistoryReducer(finished, { type: "undo" }).entries[0].project.dimensions.width).toBe(120);
    expect(nextEdit.entries).toHaveLength(3);
    expect(nextEdit.entries[nextEdit.cursor].project.dimensions.width).toBe(140);
  });

  it("starts a clean history when replacing a loaded project", () => {
    const edited = projectHistoryReducer(createProjectHistory(project), { type: "set", update: { ...project, biotope: "Tropical" } });
    const loaded = projectHistoryReducer(edited, { type: "replace", project: { ...project, shape: "Verticale" } });

    expect(loaded).toEqual({ entries: [{ project: { ...project, shape: "Verticale" }, label: "Projet chargé" }], cursor: 0, groupKey: null });
  });

  it("caps history and clears redo after a new change", () => {
    const manyEdits = Array.from({ length: MAX_PROJECT_HISTORY + 3 }, (_, index) => index + 1)
      .reduce((history, index) => projectHistoryReducer(history, { type: "set", label: `Width ${index}`, update: { ...history.entries[history.cursor].project, dimensions: { ...history.entries[history.cursor].project.dimensions, width: index } } }), createProjectHistory(project));
    const undone = projectHistoryReducer(manyEdits, { type: "undo" });
    const branched = projectHistoryReducer(undone, { type: "set", label: "Format: Cubique", update: { ...undone.entries[undone.cursor].project, shape: "Cubique" } });

    expect(manyEdits.entries).toHaveLength(MAX_PROJECT_HISTORY);
    expect(branched.entries.slice(branched.cursor + 1)).toEqual([]);
  });

  it("jumps directly to a labeled history entry and discards later redo steps on a new edit", () => {
    const firstEdit = projectHistoryReducer(createProjectHistory(project), { type: "set", label: "Largeur: 140 cm", update: { ...project, dimensions: { ...project.dimensions, width: 140 } } });
    const secondEdit = projectHistoryReducer(firstEdit, { type: "set", label: "Biotope: Tropical", update: { ...firstEdit.entries[firstEdit.cursor].project, biotope: "Tropical" } });
    const jumped = projectHistoryReducer(secondEdit, { type: "jump", cursor: 1 });
    const branched = projectHistoryReducer(jumped, { type: "set", label: "Format: Verticale", update: { ...jumped.entries[jumped.cursor].project, shape: "Verticale" } });

    expect(jumped.entries[jumped.cursor].label).toBe("Largeur: 140 cm");
    expect(jumped.entries[jumped.cursor].project.dimensions.width).toBe(140);
    expect(branched.entries.slice(branched.cursor + 1)).toEqual([]);
  });
});