import { lazy, Suspense, useEffect, useReducer, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Eye,
  FileText,
  History,
  Layers,
  Leaf,
  Plus,
  Pencil,
  Printer,
  Redo2,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sprout,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Waves,
  X,
} from "lucide-react";
import {
  calculateProjectChecks,
  duplicateDecoration,
  getBiotopeGuidance,
  getDefaultDecorationVariant,
  getHabitatZoneGuidance,
  getLifeStageLabel,
  getSpeciesStageProfile,
  getEquipmentZoneSources,
  measureDecorationPlacement,
  positionDecorationAtCm,
  resolveBiotopeSelection,
  removeSavedProjectRecord,
  resizeDecoration,
  rotateDecoration,
  renameSavedProjectRecord,
  setDecorationPlantSpecies,
  updateDecorationVariant,
  type Biotope,
  type DecorationAxis,
  type CheckStatus,
  type Decoration,
  type MeasurementKey,
  type Measurements,
  type LifeStage,
  type HabitatZoneKey,
  type Shape,
  type StoredProject,
} from "../domain/projectLogic";
import { getPlantProfile } from "../data/plantCatalog";
import { speciesCatalog as speciesList, speciesLabels } from "../data/speciesCatalog";
import { DecorationIcon, DecorationPanel, decorationKindClass } from "../features/terrarium/DecorationPanel";
const TerrariumScene = lazy(() => import("../features/terrarium/TerrariumScene").then((module) => ({ default: module.TerrariumScene })));
import { applyDecorationLayoutSuggestion } from "../domain/layoutValidation";
import type { LayoutSuggestion, LayoutWarning } from "../domain/layoutValidation";
import { createProjectHistory, describeProjectHistoryDifference, projectHistoryReducer } from "../domain/projectHistory";
import type { EditableProjectState } from "../domain/projectHistory";
import {
  clearCurrentProject,
  downloadProjectExport,
  getUniqueProjectName,
  MAX_SAVED_PROJECT_CHECKPOINTS,
  parseProjectFile,
  readCurrentProject,
  readSavedProjectCheckpoints,
  readSavedProjects,
  removeSavedProjectCheckpoint,
  removeSavedProjectCheckpoints,
  renameSavedProjectCheckpoint,
  writeCurrentProject,
  writeProjectCheckpoint,
  writeProjectCollection,
  type SavedProjectCheckpoint,
} from "../services/projectRepository";

type SaveStatus = "idle" | "pending" | "saved" | "error";

const habitatZoneLabels: Record<HabitatZoneKey, string> = {
  hot: "Zone chaude",
  cool: "Zone fraîche",
  uv: "UVB / basking",
  retreat: "Retraits",
};

const createDefaultDecorations = (): Decoration[] => [
  { id: 1, kind: "Plante", position: { x: -0.62, z: -0.42 } },
  { id: 2, kind: "Roche", position: { x: -0.5, z: 0.55 }, size: 70 },
  { id: 3, kind: "Cachette", position: { x: 0.38, z: -0.42 } },
];

const createDefaultMeasurements = (): Measurements => ({
  hotSideTemperature: null,
  coolSideTemperature: null,
  baskingUvi: null,
  coolSideHumidity: null,
});

function App() {
  const projectMenuRef = useRef<HTMLDetailsElement>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const [initialProject] = useState<StoredProject | null>(() => readCurrentProject(speciesLabels));
  const initialSpeciesProfile = speciesList.find((item) => item.label === initialProject?.species) ?? speciesList[0];
  const initialBiotope = resolveBiotopeSelection(initialSpeciesProfile, initialProject?.biotope ?? "Désertique");
  const lastSavedProjectRef = useRef<string | null>(initialProject ? JSON.stringify(initialProject) : null);
  const [projectId, setProjectId] = useState(initialProject?.id ?? null);
  const [projectName, setProjectName] = useState(initialProject?.name ?? "Habitat sans titre");
  const [savedProjects, setSavedProjects] = useState<StoredProject[]>(() => readSavedProjects(speciesLabels));
  const [saveFeedback, setSaveFeedback] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialProject ? "saved" : "idle");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectDialogError, setProjectDialogError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [showHistoryTimeline, setShowHistoryTimeline] = useState(false);
  const [previewedHistoryCursor, setPreviewedHistoryCursor] = useState<number | null>(null);
  const [previewedCheckpointId, setPreviewedCheckpointId] = useState<string | null>(null);
  const [savedProjectCheckpoints, setSavedProjectCheckpoints] = useState<SavedProjectCheckpoint[]>([]);
  const [checkpointName, setCheckpointName] = useState("");
  const [checkpointFeedback, setCheckpointFeedback] = useState("");
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editingCheckpointName, setEditingCheckpointName] = useState("");
  const [projectHistory, dispatchProjectHistory] = useReducer(projectHistoryReducer, {
    shape: initialProject?.shape ?? "Basse",
    biotope: initialBiotope,
    dimensions: initialProject?.dimensions ?? { width: 120, depth: 60, height: 80 },
    species: initialProject?.species ?? speciesList[0].label,
    lifeStage: initialProject?.lifeStage ?? "adult",
    measurements: initialProject?.measurements ?? createDefaultMeasurements(),
    decorations: initialProject?.decorations ?? createDefaultDecorations(),
    nextId: initialProject?.nextId ?? 4,
  }, (project) => createProjectHistory(project, initialProject ? "Projet chargé" : "Projet initial"));
  const currentProjectHistoryEntry = projectHistory.entries[projectHistory.cursor];
  const { shape, biotope, dimensions, species, lifeStage, measurements, decorations, nextId } = currentProjectHistoryEntry.project;
  const previewedCheckpoint = showHistoryTimeline && previewedCheckpointId
    ? savedProjectCheckpoints.find((checkpoint) => checkpoint.id === previewedCheckpointId) ?? null
    : null;
  const previewedHistoryEntry = showHistoryTimeline && previewedHistoryCursor !== null
    && !previewedCheckpoint
    ? projectHistory.entries[previewedHistoryCursor]
    : null;
  const checkpointToEditableProject = (project: StoredProject): EditableProjectState => ({
    shape: project.shape,
    biotope: project.biotope,
    dimensions: project.dimensions,
    species: project.species,
    lifeStage: project.lifeStage ?? "adult",
    measurements: project.measurements ?? createDefaultMeasurements(),
    decorations: project.decorations,
    nextId: project.nextId,
  });
  const previewedProject = previewedCheckpoint
    ? checkpointToEditableProject(previewedCheckpoint.project)
    : previewedHistoryEntry?.project ?? null;
  const historyPreviewChanges = previewedHistoryEntry
    ? describeProjectHistoryDifference(currentProjectHistoryEntry.project, previewedProject!)
    : previewedCheckpoint
      ? describeProjectHistoryDifference(currentProjectHistoryEntry.project, previewedProject!)
    : [];
  useEffect(() => {
    setSavedProjectCheckpoints(projectId ? readSavedProjectCheckpoints(projectId, speciesLabels) : []);
    setPreviewedCheckpointId(null);
  }, [projectId]);
  const updateProjectHistory = (update: (current: EditableProjectState) => EditableProjectState, groupKey?: string, label = "Modifier le projet") => {
    setPreviewedHistoryCursor(null);
    setPreviewedCheckpointId(null);
    dispatchProjectHistory({ type: "set", update, label, ...(groupKey ? { groupKey } : {}) });
  };
  const replaceProjectState = (project: EditableProjectState, label = "Projet chargé") => {
    setPreviewedHistoryCursor(null);
    setPreviewedCheckpointId(null);
    dispatchProjectHistory({ type: "replace", project, label });
  };
  const finishProjectHistoryGroup = () => dispatchProjectHistory({ type: "finish-group" });
  const undoProjectHistory = () => {
    setPreviewedHistoryCursor(null);
    dispatchProjectHistory({ type: "undo" });
  };
  const redoProjectHistory = () => {
    setPreviewedHistoryCursor(null);
    dispatchProjectHistory({ type: "redo" });
  };
  const restoreProjectHistoryEntry = () => {
    if (previewedHistoryCursor === null) return;
    dispatchProjectHistory({ type: "jump", cursor: previewedHistoryCursor });
    setPreviewedHistoryCursor(null);
  };
  const restoreSavedProjectCheckpoint = () => {
    if (!previewedCheckpoint) return;
    const restored = checkpointToEditableProject(previewedCheckpoint.project);
    updateProjectHistory(() => restored, undefined, `Restaurer : ${previewedCheckpoint.label}`);
  };
  const setShape = (value: Shape) => updateProjectHistory((current) => ({ ...current, shape: value }), undefined, `Format : ${value}`);
  const setBiotope = (value: Biotope) => updateProjectHistory((current) => ({ ...current, biotope: value }), undefined, `Biotope : ${value}`);
  const setLifeStage = (value: LifeStage) => updateProjectHistory((current) => ({ ...current, lifeStage: value }), undefined, `Stade de vie : ${getLifeStageLabel(value).toLowerCase()}`);
  const setDecorations: Dispatch<SetStateAction<Decoration[]>> = (update) => updateProjectHistory((current) => ({
    ...current,
    decorations: typeof update === "function" ? update(current.decorations) : update,
  }), undefined, "Modifier le décor");
  const selectedSpecies = speciesList.find((item) => item.label === species) ?? speciesList[0];
  const selectedStageProfile = getSpeciesStageProfile(selectedSpecies, lifeStage);
  const selectedSpeciesSources = [
    ...(selectedSpecies.source ? [selectedSpecies.source] : []),
    ...selectedStageProfile.sources,
  ].filter((source, index, sources) => sources.findIndex((candidate) => candidate.url === source.url) === index);
  const habitatZoneGuidance = getHabitatZoneGuidance(selectedStageProfile);
  const [showHabitatZones, setShowHabitatZones] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [selectedDecorationId, setSelectedDecorationId] = useState<number | null>(null);
  const selectedDecorationIdRef = useRef<number | null>(null);
  const [activeLayoutWarningId, setActiveLayoutWarningId] = useState<string | null>(null);
  const [previewedLayoutSuggestion, setPreviewedLayoutSuggestion] = useState<LayoutSuggestion | null>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate");
  const canUndoProject = projectHistory.cursor > 0;
  const canRedoProject = projectHistory.cursor < projectHistory.entries.length - 1;
  const selectDecoration = (id: number | null) => {
    selectedDecorationIdRef.current = id;
    setSelectedDecorationId(id);
  };
  const handleSceneDecorationSelection = (id: number | null) => {
    setActiveLayoutWarningId(null);
    setPreviewedLayoutSuggestion(null);
    selectDecoration(id);
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const input = target instanceof HTMLInputElement ? target : target instanceof HTMLElement ? target.closest("input") : null;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("textarea, select") || (input && input.type !== "number" && input.type !== "range"))) return;
      if (showSaveDialog || showReport || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey || key === "y") {
        event.preventDefault();
        redoProjectHistory();
      } else if (key === "z") {
        event.preventDefault();
        undoProjectHistory();
      }
    };

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [showSaveDialog, showReport]);

  useEffect(() => {
    if (!projectId) {
      setSaveStatus("idle");
      return;
    }

    const project: StoredProject = { id: projectId, name: projectName, shape, biotope, dimensions, species, lifeStage, decorations, nextId, measurements };
    const serializedProject = JSON.stringify(project);
    if (serializedProject === lastSavedProjectRef.current) return;

    setSaveStatus("pending");
    setSaveFeedback("");
    const timeout = window.setTimeout(() => {
      if (serializedProject === lastSavedProjectRef.current) return;
      try {
        const projects = [...readSavedProjects(speciesLabels).filter((saved) => saved.id !== project.id), project];
        if (!writeProjectCollection(projects, project)) throw new Error("Project storage unavailable");
        lastSavedProjectRef.current = serializedProject;
        setSavedProjects(projects);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [projectId, projectName, shape, biotope, dimensions, species, lifeStage, decorations, nextId, measurements]);

  const updateDimension = (key: keyof typeof dimensions, value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      const label = key === "width" ? "Largeur" : key === "depth" ? "Profondeur" : "Hauteur";
      updateProjectHistory((current) => ({ ...current, dimensions: { ...current.dimensions, [key]: numericValue } }), `dimension:${key}`, `${label} : ${numericValue} cm`);
    }
  };

  const updateSpecies = (speciesLabel: string) => {
    const nextSpecies = speciesList.find((item) => item.label === speciesLabel) ?? speciesList[0];
    const nextBiotope = resolveBiotopeSelection(nextSpecies, biotope);
    updateProjectHistory((current) => ({ ...current, species: speciesLabel, biotope: nextBiotope }), undefined, `Espèce : ${nextSpecies.commonName}`);
    if (nextBiotope !== biotope) {
      setSaveFeedback(`Biotope adapté : ${nextBiotope}`);
      window.setTimeout(() => setSaveFeedback(""), 2200);
    }
  };

  const updateBiotope = (nextBiotope: Biotope) => {
    if (getBiotopeGuidance(selectedSpecies, nextBiotope).status === "incompatible") return;
    setBiotope(nextBiotope);
  };

  const addDecoration = (kind: Decoration["kind"]) => {
    updateProjectHistory((current) => {
      const column = current.decorations.length % 3;
      const row = Math.floor(current.decorations.length / 3);
      const position: Decoration["position"] = { x: (column - 1) * 0.5, z: row % 2 === 0 ? -0.45 : 0.45 };
      if (kind === "Lampe chauffante" || kind === "Tube UVB") position.y = 0.92;
      return {
        ...current,
        decorations: [...current.decorations, { id: current.nextId, kind, variant: getDefaultDecorationVariant(kind, current.biotope), position }],
        nextId: current.nextId + 1,
      };
    }, undefined, `Ajouter ${kind}`);
  };

  const updateDecorationPosition = (id: number, axis: DecorationAxis, value: string) => {
    const centimeters = Number(value);
    if (!Number.isFinite(centimeters)) return;
    updateProjectHistory((current) => ({ ...current, decorations: positionDecorationAtCm(current.decorations, id, axis, centimeters, current.dimensions) }), `decoration:${id}:${axis}`, `Position ${axis.toUpperCase()} : ${centimeters} cm`);
  };

  const updateDecorationSize = (id: number, value: string) => {
    updateProjectHistory((current) => ({ ...current, decorations: resizeDecoration(current.decorations, id, Number(value)) }), `decoration:${id}:size`, `Taille du décor : ${value}%`);
  };

  const updateDecorationRotation = (id: number, value: string) => {
    updateProjectHistory((current) => ({ ...current, decorations: rotateDecoration(current.decorations, id, Number(value)) }), `decoration:${id}:rotation`, `Rotation du décor : ${value}°`);
  };

  const updateDecorationVariantChoice = (id: number, variant: string) => {
    const item = decorations.find((decoration) => decoration.id === id);
    if (!item) return;
    updateProjectHistory((current) => ({ ...current, decorations: updateDecorationVariant(current.decorations, id, variant) }), undefined, `Variante ${item.kind} : ${variant}`);
  };

  const updateBotanicalPlant = (id: number, plantSpeciesId: string) => {
    const plant = getPlantProfile(plantSpeciesId);
    updateProjectHistory((current) => ({ ...current, decorations: setDecorationPlantSpecies(current.decorations, id, plantSpeciesId || undefined) }), undefined, `Espèce botanique : ${plant?.commonName ?? "style visuel"}`);
  };

  const duplicateSelectedDecoration = () => {
    const id = selectedDecorationIdRef.current;
    if (id === null || !decorations.some((item) => item.id === id)) return;
    updateProjectHistory((current) => ({
      ...current,
      decorations: duplicateDecoration(current.decorations, id, current.nextId),
      nextId: current.nextId + 1,
    }), undefined, "Dupliquer un décor");
    selectDecoration(nextId);
  };

  const removeDecoration = (id: number) => {
    const item = decorations.find((decoration) => decoration.id === id);
    updateProjectHistory((current) => ({ ...current, decorations: current.decorations.filter((decoration) => decoration.id !== id) }), undefined, `Supprimer ${item?.kind ?? "un décor"}`);
    if (selectedDecorationId === id) selectDecoration(null);
  };

  const closeProjectNameDialog = () => {
    setShowSaveDialog(false);
    setRenamingProjectId(null);
    setProjectDialogError("");
  };

  const openRenameProject = (project: StoredProject) => {
    setRenamingProjectId(project.id);
    setDraftProjectName(project.name);
    setProjectDialogError("");
    setShowSaveDialog(true);
    projectMenuRef.current?.removeAttribute("open");
  };

  const renameSavedProject = (id: string, name: string) => {
    const result = renameSavedProjectRecord(savedProjects, id, name);
    if (!result.ok) {
      setProjectDialogError(result.reason === "empty-name" ? "Le nom du projet ne peut pas être vide." : result.reason === "duplicate-name" ? "Un projet porte déjà ce nom." : "Ce projet n’existe plus.");
      return;
    }
    const { project: renamedProject, projects } = result;
    const isCurrentProject = projectId === id;
    const currentProject = isCurrentProject
      ? { ...renamedProject, shape, biotope, dimensions, species, lifeStage, decorations, nextId, measurements }
      : renamedProject;
    if (!writeProjectCollection(projects, isCurrentProject ? currentProject : undefined)) {
      setProjectDialogError("Impossible d’enregistrer le nouveau nom sur cet appareil.");
      return;
    }

    setSavedProjects(projects);
    if (isCurrentProject) {
      const serializedProject = JSON.stringify(currentProject);
      lastSavedProjectRef.current = serializedProject;
      setProjectName(currentProject.name);
      setSaveStatus("saved");
    }
    closeProjectNameDialog();
    setSaveFeedback("Projet renommé");
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const deleteSavedProject = (project: StoredProject) => {
    const isCurrentProject = projectId === project.id;
    const message = isCurrentProject
      ? `Supprimer la sauvegarde « ${project.name} » ? Le projet restera ouvert comme brouillon.`
      : `Supprimer définitivement la sauvegarde « ${project.name} » ?`;
    if (!window.confirm(message)) return;

    const projects = removeSavedProjectRecord(savedProjects, project.id);
    if (!writeProjectCollection(projects, isCurrentProject ? null : undefined)) {
      setSaveStatus("error");
      setSaveFeedback("Impossible de supprimer la sauvegarde sur cet appareil");
      return;
    }
    removeSavedProjectCheckpoints(project.id);

    setSavedProjects(projects);
    if (isCurrentProject) {
      setProjectId(null);
      lastSavedProjectRef.current = null;
      setProjectName("Habitat sans titre");
      setSaveStatus("idle");
      setSaveFeedback("Sauvegarde supprimée; brouillon conservé");
    } else {
      setSaveFeedback("Projet supprimé");
    }
    window.setTimeout(() => setSaveFeedback(""), 2200);
    projectMenuRef.current?.removeAttribute("open");
  };

  const persistProject = (name: string) => {
    const normalizedName = name.trim() || "Habitat sans titre";
    const project: StoredProject = {
      id: projectId ?? globalThis.crypto.randomUUID(),
      name: normalizedName,
      shape,
      biotope,
      dimensions,
      species,
      lifeStage,
      decorations,
      nextId,
      measurements,
    };
    const serializedProject = JSON.stringify(project);

    try {
      const projects = [...savedProjects.filter((saved) => saved.id !== project.id), project];
      if (!writeProjectCollection(projects, project)) throw new Error("Project storage unavailable");
      lastSavedProjectRef.current = serializedProject;
      setProjectId(project.id);
      setProjectName(project.name);
      setSavedProjects(projects);
      closeProjectNameDialog();
      setSaveStatus("saved");
      setSaveFeedback("Projet enregistré");
      window.setTimeout(() => setSaveFeedback(""), 2200);
    } catch {
      setSaveStatus("error");
      setSaveFeedback("Sauvegarde impossible sur cet appareil");
    }
  };

  const saveNamedProjectCheckpoint = () => {
    if (!projectId) {
      setCheckpointFeedback("Enregistre le projet avant de créer un point.");
      return;
    }
    if (savedProjectCheckpoints.length >= MAX_SAVED_PROJECT_CHECKPOINTS) {
      const oldest = savedProjectCheckpoints[0];
      if (!window.confirm(`La limite de ${MAX_SAVED_PROJECT_CHECKPOINTS} points est atteinte. « ${oldest.label} » sera supprimé pour enregistrer le nouveau point. Continuer ?`)) return;
    }
    const snapshot: StoredProject = {
      id: projectId,
      name: projectName.trim() || "Habitat sans titre",
      shape,
      biotope,
      dimensions,
      species,
      lifeStage,
      decorations,
      nextId,
      measurements,
    };
    const checkpoint = writeProjectCheckpoint(snapshot, checkpointName, speciesLabels);
    if (!checkpoint) {
      setCheckpointFeedback("Point non enregistré; vérifie le nom et l’espace de stockage.");
      return;
    }
    setSavedProjectCheckpoints(readSavedProjectCheckpoints(projectId, speciesLabels));
    setCheckpointName("");
    setCheckpointFeedback("Point de restauration enregistré.");
  };

  const renameCheckpoint = (checkpoint: SavedProjectCheckpoint) => {
    if (!projectId) return;
    const renamed = renameSavedProjectCheckpoint(projectId, checkpoint.id, editingCheckpointName, speciesLabels);
    if (!renamed) {
      setCheckpointFeedback("Nom invalide ou stockage indisponible.");
      return;
    }
    setSavedProjectCheckpoints(readSavedProjectCheckpoints(projectId, speciesLabels));
    setEditingCheckpointId(null);
    setEditingCheckpointName("");
    setCheckpointFeedback("Point renommé.");
  };

  const deleteCheckpoint = (checkpoint: SavedProjectCheckpoint) => {
    if (!projectId || !window.confirm(`Supprimer le point « ${checkpoint.label} » ?`)) return;
    if (!removeSavedProjectCheckpoint(projectId, checkpoint.id, speciesLabels)) {
      setCheckpointFeedback("Suppression impossible sur cet appareil.");
      return;
    }
    setSavedProjectCheckpoints(readSavedProjectCheckpoints(projectId, speciesLabels));
    if (previewedCheckpointId === checkpoint.id) setPreviewedCheckpointId(null);
    setCheckpointFeedback("Point supprimé.");
  };

  const saveProject = () => {
    if (projectId) {
      persistProject(projectName);
      return;
    }
    setRenamingProjectId(null);
    setProjectDialogError("");
    setDraftProjectName(projectName === "Habitat sans titre" ? "" : projectName);
    setShowSaveDialog(true);
  };

  const exportProject = () => {
    const project: StoredProject = {
      id: projectId ?? globalThis.crypto.randomUUID(),
      name: projectName.trim() || "Habitat sans titre",
      shape,
      biotope,
      dimensions,
      species,
      lifeStage,
      decorations,
      nextId,
      measurements,
    };
    downloadProjectExport(project);
    setSaveFeedback("Export JSON téléchargé");
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const importProjectFile = async (file: File | undefined) => {
    if (!file) return;

    const importedProject = await parseProjectFile(file, speciesLabels);
    if (!importedProject) {
      setSaveStatus("error");
      setSaveFeedback("Fichier JSON invalide ou version non prise en charge");
      return;
    }

    const existingProjects = readSavedProjects(speciesLabels);
    const importedBaseName = importedProject.name;
    const importedName = getUniqueProjectName(existingProjects, importedBaseName);
    const importedSpecies = speciesList.find((item) => item.label === importedProject.species) ?? speciesList[0];
    const importedBiotope = resolveBiotopeSelection(importedSpecies, importedProject.biotope);
    const project: StoredProject = {
      ...importedProject,
      id: globalThis.crypto.randomUUID(),
      name: importedName,
      biotope: importedBiotope,
      dimensions: { ...importedProject.dimensions },
      lifeStage: importedProject.lifeStage ?? "adult",
      decorations: importedProject.decorations.map((item) => ({ ...item, position: { ...item.position } })),
      measurements: importedProject.measurements ?? createDefaultMeasurements(),
    };
    const projects = [...existingProjects, project];
    const serializedProject = JSON.stringify(project);
    if (!writeProjectCollection(projects, project)) {
      setSaveStatus("error");
      setSaveFeedback("Stockage local indisponible");
      return;
    }

    lastSavedProjectRef.current = serializedProject;
    setProjectId(project.id);
    setProjectName(project.name);
    replaceProjectState({
      shape: project.shape,
      biotope: project.biotope,
      dimensions: project.dimensions,
      species: project.species,
      lifeStage: project.lifeStage ?? "adult",
      measurements: project.measurements ?? createDefaultMeasurements(),
      decorations: project.decorations,
      nextId: project.nextId,
    }, `Importer : ${project.name}`);
    selectDecoration(null);
    setViewMode("3d");
    setSavedProjects(projects);
    setSaveStatus("saved");
    setSaveFeedback(importedBiotope === importedProject.biotope ? "Projet importé" : `Biotope ajusté à ${importedBiotope} selon l’espèce`);
    window.setTimeout(() => setSaveFeedback(""), 2200);
    projectMenuRef.current?.removeAttribute("open");
  };

  const loadProject = (project: StoredProject) => {
    const projectSpecies = speciesList.find((item) => item.label === project.species) ?? speciesList[0];
    const projectBiotope = resolveBiotopeSelection(projectSpecies, project.biotope);
    lastSavedProjectRef.current = JSON.stringify(project);
    setProjectId(project.id);
    setProjectName(project.name);
    replaceProjectState({
      shape: project.shape,
      biotope: projectBiotope,
      dimensions: project.dimensions,
      species: project.species,
      lifeStage: project.lifeStage ?? "adult",
      measurements: project.measurements ?? createDefaultMeasurements(),
      decorations: project.decorations,
      nextId: project.nextId,
    }, `Ouvrir : ${project.name}`);
    selectDecoration(null);
    setSaveStatus("saved");
    setSaveFeedback("");
    if (!writeCurrentProject(project)) {
      setSaveStatus("error");
      setSaveFeedback("Stockage local indisponible");
    }
    projectMenuRef.current?.removeAttribute("open");
  };

  const startNewProject = () => {
    if (!window.confirm("Créer un nouveau projet ? Les changements non enregistrés seront perdus.")) return;
    setProjectId(null);
    lastSavedProjectRef.current = null;
    setProjectName("Habitat sans titre");
    replaceProjectState({
      shape: "Basse",
      biotope: "Désertique",
      dimensions: { width: 120, depth: 60, height: 80 },
      species: speciesList[0].label,
      lifeStage: "adult",
      measurements: createDefaultMeasurements(),
      decorations: createDefaultDecorations(),
      nextId: 4,
    }, "Nouveau projet");
    selectDecoration(null);
    setViewMode("3d");
    setSaveStatus("idle");
    setSaveFeedback("");
    clearCurrentProject();
    projectMenuRef.current?.removeAttribute("open");
  };

  const selectedBiotopeGuidance = getBiotopeGuidance(selectedSpecies, biotope);
  const { checks, hasInsufficientCheck, hasAttentionCheck, overallStatus } = calculateProjectChecks({ species: selectedSpecies, dimensions, shape, biotope, decorations, measurements, lifeStage });
  const activeLayoutWarning = checks.flatMap((check) => check.issues ?? []).find((warning) => warning.id === activeLayoutWarningId) ?? null;
  const showLayoutWarning = (warning: LayoutWarning) => {
    setViewMode("3d");
    setPreviewedLayoutSuggestion(null);
    setActiveLayoutWarningId(warning.id);
    selectDecoration(warning.decorationIds[0] ?? null);
  };
  const previewLayoutSuggestion = (suggestion: LayoutSuggestion) => {
    setViewMode("3d");
    setPreviewedLayoutSuggestion(suggestion);
    selectDecoration(suggestion.decorationId);
  };
  const applyLayoutSuggestion = (suggestion: LayoutSuggestion) => {
    updateProjectHistory((current) => ({ ...current, decorations: applyDecorationLayoutSuggestion(current.decorations, suggestion) }), undefined, "Appliquer une correction de placement");
    setActiveLayoutWarningId(null);
    setPreviewedLayoutSuggestion(null);
    selectDecoration(suggestion.decorationId);
  };
  const checkStatusLabels: Record<CheckStatus, string> = {
    met: "Repère atteint",
    insufficient: "À compléter",
    attention: "À vérifier",
    unknown: "Non documenté",
  };
  const positionedDecorations = measureDecorationPlacement(decorations, dimensions);
  const decorationCounts = (["Plante", "Cachette", "Roche", "Branche", "Plateforme", "Gamelle", "Lampe chauffante", "Tube UVB"] as const)
    .map((kind) => ({ kind, count: decorations.filter((item) => item.kind === kind).length }))
    .filter((item) => item.count > 0);
  const equipmentZoneSources = getEquipmentZoneSources(decorations);
  const updateMeasurement = (key: MeasurementKey, value: string) => {
    const numericValue = value === "" ? null : Number(value);
    if (numericValue === null || Number.isFinite(numericValue)) {
      const labels: Record<MeasurementKey, string> = {
        hotSideTemperature: "Température zone chaude",
        coolSideTemperature: "Température zone fraîche",
        baskingUvi: "UVI basking",
        coolSideHumidity: "Humidité côté frais",
      };
      const label = numericValue === null ? `${labels[key]} effacée` : `${labels[key]} : ${numericValue}`;
      updateProjectHistory((current) => ({ ...current, measurements: { ...current.measurements, [key]: numericValue } }), `measurement:${key}`, label);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Terrarium Studio, accueil">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
          <span>terrarium<span className="brand-light"> studio</span></span>
        </a>
        <details className="project-menu" ref={projectMenuRef}>
          <summary className="project-name"><span className="live-dot" /> {projectName} <ChevronDown size={14} /></summary>
          <div className="project-dropdown">
            <button type="button" className="new-project-option" onClick={startNewProject}><Plus size={14} /> Nouveau projet</button>
            <button type="button" onClick={exportProject}><Download size={14} /> Exporter en JSON</button>
            <button type="button" onClick={() => projectImportInputRef.current?.click()}><Upload size={14} /> Importer un JSON</button>
            <div className="project-list-label">Projets enregistrés</div>
            {savedProjects.length === 0 ? <p className="no-saved-projects">Aucun projet enregistré</p> : savedProjects.map((project) => (
              <div className="saved-project-row" key={project.id}>
                <button type="button" className="saved-project-option" onClick={() => loadProject(project)}>{project.name}</button>
                <div className="saved-project-actions">
                  <button type="button" className="project-action" title={`Renommer ${project.name}`} aria-label={`Renommer ${project.name}`} onClick={() => openRenameProject(project)}><Pencil size={14} /></button>
                  <button type="button" className="project-action delete-project-action" title={`Supprimer ${project.name}`} aria-label={`Supprimer ${project.name}`} onClick={() => deleteSavedProject(project)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </details>
        <input ref={projectImportInputRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Fichier de projet JSON" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importProjectFile(file); }} />
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={17} /></button>
          <button className="save-button" type="button" onClick={saveProject}>Enregistrer le projet</button>
          <span className={`save-feedback ${saveStatus}`} aria-live="polite">{saveFeedback || (saveStatus === "pending" ? "Enregistrement…" : saveStatus === "saved" ? "Enregistré localement" : saveStatus === "error" ? "Échec de sauvegarde" : "À enregistrer")}</span>
        </div>
      </header>

      <section className="workspace" id="top">
        <aside className="panel left-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">NOUVEAU PROJET</p><h1>Votre habitat</h1></div>
            <span className="step-count">01 <span>/ 04</span></span>
          </div>

          <section className="form-section species-section">
            <div className="section-title"><span>01</span><h2>Son habitant</h2></div>
            <label className="species-select-wrap">
              <span className="sr-only">Espèce de reptile ou amphibien</span>
              <select value={species} onChange={(event) => updateSpecies(event.target.value)}>
                {speciesList.map((item) => <option key={item.label}>{item.label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <div className="life-stage-control" role="group" aria-label="Stade de vie">
              <span>Stade de vie</span>
              <div className="life-stage-options">
                {(["hatchling", "juvenile", "adult"] as LifeStage[]).map((stage) => <button key={stage} type="button" className={lifeStage === stage ? "active" : ""} aria-pressed={lifeStage === stage} onClick={() => setLifeStage(stage)}>{getLifeStageLabel(stage)}</button>)}
              </div>
            </div>
            <p className="species-note"><CircleHelp size={13} /> {lifeStage !== "adult" && !selectedStageProfile.minimumDimensions && !selectedStageProfile.referenceRanges ? `Repères d’habitat ${getLifeStageLabel(lifeStage).toLowerCase()} non documentés; les seuils adultes ne sont pas appliqués.` : selectedSpecies.source ? "Les critères incomplets restent à vérifier." : "Aucune source de maintenance vérifiée pour cette espèce."}</p>
            {selectedStageProfile.stageGuidance && <div className="stage-guidance"><p className="field-label">Repère alimentaire · {selectedSpecies.source?.publisher}</p><p>{selectedStageProfile.stageGuidance}</p></div>}
            {selectedSpecies.referenceRanges && <div className="measurement-form">
              <p className="field-label">Mesures relevées <small>optionnel</small></p>
              <div className="measurement-grid">
                <label><span>Zone chaude · °C</span><input aria-label="Température zone chaude en degrés" type="number" step="0.1" value={measurements.hotSideTemperature ?? ""} onChange={(event) => updateMeasurement("hotSideTemperature", event.target.value)} onBlur={finishProjectHistoryGroup} /></label>
                <label><span>Zone fraîche · °C</span><input aria-label="Température zone fraîche en degrés" type="number" step="0.1" value={measurements.coolSideTemperature ?? ""} onChange={(event) => updateMeasurement("coolSideTemperature", event.target.value)} onBlur={finishProjectHistoryGroup} /></label>
                <label><span>UVI · basking</span><input aria-label="Indice UVB UVI dans la zone de basking" type="number" min="0" step="0.1" value={measurements.baskingUvi ?? ""} onChange={(event) => updateMeasurement("baskingUvi", event.target.value)} onBlur={finishProjectHistoryGroup} /></label>
                <label><span>Humidité · %</span><input aria-label="Humidité côté frais en pourcentage" type="number" min="0" max="100" step="1" value={measurements.coolSideHumidity ?? ""} onChange={(event) => updateMeasurement("coolSideHumidity", event.target.value)} onBlur={finishProjectHistoryGroup} /></label>
              </div>
              <p className="measurement-note">{selectedStageProfile.referenceRanges ? `Repères ${selectedSpecies.source?.publisher} pour ${getLifeStageLabel(lifeStage).toLowerCase()}; températures en °C converties si nécessaire.` : `Aucune plage de mesure chiffrée vérifiée pour ${getLifeStageLabel(lifeStage).toLowerCase()}; les relevés ne sont pas comparés.`} Mesurez chaque zone séparément.</p>
              {selectedStageProfile.environmentGuidance && <p className="measurement-note">{selectedStageProfile.environmentGuidance}</p>}
            </div>}
          </section>

          <section className="form-section">
            <div className="section-title"><span>02</span><h2>Le contenant</h2></div>
            <p className="field-label">Format du terrarium</p>
            <div className="shape-options" role="group" aria-label="Format du terrarium">
              {(["Basse", "Cubique", "Verticale"] as Shape[]).map((option) => (
                <button key={option} className={`shape-option ${shape === option ? "selected" : ""}`} type="button" onClick={() => setShape(option)}>
                  <span className={`shape-glyph ${option.toLowerCase()}`}><i /></span>
                  <span>{option}</span>
                </button>
              ))}
            </div>

            <div className="section-label-row"><p className="field-label">Dimensions intérieures</p><span className="unit-label">cm</span></div>
            <div className="dimension-grid">
              {(["width", "depth", "height"] as const).map((key) => (
                <label className="dimension-field" key={key}>
                  <span>{key === "width" ? "Largeur" : key === "depth" ? "Profondeur" : "Hauteur"}</span>
                  <input aria-label={key === "width" ? "Largeur en centimètres" : key === "depth" ? "Profondeur en centimètres" : "Hauteur en centimètres"} type="number" min="20" max="300" value={dimensions[key]} onChange={(event) => updateDimension(key, event.target.value)} onBlur={finishProjectHistoryGroup} />
                </label>
              ))}
            </div>
            <div className="size-summary"><Ruler size={14} /> Volume estimé <strong>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</strong></div>
          </section>

          <section className="form-section">
            <div className="section-title"><span>03</span><h2>Le biotope</h2></div>
            <div className="biotope-options" role="group" aria-label="Type de terrarium">
              {(["Désertique", "Tropical", "Paludarium"] as Biotope[]).map((option) => {
                const guidance = getBiotopeGuidance(selectedSpecies, option);
                return <button key={option} type="button" disabled={guidance.status === "incompatible"} title={guidance.detail} className={`biotope-option ${biotope === option ? "selected" : ""} ${guidance.status === "incompatible" ? "incompatible" : ""}`} onClick={() => updateBiotope(option)}>
                  <span className="biotope-icon">{option === "Désertique" ? <Sun size={16} /> : option === "Paludarium" ? <Waves size={16} /> : <Sprout size={16} />}</span>
                  <span>{option}</span>
                  {biotope === option && <Check size={14} className="option-check" />}
                </button>;
              })}
            </div>
            <p className={`biotope-guidance ${selectedBiotopeGuidance.status}`}>{selectedBiotopeGuidance.detail}</p>
          </section>

          <DecorationPanel
            decorations={positionedDecorations}
            dimensions={dimensions}
            biotope={biotope}
            selectedDecorationId={selectedDecorationId}
            viewMode={viewMode}
            transformMode={transformMode}
            onAddDecoration={addDecoration}
            onSelectTransformMode={setTransformMode}
            onDuplicateSelected={duplicateSelectedDecoration}
            onRemoveDecoration={removeDecoration}
            onUpdatePosition={updateDecorationPosition}
            onUpdateSize={updateDecorationSize}
            onUpdateRotation={updateDecorationRotation}
            onUpdateVariant={updateDecorationVariantChoice}
            onUpdatePlantSpecies={updateBotanicalPlant}
            onFinishNumericEdit={finishProjectHistoryGroup}
          />
        </aside>

        <section className="stage-column" aria-label="Visualisation 3D">
          <div className="stage-toolbar">
            <div className="stage-view-controls">
              <div className="view-tabs"><button className={viewMode === "3d" ? "active" : ""} type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}><Eye size={14} /> Vue 3D</button><button className={viewMode === "plan" ? "active" : ""} type="button" aria-pressed={viewMode === "plan"} onClick={() => setViewMode("plan")}><Ruler size={14} /> Plan</button></div>
              <div className="history-controls" role="group" aria-label="Historique du projet">
                <button type="button" aria-label="Annuler le changement" aria-keyshortcuts="Control+Z Meta+Z" title="Annuler · Ctrl/Cmd+Z" disabled={!canUndoProject} onClick={undoProjectHistory}><Undo2 size={15} /></button>
                <button type="button" aria-label="Rétablir le changement" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" title="Rétablir · Ctrl/Cmd+Shift+Z" disabled={!canRedoProject} onClick={redoProjectHistory}><Redo2 size={15} /></button>
              </div>
              <button className={`zones-toggle ${showHistoryTimeline ? "active" : ""}`} type="button" aria-label="Afficher l’historique" aria-expanded={showHistoryTimeline} title="Historique du projet" onClick={() => setShowHistoryTimeline((visible) => !visible)}><History size={14} /></button>
              <button className={`zones-toggle ${showHabitatZones ? "active" : ""}`} type="button" aria-pressed={showHabitatZones} onClick={() => setShowHabitatZones((visible) => !visible)}><Layers size={14} /> Zones</button>
            </div>
            <span className="stage-dimensions">{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</span>
          </div>
          {showHistoryTimeline && <section className="history-timeline" aria-label="Historique du projet">
            <header><span><strong>Historique</strong><small>{projectHistory.cursor + 1} / {projectHistory.entries.length}</small></span><button type="button" aria-label="Fermer l’historique" onClick={() => { setShowHistoryTimeline(false); setPreviewedHistoryCursor(null); setPreviewedCheckpointId(null); }}><X size={14} /></button></header>
            <div className="saved-checkpoints">
              <div className="saved-checkpoints-heading"><strong>Points de restauration</strong><small>{savedProjectCheckpoints.length} / {MAX_SAVED_PROJECT_CHECKPOINTS}</small></div>
              <div className="checkpoint-save-form">
                <input type="text" maxLength={60} aria-label="Nom du point de restauration" placeholder={projectId ? "Nom du point" : "Enregistre le projet"} value={checkpointName} disabled={!projectId} onChange={(event) => { setCheckpointName(event.target.value); setCheckpointFeedback(""); }} />
                <button type="button" disabled={!projectId || !checkpointName.trim()} onClick={saveNamedProjectCheckpoint}><Plus size={12} /> Enregistrer</button>
              </div>
              {checkpointFeedback && <small className="checkpoint-feedback" role="status">{checkpointFeedback}</small>}
              {savedProjectCheckpoints.length > 0 && <ul>{savedProjectCheckpoints.map((checkpoint) => <li key={checkpoint.id}>
                {editingCheckpointId === checkpoint.id
                  ? <div className="checkpoint-edit-form">
                    <input type="text" maxLength={60} aria-label={`Nouveau nom pour ${checkpoint.label}`} value={editingCheckpointName} onChange={(event) => setEditingCheckpointName(event.target.value)} />
                    <button type="button" aria-label="Enregistrer le nom du point" disabled={!editingCheckpointName.trim()} onClick={() => renameCheckpoint(checkpoint)}><Check size={12} /></button>
                    <button type="button" aria-label="Annuler le renommage" onClick={() => setEditingCheckpointId(null)}><X size={12} /></button>
                  </div>
                  : <div className="checkpoint-row">
                    <button type="button" className={`checkpoint-select ${previewedCheckpointId === checkpoint.id ? "selected" : ""}`} aria-pressed={previewedCheckpointId === checkpoint.id} onClick={() => { setPreviewedHistoryCursor(null); setPreviewedCheckpointId(checkpoint.id); }}>
                      <span>{checkpoint.label}</span><small>{new Date(checkpoint.createdAt).toLocaleString("fr-FR")}</small>
                    </button>
                    <div className="checkpoint-actions">
                      <button type="button" aria-label={`Renommer ${checkpoint.label}`} title={`Renommer ${checkpoint.label}`} onClick={() => { setEditingCheckpointId(checkpoint.id); setEditingCheckpointName(checkpoint.label); }}><Pencil size={12} /></button>
                      <button type="button" aria-label={`Supprimer ${checkpoint.label}`} title={`Supprimer ${checkpoint.label}`} onClick={() => deleteCheckpoint(checkpoint)}><Trash2 size={12} /></button>
                    </div>
                  </div>}
              </li>)}</ul>}
            </div>
            <ol>{projectHistory.entries.map((entry, index) => <li key={index}>
              <button type="button" className={index === projectHistory.cursor ? "current" : previewedHistoryCursor === index ? "previewed" : ""} aria-current={index === projectHistory.cursor ? "step" : undefined} aria-pressed={previewedHistoryCursor === index} onClick={() => { setPreviewedCheckpointId(null); setPreviewedHistoryCursor(index); }}>
                <span>{entry.label}</span><small>{index === projectHistory.cursor ? "Position actuelle" : index < projectHistory.cursor ? "Étape précédente" : "À rétablir"}</small>
              </button>
            </li>)}</ol>
            {previewedProject && <div className="history-preview">
              <strong>{previewedCheckpoint ? `Avant restauration · ${previewedCheckpoint.label}` : "Avant restauration"}</strong>
              {historyPreviewChanges.length === 0 ? <p>Aucune différence avec l’état actuel.</p> : <ul>{historyPreviewChanges.slice(0, 6).map((change) => <li key={change}>{change}</li>)}</ul>}
              {historyPreviewChanges.length > 6 && <small>+ {historyPreviewChanges.length - 6} autre(s) changement(s)</small>}
              <div><button type="button" className="history-preview-cancel" onClick={() => { setPreviewedHistoryCursor(null); setPreviewedCheckpointId(null); }}>Fermer l’aperçu</button><button type="button" className="history-preview-restore" disabled={historyPreviewChanges.length === 0} onClick={previewedCheckpoint ? restoreSavedProjectCheckpoint : restoreProjectHistoryEntry}>{previewedCheckpoint ? "Restaurer ce point" : "Restaurer cet état"}</button></div>
            </div>}
          </section>}
          <div className="viewport-wrap">
            <Suspense fallback={<div className="scene-loading" role="status">Chargement de la scène…</div>}>
              <TerrariumScene shape={shape} dimensions={dimensions} biotope={biotope} decorations={decorations} viewMode={viewMode} selectedDecorationId={selectedDecorationId} transformMode={transformMode} selectedSpecies={selectedSpecies} habitatZoneGuidance={habitatZoneGuidance} showHabitatZones={showHabitatZones} activeLayoutWarning={activeLayoutWarning} previewedLayoutSuggestion={previewedLayoutSuggestion} onDecorationSelectionChange={handleSceneDecorationSelection} onDecorationsChange={setDecorations} />
            </Suspense>
            <div className="viewport-label"><span className="live-dot" /> {viewMode === "plan" ? "VUE EN PLAN" : "APERÇU EN DIRECT"}</div>
            <div className="viewport-tools"><button type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={16} /></button></div>
            {showHabitatZones && <div className="habitat-zone-guide" aria-label="Disponibilité des zones selon les sources">
              <p>Repères sourcés · {selectedSpecies.source?.publisher ?? "aucune source"}</p>
              {habitatZoneGuidance.map((zone) => {
                const rangeText = zone.range ? `${zone.range[0]}–${zone.range[1]} ${zone.key === "uv" ? "UVI" : "°C"}` : zone.status === "documented" ? "Requis" : zone.status === "not-required" ? "Non requis" : "Non documenté";
                const equipmentNote = zone.status !== "documented" ? "" : zone.key === "hot" || zone.key === "cool"
                  ? equipmentZoneSources.heat.length > 0 ? "Lampe en place" : "Ajouter une lampe chauffante"
                  : zone.key === "uv" ? equipmentZoneSources.uv.length > 0 ? "Tube en place" : "Ajouter un tube UVB"
                    : "Zones basées sur les cachettes";
                return <div className={`habitat-zone-row ${zone.key} ${zone.status}`} key={zone.key}><i /><span>{habitatZoneLabels[zone.key]}</span><strong>{rangeText}{equipmentNote && <small>{equipmentNote}</small>}</strong></div>;
              })}
              <small>Repères visuels indicatifs; ils ne simulent ni température, ni UV, ni ombres réelles.</small>
            </div>}
            <div className="viewport-caption"><span className="caption-index">FIG. 01</span><span>{biotope} <b>·</b> {shape.toLowerCase()}</span></div>
          </div>
          <div className="stage-footer"><span><span className="legend-dot glass-dot" /> Verre clair</span><span><span className="legend-dot ground-dot" /> Substrat {biotope.toLowerCase()}</span><span className="orbit-hint">{viewMode === "plan" ? "Glisser un élément pour le déplacer" : `${decorations.length} éléments dans la scène`}</span></div>
        </section>

        <aside className="panel right-panel">
          <div className="analysis-heading"><span className="analysis-icon"><ShieldCheck size={19} /></span><div><p className="eyebrow">BILAN DU PROJET</p><h2>Conformité</h2></div></div>
          <div className={`status-block ${hasInsufficientCheck ? "insufficient" : hasAttentionCheck ? "attention" : ""}`}>
            <div className="status-top"><span className="status-mark">{hasInsufficientCheck || hasAttentionCheck ? <AlertTriangle size={15} /> : <CircleHelp size={15} />}</span><span>{overallStatus}</span></div>
            <p>{hasInsufficientCheck ? "Au moins un repère de la source n’est pas atteint. Consultez le détail ci-dessous." : hasAttentionCheck ? "Au moins une mesure ou un dégagement de placement demande une vérification; consultez les détails ci-dessous." : "Ce bilan est partiel : les critères sans données sourcées restent inconnus et ne sont pas considérés comme conformes."}</p>
          </div>
          <div className="selected-species"><p className="field-label">ESPÈCE SÉLECTIONNÉE</p><strong>{selectedSpecies.commonName}</strong><span>{selectedSpecies.scientificName}</span></div>
          <div className="species-source"><p className="field-label">RÉFÉRENCES · {getLifeStageLabel(lifeStage).toUpperCase()}</p>{selectedSpeciesSources.length > 0 ? selectedSpeciesSources.map((source) => <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.publisher}</a><small>Consultée le {source.checkedAt}</small></div>) : <span>Aucune référence vérifiée. Ces points restent inconnus.</span>}</div>
          <div className="checklist-heading"><span>Points à vérifier</span><span className="checklist-line" /></div>
          {checks.map((check) => {
            const warnings = check.issues ?? [];
            const icon = <span className={`check-icon ${check.status}`}>{check.status === "met" ? <Check size={14} /> : check.status === "insufficient" ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}</span>;
            return warnings.length > 0
              ? <div className="check-warning-group" key={check.label}>
                <div className="check-row">{icon}<span>{check.label}</span><small>{warnings.length} alerte{warnings.length > 1 ? "s" : ""}</small></div>
                {warnings.map((warning) => <div className="layout-warning-item" key={warning.id}>
                  <button className="check-row check-row-action" type="button" title="Afficher les volumes en 3D" aria-label={`Afficher en 3D : ${warning.message}`} aria-expanded={activeLayoutWarningId === warning.id} onClick={() => showLayoutWarning(warning)}><span>{warning.message}</span><Eye size={13} aria-hidden="true" /></button>
                  {activeLayoutWarningId === warning.id && warning.suggestions.map((suggestion) => <div className="layout-suggestion" key={suggestion.id}>
                    {previewedLayoutSuggestion?.id === suggestion.id
                      ? <><span>{suggestion.message} · aperçu actif</span><button type="button" className="layout-suggestion-apply" onClick={() => applyLayoutSuggestion(suggestion)}><Check size={12} /> Appliquer</button><button type="button" className="layout-suggestion-cancel" onClick={() => setPreviewedLayoutSuggestion(null)}>Annuler</button></>
                      : <button type="button" className="layout-suggestion-preview" onClick={() => previewLayoutSuggestion(suggestion)}><Eye size={12} /> Prévisualiser · {suggestion.message}</button>}
                  </div>)}
                </div>)}
              </div>
              : <div className="check-row" key={check.label}>{icon}<span>{check.label}</span><small>{check.detail}</small></div>;
          })}
          <div className="report-note"><AlertTriangle size={15} /><p>Les repères affichés sont partiels et ne certifient pas un habitat. Consultez la source complète et un vétérinaire spécialisé avant toute décision.</p></div>
          <div className="habitat-summary"><p className="field-label">RÉCAPITULATIF</p><div><span>Type</span><strong>{biotope}</strong></div><div><span>Volume</span><strong>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</strong></div><div><span>Décor</span><strong>{decorations.length} éléments</strong></div></div>
          <button className="review-button" type="button" onClick={() => setShowReport(true)}><FileText size={15} /> Voir le rapport</button>
        </aside>
      </section>
      <footer className="app-footer"><span>PROTOTYPE · CONFIGURATEUR D'HABITAT</span><span>Terrarium Studio <span className="footer-separator">/</span> v0.1</span></footer>
      {showSaveDialog && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProjectNameDialog(); }}>
          <form className="project-save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-project-title" onSubmit={(event) => { event.preventDefault(); if (renamingProjectId) renameSavedProject(renamingProjectId, draftProjectName); else persistProject(draftProjectName); }}>
            <p className="eyebrow">{renamingProjectId ? "GESTION DES PROJETS" : "NOUVEAU PROJET"}</p>
            <h2 id="save-project-title">{renamingProjectId ? "Renommer le projet" : "Enregistrer le projet"}</h2>
            <label className="project-name-field"><span>Nom du projet</span><input autoFocus maxLength={60} required value={draftProjectName} onChange={(event) => { setDraftProjectName(event.target.value); setProjectDialogError(""); }} /></label>
            {projectDialogError && <p className="project-dialog-error" role="alert">{projectDialogError}</p>}
            <div className="dialog-actions">
              <button type="button" className="cancel-button" onClick={closeProjectNameDialog}>Annuler</button>
              <button type="submit" className="save-button">{renamingProjectId ? "Renommer" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
      {showReport && (
        <div className="dialog-backdrop report-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReport(false); }}>
          <section className="project-report" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <header className="report-header">
              <div><p className="eyebrow">RAPPORT D'HABITAT · {new Date().toLocaleDateString("fr-FR")}</p><h2 id="report-title">{projectName}</h2><p>{selectedSpecies.commonName} · {getLifeStageLabel(lifeStage)} · <i>{selectedSpecies.scientificName}</i></p></div>
              <button type="button" className="report-close" aria-label="Fermer le rapport" autoFocus onClick={() => setShowReport(false)}><X size={17} /></button>
            </header>
            <dl className="report-facts">
              <div><dt>Dimensions intérieures</dt><dd>{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</dd></div>
              <div><dt>Biotope et format</dt><dd>{biotope} · {shape.toLowerCase()}</dd></div>
              <div><dt>Stade de vie</dt><dd>{getLifeStageLabel(lifeStage)}</dd></div>
              <div><dt>Volume estimé</dt><dd>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</dd></div>
              <div><dt>Statut du bilan</dt><dd>{overallStatus}</dd></div>
            </dl>
            <section className="report-plan-section">
              <h3>Plan coté</h3>
              <div className="report-plan-dimensions"><span>Largeur intérieure <strong>{dimensions.width} cm</strong></span><span>Profondeur intérieure <strong>{dimensions.depth} cm</strong></span></div>
              <div className="report-plan-frame" role="img" aria-label={`Plan du terrarium de ${dimensions.width} par ${dimensions.depth} centimètres avec le décor placé`} style={{ aspectRatio: `${Math.max(1, dimensions.width)} / ${Math.max(1, dimensions.depth)}`, backgroundSize: `${Math.min(100, 1000 / Math.max(10, dimensions.width))}% ${Math.min(100, 1000 / Math.max(10, dimensions.depth))}%` }}>
                {positionedDecorations.map((item) => { const markerSize = 16 + (item.size ?? 100) * 0.08; return <span key={item.id} className={`report-plan-marker marker-${decorationKindClass(item.kind)}`} style={{ left: `${Math.min(97, Math.max(3, (item.position.x + 1) * 50))}%`, top: `${Math.min(97, Math.max(3, (item.position.z + 1) * 50))}%`, width: markerSize, height: markerSize }} title={`${item.kind} · X ${item.xCm} cm · Z ${item.zCm} cm · ${item.size ?? 100}%`} aria-label={`${item.kind}, X ${item.xCm} cm, Z ${item.zCm} cm, taille ${item.size ?? 100}%`}><DecorationIcon kind={item.kind} size={13} /></span>; })}
              </div>
              <div className="report-plan-legend"><span><i className="legend-dot plant-dot" /> Plante</span><span><i className="legend-dot hide-dot" /> Cachette</span><span><i className="legend-dot rock-dot" /> Roche</span><span><i className="legend-dot branch-dot" /> Branche</span><span><i className="legend-dot platform-dot" /> Plate-forme</span><span><i className="legend-dot bowl-dot" /> Gamelle</span><span><i className="legend-dot heat-dot" /> Lampe</span><span><i className="legend-dot uvb-dot" /> Tube UVB</span></div>
              <h4>Décor à prévoir</h4>
              {decorationCounts.length === 0 ? <p className="report-no-decor">Aucun élément de décor placé.</p> : <>
                <div className="report-material-counts">{decorationCounts.map((item) => <span key={item.kind}>{item.kind} <strong>× {item.count}</strong></span>)}</div>
                <ul className="report-material-list">{positionedDecorations.map((item, index) => { const plantProfile = getPlantProfile(item.plantSpeciesId); return <li key={item.id}><span className={`decor-swatch swatch-${decorationKindClass(item.kind)}`}><DecorationIcon kind={item.kind} size={13} /></span><span><strong>{item.kind} {String(index + 1).padStart(2, "0")} · {item.variant ?? getDefaultDecorationVariant(item.kind, biotope)}{plantProfile ? ` · ${plantProfile.scientificName}` : ""}</strong><small>X {item.xCm} cm depuis la gauche · Y {item.yCm} cm au-dessus du fond · Z {item.zCm} cm depuis le haut · rotation Y {item.rotation ?? 0}° · taille visuelle {item.size ?? 100}% · paroi proche {item.nearestWallCm} cm{plantProfile ? ` · sécurité reptile non documentée${plantProfile.toxicityNote ? ` · ${plantProfile.toxicityNote}` : ""}` : ""}</small>{plantProfile && <a className="plant-report-source" href={plantProfile.source.url} target="_blank" rel="noreferrer">Source · {plantProfile.source.publisher}</a>}</span></li>; })}</ul>
              </>}
            </section>
            <h3>Critères et relevés</h3>
            <div className="report-checks">
              {checks.map((check) => <div className="report-check" key={check.label}>
                <span className={`check-icon ${check.status}`}>{check.status === "met" ? <Check size={14} /> : check.status === "insufficient" || check.status === "attention" ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}</span>
                <strong>{check.label}</strong><span className={`report-check-status ${check.status}`}>{checkStatusLabels[check.status]}</span><p>{check.detail}</p>
              </div>)}
            </div>
            {selectedStageProfile.stageGuidance && <section className="report-stage-guidance"><h3>Repère alimentaire · {selectedSpecies.source?.publisher}</h3><p>{selectedStageProfile.stageGuidance}</p></section>}
            {selectedStageProfile.environmentGuidance && <section className="report-stage-guidance"><h3>Repère environnemental · {selectedSpecies.source?.publisher}</h3><p>{selectedStageProfile.environmentGuidance}</p></section>}
            <section className="report-reference"><h3>Références consultées</h3>{selectedSpeciesSources.length > 0 ? selectedSpeciesSources.map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.publisher}</a><br />Consultée le {source.checkedAt}. Les repères ne remplacent pas le guide complet.</p>) : <p>Aucune référence de maintenance vérifiée pour cette espèce.</p>}</section>
            <p className="report-disclaimer">Ce bilan est partiel; les critères non documentés ne sont pas considérés comme conformes. Il ne certifie pas un habitat et ne remplace pas l’avis d’un vétérinaire spécialisé.</p>
            <div className="report-actions"><button type="button" className="cancel-button" onClick={() => setShowReport(false)}>Fermer</button><button type="button" className="save-button" onClick={() => window.print()}><Printer size={15} /> Imprimer / PDF</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
