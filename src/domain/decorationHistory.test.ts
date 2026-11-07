import { describe, expect, it } from "vitest";
import { createDecorationHistory, decorationHistoryReducer, MAX_DECORATION_HISTORY } from "./decorationHistory";
import type { Decoration } from "./projectLogic";

const first: Decoration = { id: 1, kind: "Roche", position: { x: 0, z: 0 } };
const moved: Decoration[] = [{ ...first, position: { x: 0.2, z: 0 } }];

describe("decoration history", () => {
  it("undoes and redoes changes without losing the redo branch", () => {
    const initial = createDecorationHistory([first]);
    const changed = decorationHistoryReducer(initial, { type: "set", update: moved });
    const undone = decorationHistoryReducer(changed, { type: "undo" });
    const redone = decorationHistoryReducer(undone, { type: "redo" });

    expect(undone.present).toEqual([first]);
    expect(undone.future).toEqual([moved]);
    expect(redone.present).toEqual(moved);
    expect(redone.future).toEqual([]);
  });

  it("clears redo history when a new edit follows undo", () => {
    const initial = createDecorationHistory([first]);
    const changed = decorationHistoryReducer(initial, { type: "set", update: moved });
    const undone = decorationHistoryReducer(changed, { type: "undo" });
    const branched = decorationHistoryReducer(undone, { type: "set", update: [{ ...first, rotation: 90 }] });

    expect(branched.future).toEqual([]);
    expect(branched.past).toHaveLength(1);
  });

  it("does not add history for identity updates and caps retained steps", () => {
    const initial = createDecorationHistory([first]);
    const unchanged = decorationHistoryReducer(initial, { type: "set", update: (current) => current });
    const capped = Array.from({ length: MAX_DECORATION_HISTORY + 5 }, (_, index) => index + 1)
      .reduce((history, index) => decorationHistoryReducer(history, { type: "set", update: [{ ...first, position: { x: index / 100, z: 0 } }] }), initial);

    expect(unchanged).toBe(initial);
    expect(capped.past).toHaveLength(MAX_DECORATION_HISTORY);
  });

  it("starts a clean history when replacing the active project decorations", () => {
    const changed = decorationHistoryReducer(createDecorationHistory([first]), { type: "set", update: moved });
    const replaced = decorationHistoryReducer(changed, { type: "replace", decorations: [] });

    expect(replaced).toEqual({ past: [], present: [], future: [] });
  });
});