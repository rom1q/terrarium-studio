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
export type ProjectHistoryEntry = { project: EditableProjectState; label: string };
export type ProjectHistory = { entries: ProjectHistoryEntry[]; cursor: number; groupKey: string | null };
export type ProjectHistoryAction =
  | { type: "set"; update: ProjectUpdate; groupKey?: string; label?: string }
  | { type: "finish-group" }
  | { type: "replace"; project: EditableProjectState; label?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "jump"; cursor: number };

export function createProjectHistory(project: EditableProjectState, label = "État initial"): ProjectHistory {
  return { entries: [{ project, label }], cursor: 0, groupKey: null };
}

export function projectHistoryReducer(state: ProjectHistory, action: ProjectHistoryAction): ProjectHistory {
  if (action.type === "replace") return createProjectHistory(action.project, action.label ?? "Projet chargé");

  if (action.type === "finish-group") {
    return state.groupKey === null ? state : { ...state, groupKey: null };
  }

  if (action.type === "set") {
    const currentEntry = state.entries[state.cursor];
    const next = typeof action.update === "function" ? action.update(currentEntry.project) : action.update;
    if (next === currentEntry.project) return state;
    const joinsCurrentGroup = action.groupKey !== undefined && action.groupKey === state.groupKey;
    const nextLabel = action.label ?? currentEntry.label;
    if (joinsCurrentGroup) {
      const entries = [...state.entries];
      entries[state.cursor] = { project: next, label: nextLabel };
      return { ...state, entries };
    }
    const retainedEntries = state.entries.slice(0, state.cursor + 1);
    retainedEntries.push({ project: next, label: action.label ?? "Modifier le projet" });
    const entries = retainedEntries.slice(-MAX_PROJECT_HISTORY);
    return {
      entries,
      cursor: entries.length - 1,
      groupKey: action.groupKey ?? null,
    };
  }

  if (action.type === "undo") {
    return state.cursor === 0 ? state : { ...state, cursor: state.cursor - 1, groupKey: null };
  }

  if (action.type === "redo") return state.cursor >= state.entries.length - 1 ? state : { ...state, cursor: state.cursor + 1, groupKey: null };
  return !Number.isInteger(action.cursor) || action.cursor < 0 || action.cursor >= state.entries.length || action.cursor === state.cursor
    ? state
    : { ...state, cursor: action.cursor, groupKey: null };
}