import {
  isStoredProject,
  parseProjectExport,
  PROJECT_EXPORT_FORMAT,
  type ProjectExport,
  type StoredProject,
} from "../domain/projectLogic";

const projectsStorageKey = "terrarium-studio-projects";
const currentProjectStorageKey = "terrarium-studio-current-project";

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