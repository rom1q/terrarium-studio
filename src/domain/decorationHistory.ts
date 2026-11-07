import type { Decoration } from "./projectLogic";

export const MAX_DECORATION_HISTORY = 50;

export type DecorationUpdate = Decoration[] | ((current: Decoration[]) => Decoration[]);
export type DecorationHistory = { past: Decoration[][]; present: Decoration[]; future: Decoration[][] };
export type DecorationHistoryAction =
  | { type: "set"; update: DecorationUpdate }
  | { type: "replace"; decorations: Decoration[] }
  | { type: "undo" }
  | { type: "redo" };

export function createDecorationHistory(decorations: Decoration[]): DecorationHistory {
  return { past: [], present: decorations, future: [] };
}

export function decorationHistoryReducer(state: DecorationHistory, action: DecorationHistoryAction): DecorationHistory {
  if (action.type === "replace") return createDecorationHistory(action.decorations);

  if (action.type === "set") {
    const next = typeof action.update === "function" ? action.update(state.present) : action.update;
    if (next === state.present) return state;
    return {
      past: [...state.past, state.present].slice(-MAX_DECORATION_HISTORY),
      present: next,
      future: [],
    };
  }

  if (action.type === "undo") {
    if (state.past.length === 0) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future].slice(0, MAX_DECORATION_HISTORY),
    };
  }

  if (state.future.length === 0) return state;
  return {
    past: [...state.past, state.present].slice(-MAX_DECORATION_HISTORY),
    present: state.future[0],
    future: state.future.slice(1),
  };
}