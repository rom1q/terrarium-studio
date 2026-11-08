import { getLifeStageLabel } from "./projectLogic";
import type { Biotope, Decoration, LifeStage, Measurements, Shape } from "./projectLogic";
import { getDefaultSubstrate, type Substrate } from "./substrates";

export const MAX_PROJECT_HISTORY = 50;

export type EditableProjectState = {
  shape: Shape;
  biotope: Biotope;
  dimensions: { width: number; depth: number; height: number };
  species: string;
  lifeStage: LifeStage;
  substrate?: Substrate;
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

const measurementLabels: Record<keyof Measurements, string> = {
  hotSideTemperature: "Température zone chaude",
  coolSideTemperature: "Température zone fraîche",
  baskingUvi: "UVI basking",
  coolSideHumidity: "Humidité côté frais",
};

function toCentimeters(value: number, length: number, normalizedAxis: boolean): number {
  return Math.round((normalizedAxis ? (value + 1) / 2 : value) * length);
}

export function describeProjectHistoryDifference(from: EditableProjectState, to: EditableProjectState): string[] {
  const changes: string[] = [];
  if (from.shape !== to.shape) changes.push(`Format : ${from.shape} → ${to.shape}`);
  if (from.biotope !== to.biotope) changes.push(`Biotope : ${from.biotope} → ${to.biotope}`);
  const fromSubstrate = from.substrate ?? getDefaultSubstrate(from.biotope);
  const toSubstrate = to.substrate ?? getDefaultSubstrate(to.biotope);
  if (from.biotope === to.biotope && fromSubstrate !== toSubstrate) changes.push(`Substrat : ${fromSubstrate} → ${toSubstrate}`);
  if (from.dimensions.width !== to.dimensions.width) changes.push(`Largeur : ${from.dimensions.width} → ${to.dimensions.width} cm`);
  if (from.dimensions.depth !== to.dimensions.depth) changes.push(`Profondeur : ${from.dimensions.depth} → ${to.dimensions.depth} cm`);
  if (from.dimensions.height !== to.dimensions.height) changes.push(`Hauteur : ${from.dimensions.height} → ${to.dimensions.height} cm`);
  if (from.species !== to.species) changes.push(`Espèce : ${from.species} → ${to.species}`);
  if (from.lifeStage !== to.lifeStage) changes.push(`Stade de vie : ${getLifeStageLabel(from.lifeStage).toLowerCase()} → ${getLifeStageLabel(to.lifeStage).toLowerCase()}`);

  (Object.keys(measurementLabels) as (keyof Measurements)[]).forEach((key) => {
    const oldValue = from.measurements[key];
    const newValue = to.measurements[key];
    if (oldValue !== newValue) changes.push(`${measurementLabels[key]} : ${oldValue ?? "vide"} → ${newValue ?? "vide"}`);
  });

  const oldDecorations = new Map(from.decorations.map((item) => [item.id, item]));
  const newDecorations = new Map(to.decorations.map((item) => [item.id, item]));
  const decorationIds = new Set([...oldDecorations.keys(), ...newDecorations.keys()]);

  decorationIds.forEach((id) => {
    const oldItem = oldDecorations.get(id);
    const newItem = newDecorations.get(id);
    if (!oldItem && newItem) {
      changes.push(`${newItem.kind} ${String(id).padStart(2, "0")} ajouté`);
      return;
    }
    if (oldItem && !newItem) {
      changes.push(`${oldItem.kind} ${String(id).padStart(2, "0")} supprimé`);
      return;
    }
    if (!oldItem || !newItem) return;

    const label = `${oldItem.kind} ${String(id).padStart(2, "0")}`;
    if (oldItem.variant !== newItem.variant) changes.push(`${label} · variante : ${oldItem.variant ?? "défaut"} → ${newItem.variant ?? "défaut"}`);
    if (oldItem.plantSpeciesId !== newItem.plantSpeciesId) changes.push(`${label} · espèce botanique modifiée`);
    if ((oldItem.size ?? 100) !== (newItem.size ?? 100)) changes.push(`${label} · taille : ${oldItem.size ?? 100} → ${newItem.size ?? 100}%`);
    if ((oldItem.rotation ?? 0) !== (newItem.rotation ?? 0)) changes.push(`${label} · rotation : ${oldItem.rotation ?? 0} → ${newItem.rotation ?? 0}°`);

    const axes = [
      { key: "x" as const, label: "X", oldCm: toCentimeters(oldItem.position.x, from.dimensions.width, true), newCm: toCentimeters(newItem.position.x, to.dimensions.width, true) },
      { key: "y" as const, label: "Y", oldCm: toCentimeters(oldItem.position.y ?? 0, from.dimensions.height, false), newCm: toCentimeters(newItem.position.y ?? 0, to.dimensions.height, false) },
      { key: "z" as const, label: "Z", oldCm: toCentimeters(oldItem.position.z, from.dimensions.depth, true), newCm: toCentimeters(newItem.position.z, to.dimensions.depth, true) },
    ];
    axes.forEach(({ key, label: axisLabel, oldCm, newCm }) => {
      if (oldItem.position[key] !== newItem.position[key] || oldCm !== newCm) changes.push(`${label} · ${axisLabel} : ${oldCm} → ${newCm} cm`);
    });
  });

  return changes;
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