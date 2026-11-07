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
  it("undoes and redoes changes across project settings and decorations", () => {
    const changed = projectHistoryReducer(createProjectHistory(project), {
      type: "set",
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

    expect(undone.present).toEqual(project);
    expect(redone.present.shape).toBe("Cubique");
    expect(redone.present.biotope).toBe("Tropical");
    expect(redone.present.dimensions.width).toBe(140);
    expect(redone.present.species).toContain("Gecko léopard");
    expect(redone.present.lifeStage).toBe("juvenile");
    expect(redone.present.measurements.hotSideTemperature).toBe(39);
    expect(redone.present.decorations[0].position.x).toBe(0.2);
  });

  it("coalesces numeric edits for one field until blur", () => {
    const initial = createProjectHistory(project);
    const firstEdit = projectHistoryReducer(initial, { type: "set", groupKey: "dimension:width", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 1 } }) });
    const secondEdit = projectHistoryReducer(firstEdit, { type: "set", groupKey: "dimension:width", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 1200 } }) });
    const finished = projectHistoryReducer(secondEdit, { type: "finish-group" });
    const nextEdit = projectHistoryReducer(finished, { type: "set", groupKey: "dimension:width", update: (current) => ({ ...current, dimensions: { ...current.dimensions, width: 140 } }) });

    expect(secondEdit.past).toHaveLength(1);
    expect(projectHistoryReducer(finished, { type: "undo" }).present.dimensions.width).toBe(120);
    expect(nextEdit.past).toHaveLength(2);
    expect(nextEdit.present.dimensions.width).toBe(140);
  });

  it("starts a clean history when replacing a loaded project", () => {
    const edited = projectHistoryReducer(createProjectHistory(project), { type: "set", update: { ...project, biotope: "Tropical" } });
    const loaded = projectHistoryReducer(edited, { type: "replace", project: { ...project, shape: "Verticale" } });

    expect(loaded).toEqual({ past: [], present: { ...project, shape: "Verticale" }, future: [], groupKey: null });
  });

  it("caps history and clears redo after a new change", () => {
    const manyEdits = Array.from({ length: MAX_PROJECT_HISTORY + 3 }, (_, index) => index + 1)
      .reduce((history, index) => projectHistoryReducer(history, { type: "set", update: { ...history.present, dimensions: { ...history.present.dimensions, width: index } } }), createProjectHistory(project));
    const undone = projectHistoryReducer(manyEdits, { type: "undo" });
    const branched = projectHistoryReducer(undone, { type: "set", update: { ...undone.present, shape: "Cubique" } });

    expect(manyEdits.past).toHaveLength(MAX_PROJECT_HISTORY);
    expect(branched.future).toEqual([]);
  });
});