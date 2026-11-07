import type { Biotope, Decoration, LifeStage, Measurements, Shape } from "./projectLogic";

export const MAX_PROJECT_HISTORY = 50;

export type EditableProjectState = {
  shape: Shape;
  biotope: Biotope;
  dimensions: { width: number; depth: number; height: number };
  species: string;
  lifeStage: LifeStage;
  measurements: Measurements;
  decorations: Decoration[];
  nextId: number;
};

export type ProjectUpdate = EditableProjectState | ((current: EditableProjectState) => EditableProjectState);
export type ProjectHistory = { past: EditableProjectState[]; present: EditableProjectState; future: EditableProjectState[]; groupKey: string | null };
export type ProjectHistoryAction =
  | { type: "set"; update: ProjectUpdate; groupKey?: string }
  | { type: "finish-group" }
  | { type: "replace"; project: EditableProjectState }
  | { type: "undo" }
  | { type: "redo" };

export function createProjectHistory(project: EditableProjectState): ProjectHistory {
  return { past: [], present: project, future: [], groupKey: null };
}

export function projectHistoryReducer(state: ProjectHistory, action: ProjectHistoryAction): ProjectHistory {
  if (action.type === "replace") return createProjectHistory(action.project);

  if (action.type === "finish-group") {
    return state.groupKey === null ? state : { ...state, groupKey: null };
  }

  if (action.type === "set") {
    const next = typeof action.update === "function" ? action.update(state.present) : action.update;
    if (next === state.present) return state;
    const joinsCurrentGroup = action.groupKey !== undefined && action.groupKey === state.groupKey;
    return {
      past: joinsCurrentGroup ? state.past : [...state.past, state.present].slice(-MAX_PROJECT_HISTORY),
      present: next,
      future: [],
      groupKey: action.groupKey ?? null,
    };
  }

  if (action.type === "undo") {
    if (state.past.length === 0) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future].slice(0, MAX_PROJECT_HISTORY),
      groupKey: null,
    };
  }

  if (state.future.length === 0) return state;
  return {
    past: [...state.past, state.present].slice(-MAX_PROJECT_HISTORY),
    present: state.future[0],
    future: state.future.slice(1),
    groupKey: null,
  };
}