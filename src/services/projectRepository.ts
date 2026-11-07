import {
  isStoredProject,
  parseProjectExport,
  PROJECT_EXPORT_FORMAT,
  type ProjectExport,
  type StoredProject,
} from "../domain/projectLogic";

const projectsStorageKey = "terrarium-studio-projects";
const currentProjectStorageKey = "terrarium-studio-current-project";
const projectCheckpointsStorageKey = "terrarium-studio-project-checkpoints";
const projectCheckpointsFormat = "terrarium-studio-project-checkpoints";
const projectCheckpointsVersion = 1;

export const MAX_SAVED_PROJECT_CHECKPOINTS = 12;
export type SavedProjectCheckpoint = { id: string; projectId: string; label: string; createdAt: string; project: StoredProject };

type ProjectCheckpointCollection = { format: typeof projectCheckpointsFormat; version: typeof projectCheckpointsVersion; projects: Record<string, unknown> };
type CheckpointStorage = Pick<Storage, "getItem" | "setItem">;

function readProjectCheckpointCollection(storage: CheckpointStorage): ProjectCheckpointCollection | null {
  try {
    const stored = storage.getItem(projectCheckpointsStorageKey);
    if (!stored) return { format: projectCheckpointsFormat, version: projectCheckpointsVersion, projects: {} };
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const collection = value as Record<string, unknown>;
    if (collection.format !== projectCheckpointsFormat || collection.version !== projectCheckpointsVersion || typeof collection.projects !== "object" || collection.projects === null || Array.isArray(collection.projects)) return null;
    return collection as ProjectCheckpointCollection;
  } catch {
    return null;
  }
}

function parseProjectCheckpoints(value: unknown, projectId: string, allowedSpecies: readonly string[]): SavedProjectCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is SavedProjectCheckpoint => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const checkpoint = candidate as Record<string, unknown>;
    return typeof checkpoint.id === "string" && checkpoint.id.length > 0 &&
      checkpoint.projectId === projectId && typeof checkpoint.label === "string" &&
      checkpoint.label.trim().length > 0 && checkpoint.label.length <= 60 &&
      typeof checkpoint.createdAt === "string" && !Number.isNaN(Date.parse(checkpoint.createdAt)) &&
      isStoredProject(checkpoint.project, allowedSpecies) && checkpoint.project.id === projectId;
  }).slice(-MAX_SAVED_PROJECT_CHECKPOINTS);
}

export function readSavedProjectCheckpoints(
  projectId: string,
  allowedSpecies: readonly string[],
  storage: CheckpointStorage = localStorage,
): SavedProjectCheckpoint[] {
  if (!projectId) return [];
  const collection = readProjectCheckpointCollection(storage);
  return collection ? parseProjectCheckpoints(collection.projects[projectId], projectId, allowedSpecies) : [];
}

export function writeProjectCheckpoint(
  project: StoredProject,
  label: string,
  allowedSpecies: readonly string[],
  storage: CheckpointStorage = localStorage,
): SavedProjectCheckpoint | null {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || normalizedLabel.length > 60 || !isStoredProject(project, allowedSpecies)) return null;
  const collection = readProjectCheckpointCollection(storage);
  if (!collection) return null;

  const checkpoint: SavedProjectCheckpoint = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    projectId: project.id,
    label: normalizedLabel,
    createdAt: new Date().toISOString(),
    project: JSON.parse(JSON.stringify(project)) as StoredProject,
  };
  const existing = parseProjectCheckpoints(collection.projects[project.id], project.id, allowedSpecies);
  const nextCollection: ProjectCheckpointCollection = {
    ...collection,
    projects: { ...collection.projects, [project.id]: [...existing, checkpoint].slice(-MAX_SAVED_PROJECT_CHECKPOINTS) },
  };

  try {
    storage.setItem(projectCheckpointsStorageKey, JSON.stringify(nextCollection));
    return checkpoint;
  } catch {
    return null;
  }
}

export function removeSavedProjectCheckpoints(projectId: string, storage: CheckpointStorage = localStorage): boolean {
  const collection = readProjectCheckpointCollection(storage);
  if (!collection) return false;
  if (!(projectId in collection.projects)) return true;
  const projects = { ...collection.projects };
  delete projects[projectId];
  try {
    storage.setItem(projectCheckpointsStorageKey, JSON.stringify({ ...collection, projects }));
    return true;
  } catch {
    return false;
  }
}

export function readCurrentProject(allowedSpecies: readonly string[]): StoredProject | null {
  try {
    const value = localStorage.getItem(currentProjectStorageKey);
    if (!value) return null;
    const project: unknown = JSON.parse(value);
    return isStoredProject(project, allowedSpecies) ? project : null;
  } catch {
    return null;
  }
}

export function readSavedProjects(allowedSpecies: readonly string[]): StoredProject[] {
  try {
    const value = localStorage.getItem(projectsStorageKey);
    if (!value) return [];
    const projects: unknown = JSON.parse(value);
    return Array.isArray(projects) ? projects.filter((project): project is StoredProject => isStoredProject(project, allowedSpecies)) : [];
  } catch {
    return [];
  }
}

export function writeProjectCollection(projects: StoredProject[], currentProject?: StoredProject | null): boolean {
  const previousProjects = localStorage.getItem(projectsStorageKey);
  const previousCurrentProject = localStorage.getItem(currentProjectStorageKey);
  try {
    localStorage.setItem(projectsStorageKey, JSON.stringify(projects));
    if (currentProject === null) localStorage.removeItem(currentProjectStorageKey);
    else if (currentProject) localStorage.setItem(currentProjectStorageKey, JSON.stringify(currentProject));
    return true;
  } catch {
    try {
      if (previousProjects === null) localStorage.removeItem(projectsStorageKey);
      else localStorage.setItem(projectsStorageKey, previousProjects);
      if (previousCurrentProject === null) localStorage.removeItem(currentProjectStorageKey);
      else localStorage.setItem(currentProjectStorageKey, previousCurrentProject);
    } catch {
      return false;
    }
    return false;
  }
}

export function writeCurrentProject(project: StoredProject): boolean {
  try {
    localStorage.setItem(currentProjectStorageKey, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function clearCurrentProject(): void {
  localStorage.removeItem(currentProjectStorageKey);
}

export function getUniqueProjectName(projects: readonly StoredProject[], baseName: string): string {
  let name = baseName;
  let index = 1;
  while (projects.some((project) => project.name === name)) {
    name = `${baseName} (importé ${index})`;
    index += 1;
  }
  return name;
}

export async function parseProjectFile(file: File | undefined, allowedSpecies: readonly string[]): Promise<StoredProject | null> {
  if (!file || file.size > 1_000_000) return null;
  try {
    return parseProjectExport(JSON.parse(await file.text()) as unknown, allowedSpecies);
  } catch {
    return null;
  }
}

export function downloadProjectExport(project: StoredProject): void {
  const exportData: ProjectExport = {
    format: PROJECT_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fileName = project.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "terrarium";
  link.href = url;
  link.download = `${fileName}.terrarium.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}