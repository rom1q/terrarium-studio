import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Expand,
  Eye,
  FileText,
  Leaf,
  Plus,
  Pencil,
  Printer,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sprout,
  Sun,
  Trash2,
  Upload,
  Waves,
  X,
} from "lucide-react";

type Shape = "Basse" | "Cubique" | "Verticale";
type Biotope = "Désertique" | "Tropical" | "Paludarium";
type Decoration = { id: number; kind: "Plante" | "Cachette" | "Roche"; position: { x: number; z: number } };
type SpeciesSource = { title: string; publisher: string; url: string; checkedAt: string };
type Measurements = { hotSideTemperature: number | null; coolSideTemperature: number | null; baskingUvi: number | null; coolSideHumidity: number | null };
type MeasurementKey = keyof Measurements;
type ReferenceRanges = Partial<Record<MeasurementKey, readonly [number, number]>>;
type CheckStatus = "met" | "insufficient" | "attention" | "unknown";
type SaveStatus = "idle" | "pending" | "saved" | "error";
type SpeciesProfile = {
  label: string;
  scientificName: string;
  commonName: string;
  source: SpeciesSource | null;
  minimumDimensions: { width: number; depth: number; height: number } | null;
  referenceRanges: ReferenceRanges | null;
  hidesAtBothEnds: boolean | null;
};
type StoredProject = {
  id: string;
  name: string;
  shape: Shape;
  biotope: Biotope;
  dimensions: { width: number; depth: number; height: number };
  species: string;
  decorations: Decoration[];
  nextId: number;
  measurements?: Measurements;
};
type ProjectExport = { format: "terrarium-studio-project"; version: 1; exportedAt: string; project: StoredProject };

const projectsStorageKey = "terrarium-studio-projects";
const currentProjectStorageKey = "terrarium-studio-current-project";
const projectExportFormat = "terrarium-studio-project";

const speciesList: SpeciesProfile[] = [
  {
    label: "Pogona vitticeps · Dragon barbu",
    scientificName: "Pogona vitticeps",
    commonName: "Dragon barbu",
    source: { title: "Caring for your bearded dragon", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/beardeddragon", checkedAt: "2026-11-05" },
    minimumDimensions: { width: 120, depth: 60, height: 60 },
    referenceRanges: {
      hotSideTemperature: [38, 42],
      coolSideTemperature: [22, 26],
      baskingUvi: [3, 5],
      coolSideHumidity: [30, 40],
    },
    hidesAtBothEnds: true,
  },
  {
    label: "Eublepharis macularius · Gecko léopard",
    scientificName: "Eublepharis macularius",
    commonName: "Gecko léopard",
    source: { title: "Leopard Gecko Care Guide", publisher: "ReptiFiles", url: "https://reptifiles.com/leopard-gecko-care/", checkedAt: "2026-11-06" },
    minimumDimensions: { width: 92, depth: 46, height: 46 },
    referenceRanges: {
      hotSideTemperature: [32.2, 35],
      coolSideTemperature: [22.2, 25],
      baskingUvi: [2, 3],
      coolSideHumidity: [30, 40],
    },
    hidesAtBothEnds: null,
  },
  {
    label: "Correlophus ciliatus · Gecko à crête",
    scientificName: "Correlophus ciliatus",
    commonName: "Gecko à crête",
    source: { title: "Crested Gecko Care Guide", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko-care/", checkedAt: "2026-11-06" },
    minimumDimensions: { width: 46, depth: 46, height: 61 },
    referenceRanges: {
      hotSideTemperature: [23.9, 26.7],
      coolSideTemperature: [21.1, 23.9],
      baskingUvi: [1, 2],
      coolSideHumidity: [60, 80],
    },
    hidesAtBothEnds: null,
  },
  {
    label: "Dendrobates tinctorius · Dendrobate",
    scientificName: "Dendrobates tinctorius",
    commonName: "Dendrobate",
    source: null,
    minimumDimensions: null,
    referenceRanges: null,
    hidesAtBothEnds: null,
  },
];

const biotopeColors: Record<Biotope, { ground: number; plant: number; water: number }> = {
  Désertique: { ground: 0xcda875, plant: 0x74884b, water: 0x8dbdc1 },
  Tropical: { ground: 0x604c38, plant: 0x568b50, water: 0x83bfc0 },
  Paludarium: { ground: 0x665342, plant: 0x4c8051, water: 0x69abb0 },
};

const createDefaultDecorations = (): Decoration[] => [
  { id: 1, kind: "Plante", position: { x: -0.62, z: -0.42 } },
  { id: 2, kind: "Roche", position: { x: 0.22, z: 0.4 } },
  { id: 3, kind: "Cachette", position: { x: 0.62, z: -0.42 } },
];

const createDefaultMeasurements = (): Measurements => ({
  hotSideTemperature: null,
  coolSideTemperature: null,
  baskingUvi: null,
  coolSideHumidity: null,
});

function isStoredProject(value: unknown): value is StoredProject {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;
  const dimensions = project.dimensions;
  const isValidDimensions = typeof dimensions === "object" && dimensions !== null &&
    ["width", "depth", "height"].every((key) => {
      const dimension = (dimensions as Record<string, unknown>)[key];
      return typeof dimension === "number" && Number.isFinite(dimension);
    });
  const isValidDecorations = Array.isArray(project.decorations) && project.decorations.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const decoration = item as Record<string, unknown>;
    const position = decoration.position;
    return Number.isInteger(decoration.id) &&
      ["Plante", "Cachette", "Roche"].includes(decoration.kind as string) &&
      typeof position === "object" && position !== null &&
      typeof (position as Record<string, unknown>).x === "number" &&
      typeof (position as Record<string, unknown>).z === "number";
  });
  const measurements = project.measurements;
  const isValidMeasurements = measurements === undefined || (
    typeof measurements === "object" && measurements !== null &&
    (["hotSideTemperature", "coolSideTemperature", "baskingUvi", "coolSideHumidity"] as const).every((key) => {
      const measurement = (measurements as Record<string, unknown>)[key];
      return measurement === null || (typeof measurement === "number" && Number.isFinite(measurement));
    })
  );

  return typeof project.id === "string" && typeof project.name === "string" &&
    ["Basse", "Cubique", "Verticale"].includes(project.shape as string) &&
    ["Désertique", "Tropical", "Paludarium"].includes(project.biotope as string) &&
    isValidDimensions && typeof project.species === "string" && speciesList.some((species) => species.label === project.species) &&
    isValidDecorations && isValidMeasurements && Number.isInteger(project.nextId);
}

function parseProjectExport(value: unknown): StoredProject | null {
  if (typeof value !== "object" || value === null) return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.format !== projectExportFormat || envelope.version !== 1 || typeof envelope.exportedAt !== "string" || Number.isNaN(Date.parse(envelope.exportedAt))) return null;
  if (!isStoredProject(envelope.project)) return null;

  const project = envelope.project;
  const dimensions = Object.values(project.dimensions);
  const decorationIds = project.decorations.map((item) => item.id);
  const validDimensions = dimensions.every((dimension) => dimension >= 0 && dimension <= 1000);
  const validPositions = project.decorations.every((item) => Number.isFinite(item.position.x) && Number.isFinite(item.position.z) && Math.abs(item.position.x) <= 1 && Math.abs(item.position.z) <= 1);
  const validIds = decorationIds.every((id) => id > 0) && new Set(decorationIds).size === decorationIds.length && project.nextId > Math.max(0, ...decorationIds);
  if (!validDimensions || !validPositions || !validIds || !project.name.trim() || project.name.length > 60) return null;
  return project;
}

function readCurrentProject(): StoredProject | null {
  try {
    const value = localStorage.getItem(currentProjectStorageKey);
    if (!value) return null;
    const project: unknown = JSON.parse(value);
    return isStoredProject(project) ? project : null;
  } catch {
    return null;
  }
}

function readSavedProjects(): StoredProject[] {
  try {
    const value = localStorage.getItem(projectsStorageKey);
    if (!value) return [];
    const projects: unknown = JSON.parse(value);
    return Array.isArray(projects) ? projects.filter(isStoredProject) : [];
  } catch {
    return [];
  }
}

function writeProjectCollection(projects: StoredProject[], currentProject?: StoredProject | null): boolean {
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

function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDetailsElement>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const [initialProject] = useState<StoredProject | null>(readCurrentProject);
  const lastSavedProjectRef = useRef<string | null>(initialProject ? JSON.stringify(initialProject) : null);
  const [projectId, setProjectId] = useState(initialProject?.id ?? null);
  const [projectName, setProjectName] = useState(initialProject?.name ?? "Habitat sans titre");
  const [savedProjects, setSavedProjects] = useState<StoredProject[]>(readSavedProjects);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialProject ? "saved" : "idle");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectDialogError, setProjectDialogError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [shape, setShape] = useState<Shape>(initialProject?.shape ?? "Basse");
  const [biotope, setBiotope] = useState<Biotope>(initialProject?.biotope ?? "Tropical");
  const [dimensions, setDimensions] = useState(initialProject?.dimensions ?? { width: 120, depth: 60, height: 80 });
  const [species, setSpecies] = useState(initialProject?.species ?? speciesList[0].label);
  const [measurements, setMeasurements] = useState<Measurements>(initialProject?.measurements ?? createDefaultMeasurements());
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [selectedDecorationId, setSelectedDecorationId] = useState<number | null>(null);
  const [decorations, setDecorations] = useState<Decoration[]>(initialProject?.decorations ?? createDefaultDecorations());
  const [nextId, setNextId] = useState(initialProject?.nextId ?? 4);

  useEffect(() => {
    if (!projectId) {
      setSaveStatus("idle");
      return;
    }

    const project: StoredProject = { id: projectId, name: projectName, shape, biotope, dimensions, species, decorations, nextId, measurements };
    const serializedProject = JSON.stringify(project);
    if (serializedProject === lastSavedProjectRef.current) return;

    setSaveStatus("pending");
    setSaveFeedback("");
    const timeout = window.setTimeout(() => {
      if (serializedProject === lastSavedProjectRef.current) return;
      try {
        const projects = [...readSavedProjects().filter((saved) => saved.id !== project.id), project];
        localStorage.setItem(projectsStorageKey, JSON.stringify(projects));
        localStorage.setItem(currentProjectStorageKey, serializedProject);
        lastSavedProjectRef.current = serializedProject;
        setSavedProjects(projects);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [projectId, projectName, shape, biotope, dimensions, species, decorations, nextId, measurements]);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9ede4");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    if (viewMode === "plan") {
      camera.up.set(0, 0, -1);
      camera.position.set(0, 8.5, 0);
    } else {
      camera.position.set(4.8, 3.8, 5.7);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8e9, 0x65745c, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffedc8, 3.2);
    keyLight.position.set(-3, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc5e0d1, 1.3);
    fillLight.position.set(5, 3, -4);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, viewMode === "plan" ? 0.22 : 0.9, 0);
    controls.minDistance = 3.2;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enableRotate = viewMode !== "plan";

    const width = Math.min(3.2, Math.max(1.7, dimensions.width / 58));
    const depth = Math.min(2.5, Math.max(1.25, dimensions.depth / 38));
    const heightScale = shape === "Verticale" ? 0.038 : shape === "Cubique" ? 0.03 : 0.022;
    const height = Math.min(3.1, Math.max(1.65, dimensions.height * heightScale));
    const floorY = 0.12;
    const colors = biotopeColors[biotope];
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd9e6d9,
      transparent: true,
      opacity: 0.14,
      roughness: 0.12,
      metalness: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x414f43, roughness: 0.36 });
    const groundMaterial = new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 0.94 });
    const widthHalf = width / 2;
    const depthHalf = depth / 2;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), groundMaterial);
    floor.position.y = floorY;
    scene.add(floor);

    if (biotope === "Paludarium") {
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.4, 0.045, depth * 0.94),
        new THREE.MeshPhysicalMaterial({ color: colors.water, roughness: 0.16, metalness: 0.12 }),
      );
      water.position.set(width * 0.28, floorY + 0.13, 0);
      scene.add(water);
    }

    const pane = (paneWidth: number, paneHeight: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth, paneHeight), glass);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    };
    pane(width, height, 0, floorY + height / 2 + 0.1, -depthHalf);
    pane(depth, height, -widthHalf, floorY + height / 2 + 0.1, 0);
    pane(depth, height, widthHalf, floorY + height / 2 + 0.1, 0);
    pane(width, height, 0, floorY + height / 2 + 0.1, depthHalf);
    pane(width, height, 0, floorY + height + 0.1, 0);

    const addBeam = (beamWidth: number, beamHeight: number, beamDepth: number, x: number, y: number, z: number) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, beamHeight, beamDepth), frameMaterial);
      beam.position.set(x, y, z);
      scene.add(beam);
    };
    const rail = 0.045;
    for (const x of [-widthHalf, widthHalf]) {
      for (const z of [-depthHalf, depthHalf]) {
        addBeam(rail, height + rail, rail, x, floorY + height / 2 + 0.1, z);
      }
    }
    for (const y of [floorY + 0.1, floorY + height + 0.1]) {
      addBeam(width + rail, rail, rail, 0, y, -depthHalf);
      addBeam(width + rail, rail, rail, 0, y, depthHalf);
      addBeam(rail, rail, depth + rail, -widthHalf, y, 0);
      addBeam(rail, rail, depth + rail, widthHalf, y, 0);
    }

    const decorationObjects: THREE.Object3D[] = [];
    decorations.forEach((item) => {
      const x = item.position.x * widthHalf;
      const z = item.position.z * depthHalf;
      if (item.kind === "Plante") {
        const plant = new THREE.Group();
        plant.userData.decorationId = item.id;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.026, 0.62, 7),
          new THREE.MeshStandardMaterial({ color: 0x65804b, roughness: 0.8 }),
        );
        stem.position.y = 0.38;
        plant.add(stem);
        for (let leaf = 0; leaf < 5; leaf += 1) {
          const foliage = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.42, 5),
            new THREE.MeshStandardMaterial({ color: leaf % 2 ? 0x55804b : colors.plant, roughness: 0.78 }),
          );
          foliage.position.set(Math.cos(leaf * 1.25) * 0.13, 0.48 + leaf * 0.1, Math.sin(leaf * 1.25) * 0.13);
          foliage.rotation.z = Math.cos(leaf * 1.25) * 0.5;
          foliage.rotation.x = Math.sin(leaf * 1.25) * 0.4;
          plant.add(foliage);
        }
        plant.position.set(x, floorY + 0.1, z);
        scene.add(plant);
        decorationObjects.push(plant);
      } else if (item.kind === "Cachette") {
        const hide = new THREE.Group();
        hide.userData.decorationId = item.id;
        const body = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({ color: 0x88735b, roughness: 1 }),
        );
        body.scale.set(1.25, 0.68, 0.95);
        body.position.y = 0.26;
        hide.add(body);
        const entrance = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16),
          new THREE.MeshStandardMaterial({ color: 0x352e27, roughness: 1 }),
        );
        entrance.rotation.x = Math.PI / 2;
        entrance.position.set(0, 0.19, 0.36);
        hide.add(entrance);
        hide.position.set(x, floorY + 0.1, z);
        scene.add(hide);
        decorationObjects.push(hide);
      } else {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.32, 0),
          new THREE.MeshStandardMaterial({ color: item.id % 2 ? 0x9a8b76 : 0x776a5d, roughness: 0.98 }),
        );
        rock.scale.set(1.2, 0.82, 0.95);
        rock.position.set(x, floorY + 0.28, z);
        rock.userData.decorationId = item.id;
        scene.add(rock);
        decorationObjects.push(rock);
      }
    });

    const backgroundGrid = new THREE.GridHelper(12, 24, 0xadb8aa, 0xcbd1c7);
    backgroundGrid.position.y = -0.02;
    backgroundGrid.visible = viewMode !== "plan";
    scene.add(backgroundGrid);

    const planGridPoints: THREE.Vector3[] = [];
    for (let centimeters = 0; centimeters < dimensions.width; centimeters += 10) {
      const x = (centimeters / dimensions.width - 0.5) * width;
      planGridPoints.push(new THREE.Vector3(x, 0, -depthHalf), new THREE.Vector3(x, 0, depthHalf));
    }
    planGridPoints.push(new THREE.Vector3(widthHalf, 0, -depthHalf), new THREE.Vector3(widthHalf, 0, depthHalf));
    for (let centimeters = 0; centimeters < dimensions.depth; centimeters += 10) {
      const z = (centimeters / dimensions.depth - 0.5) * depth;
      planGridPoints.push(new THREE.Vector3(-widthHalf, 0, z), new THREE.Vector3(widthHalf, 0, z));
    }
    planGridPoints.push(new THREE.Vector3(-widthHalf, 0, depthHalf), new THREE.Vector3(widthHalf, 0, depthHalf));
    const planGrid = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(planGridPoints),
      new THREE.LineBasicMaterial({ color: 0x758a71, transparent: true, opacity: 0.3 }),
    );
    planGrid.position.y = floorY + 0.105;
    planGrid.visible = viewMode === "plan";
    scene.add(planGrid);

    let draggedObject: THREE.Object3D | null = null;
    let draggedId: number | null = null;
    const dragOffset = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(floorY + 0.1));
    const updatePointerRay = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (viewMode !== "plan" || event.button !== 0) return;
      updatePointerRay(event);
      const hit = raycaster.intersectObjects(decorationObjects, true)[0];
      if (!hit) return;
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.decorationId == null) object = object.parent;
      const point = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (!object || !point) return;
      draggedObject = object;
      draggedId = Number(object.userData.decorationId);
      dragOffset.set(object.position.x - point.x, object.position.z - point.z);
      setSelectedDecorationId(draggedId);
      controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!draggedObject) return;
      updatePointerRay(event);
      const point = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (!point) return;
      draggedObject.position.x = THREE.MathUtils.clamp(point.x + dragOffset.x, -widthHalf + 0.18, widthHalf - 0.18);
      draggedObject.position.z = THREE.MathUtils.clamp(point.z + dragOffset.y, -depthHalf + 0.18, depthHalf - 0.18);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!draggedObject || draggedId === null) return;
      const id = draggedId;
      const position = { x: draggedObject.position.x / widthHalf, z: draggedObject.position.z / depthHalf };
      draggedObject = null;
      draggedId = null;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      setDecorations((current) => current.map((item) => item.id === id ? { ...item, position } : item));
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      host.replaceChildren();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, [shape, dimensions, biotope, decorations, viewMode]);

  const updateDimension = (key: keyof typeof dimensions, value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      setDimensions((current) => ({ ...current, [key]: numericValue }));
    }
  };

  const addDecoration = (kind: Decoration["kind"]) => {
    setDecorations((current) => {
      const column = current.length % 4;
      const row = Math.floor(current.length / 4);
      const position = { x: (column - 1.5) * 0.32, z: row % 2 === 0 ? -0.45 : 0.45 };
      return [...current, { id: nextId, kind, position }];
    });
    setNextId((current) => current + 1);
  };

  const removeDecoration = (id: number) => {
    setDecorations((current) => current.filter((item) => item.id !== id));
    if (selectedDecorationId === id) setSelectedDecorationId(null);
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
    const normalizedName = name.trim();
    if (!normalizedName) {
      setProjectDialogError("Le nom du projet ne peut pas être vide.");
      return;
    }
    if (savedProjects.some((project) => project.id !== id && project.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
      setProjectDialogError("Un projet porte déjà ce nom.");
      return;
    }
    const existing = savedProjects.find((project) => project.id === id);
    if (!existing) return;
    const isCurrentProject = projectId === id;
    const renamedProject: StoredProject = isCurrentProject
      ? { id, name: normalizedName, shape, biotope, dimensions, species, decorations, nextId, measurements }
      : { ...existing, name: normalizedName };
    const projects = savedProjects.map((project) => project.id === id ? renamedProject : project);
    if (!writeProjectCollection(projects, isCurrentProject ? renamedProject : undefined)) {
      setProjectDialogError("Impossible d’enregistrer le nouveau nom sur cet appareil.");
      return;
    }

    setSavedProjects(projects);
    if (isCurrentProject) {
      const serializedProject = JSON.stringify(renamedProject);
      lastSavedProjectRef.current = serializedProject;
      setProjectName(normalizedName);
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

    const projects = savedProjects.filter((saved) => saved.id !== project.id);
    if (!writeProjectCollection(projects, isCurrentProject ? null : undefined)) {
      setSaveStatus("error");
      setSaveFeedback("Impossible de supprimer la sauvegarde sur cet appareil");
      return;
    }

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
      decorations,
      nextId,
      measurements,
    };
    const serializedProject = JSON.stringify(project);

    try {
      const projects = [...savedProjects.filter((saved) => saved.id !== project.id), project];
      localStorage.setItem(projectsStorageKey, JSON.stringify(projects));
      localStorage.setItem(currentProjectStorageKey, serializedProject);
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
      decorations,
      nextId,
      measurements,
    };
    const exportData: ProjectExport = { format: projectExportFormat, version: 1, exportedAt: new Date().toISOString(), project };
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
    setSaveFeedback("Export JSON téléchargé");
    window.setTimeout(() => setSaveFeedback(""), 2200);
  };

  const importProjectFile = async (file: File | undefined) => {
    if (!file) return;

    let importedProject: StoredProject | null = null;
    try {
      if (file.size > 1_000_000) throw new Error("Project file is too large");
      importedProject = parseProjectExport(JSON.parse(await file.text()) as unknown);
    } catch {
      importedProject = null;
    }
    if (!importedProject) {
      setSaveStatus("error");
      setSaveFeedback("Fichier JSON invalide ou version non prise en charge");
      return;
    }

    const existingProjects = readSavedProjects();
    const importedBaseName = importedProject.name;
    let importedName = importedBaseName;
    let duplicateIndex = 1;
    while (existingProjects.some((saved) => saved.name === importedName)) {
      importedName = `${importedBaseName} (importé ${duplicateIndex})`;
      duplicateIndex += 1;
    }
    const project: StoredProject = {
      ...importedProject,
      id: globalThis.crypto.randomUUID(),
      name: importedName,
      dimensions: { ...importedProject.dimensions },
      decorations: importedProject.decorations.map((item) => ({ ...item, position: { ...item.position } })),
      measurements: importedProject.measurements ?? createDefaultMeasurements(),
    };
    const projects = [...existingProjects, project];
    const serializedProject = JSON.stringify(project);
    const previousProjects = localStorage.getItem(projectsStorageKey);
    const previousCurrentProject = localStorage.getItem(currentProjectStorageKey);
    try {
      localStorage.setItem(projectsStorageKey, JSON.stringify(projects));
      localStorage.setItem(currentProjectStorageKey, serializedProject);
    } catch {
      try {
        if (previousProjects === null) localStorage.removeItem(projectsStorageKey);
        else localStorage.setItem(projectsStorageKey, previousProjects);
        if (previousCurrentProject === null) localStorage.removeItem(currentProjectStorageKey);
        else localStorage.setItem(currentProjectStorageKey, previousCurrentProject);
      } catch {
        setSaveStatus("error");
        setSaveFeedback("Impossible de restaurer le stockage local");
        return;
      }
      setSaveStatus("error");
      setSaveFeedback("Stockage local indisponible");
      return;
    }

    lastSavedProjectRef.current = serializedProject;
    setProjectId(project.id);
    setProjectName(project.name);
    setShape(project.shape);
    setBiotope(project.biotope);
    setDimensions(project.dimensions);
    setSpecies(project.species);
    setDecorations(project.decorations);
    setNextId(project.nextId);
    setMeasurements(project.measurements ?? createDefaultMeasurements());
    setSelectedDecorationId(null);
    setViewMode("3d");
    setSavedProjects(projects);
    setSaveStatus("saved");
    setSaveFeedback("Projet importé");
    window.setTimeout(() => setSaveFeedback(""), 2200);
    projectMenuRef.current?.removeAttribute("open");
  };

  const loadProject = (project: StoredProject) => {
    lastSavedProjectRef.current = JSON.stringify(project);
    setProjectId(project.id);
    setProjectName(project.name);
    setShape(project.shape);
    setBiotope(project.biotope);
    setDimensions(project.dimensions);
    setSpecies(project.species);
    setDecorations(project.decorations);
    setNextId(project.nextId);
    setMeasurements(project.measurements ?? createDefaultMeasurements());
    setSelectedDecorationId(null);
    setSaveStatus("saved");
    setSaveFeedback("");
    localStorage.setItem(currentProjectStorageKey, JSON.stringify(project));
    projectMenuRef.current?.removeAttribute("open");
  };

  const startNewProject = () => {
    if (!window.confirm("Créer un nouveau projet ? Les changements non enregistrés seront perdus.")) return;
    setProjectId(null);
    lastSavedProjectRef.current = null;
    setProjectName("Habitat sans titre");
    setShape("Basse");
    setBiotope("Tropical");
    setDimensions({ width: 120, depth: 60, height: 80 });
    setSpecies(speciesList[0].label);
    setDecorations(createDefaultDecorations());
    setNextId(4);
    setMeasurements(createDefaultMeasurements());
    setSelectedDecorationId(null);
    setViewMode("3d");
    setSaveStatus("idle");
    setSaveFeedback("");
    localStorage.removeItem(currentProjectStorageKey);
    projectMenuRef.current?.removeAttribute("open");
  };

  const selectedSpecies = speciesList.find((item) => item.label === species) ?? speciesList[0];
  const minimumDimensions = selectedSpecies.minimumDimensions;
  const dimensionsMeetMinimum = minimumDimensions !== null &&
    dimensions.width >= minimumDimensions.width &&
    dimensions.depth >= minimumDimensions.depth &&
    dimensions.height >= minimumDimensions.height;
  const hasHideAtLeftEnd = decorations.some((item) => item.kind === "Cachette" && item.position.x <= -0.5);
  const hasHideAtRightEnd = decorations.some((item) => item.kind === "Cachette" && item.position.x >= 0.5);
  const hideEndCount = Number(hasHideAtLeftEnd) + Number(hasHideAtRightEnd);
  const hidingCheck: { label: string; status: CheckStatus; detail: string } = selectedSpecies.hidesAtBothEnds === null
    ? { label: "Cachettes aux deux extrémités", status: "unknown", detail: "Non documenté" }
    : {
      label: "Cachettes aux deux extrémités",
      status: hideEndCount === 2 ? "met" : "insufficient",
      detail: hideEndCount === 2 ? "2/2 extrémités couvertes" : `${hideEndCount}/2 extrémités · cachette manquante dans le quart ${hasHideAtLeftEnd ? "droit" : "gauche"}`,
    };
  const rangeCheck = (label: string, key: MeasurementKey, unit: string): { label: string; status: CheckStatus; detail: string } => {
    const range = selectedSpecies.referenceRanges?.[key];
    const value = measurements[key];
    if (!range) return { label, status: "unknown", detail: "Non documenté" };
    const rangeLabel = `${range[0]}–${range[1]} ${unit}`;
    if (value === null) return { label, status: "unknown", detail: `À mesurer · repère ${rangeLabel}` };
    const isInRange = value >= range[0] && value <= range[1];
    return {
      label,
      status: isInRange ? "met" : "attention",
      detail: `${value} ${unit} · ${isInRange ? "dans la plage" : "hors plage"} ${rangeLabel}`,
    };
  };
  const checks: { label: string; status: CheckStatus; detail: string }[] = [
    {
      label: "Dimensions minimales",
      status: minimumDimensions === null ? "unknown" : dimensionsMeetMinimum ? "met" : "insufficient",
      detail: minimumDimensions === null ? "Non documenté" : `${dimensionsMeetMinimum ? "Respecté" : "Insuffisant"} · min. ${minimumDimensions.width} × ${minimumDimensions.depth} × ${minimumDimensions.height} cm`,
    },
    rangeCheck("Zone chaude", "hotSideTemperature", "°C"),
    rangeCheck("Zone fraîche", "coolSideTemperature", "°C"),
    rangeCheck("UVI zone de basking", "baskingUvi", "UVI"),
    rangeCheck("Humidité côté frais", "coolSideHumidity", "%"),
    hidingCheck,
    { label: "Autre enrichissement", status: "unknown", detail: "Non documenté" },
  ];
  const hasInsufficientCheck = checks.some((check) => check.status === "insufficient");
  const hasAttentionCheck = checks.some((check) => check.status === "attention");
  const allChecksDocumented = checks.every((check) => check.status !== "unknown");
  const overallStatus = hasInsufficientCheck ? "Repères à compléter" : hasAttentionCheck ? "Mesure à vérifier" : allChecksDocumented ? "Dans les repères consultés" : "À documenter";
  const checkStatusLabels: Record<CheckStatus, string> = {
    met: "Repère atteint",
    insufficient: "À compléter",
    attention: "À vérifier",
    unknown: "Non documenté",
  };

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    const numericValue = value === "" ? null : Number(value);
    if (numericValue === null || Number.isFinite(numericValue)) {
      setMeasurements((current) => ({ ...current, [key]: numericValue }));
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

          <section className="form-section">
            <div className="section-title"><span>01</span><h2>Le contenant</h2></div>
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
                  <input aria-label={key === "width" ? "Largeur en centimètres" : key === "depth" ? "Profondeur en centimètres" : "Hauteur en centimètres"} type="number" min="20" max="300" value={dimensions[key]} onChange={(event) => updateDimension(key, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="size-summary"><Ruler size={14} /> Volume estimé <strong>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</strong></div>
          </section>

          <section className="form-section">
            <div className="section-title"><span>02</span><h2>Le biotope</h2></div>
            <div className="biotope-options" role="group" aria-label="Type de terrarium">
              {(["Désertique", "Tropical", "Paludarium"] as Biotope[]).map((option) => (
                <button key={option} type="button" className={`biotope-option ${biotope === option ? "selected" : ""}`} onClick={() => setBiotope(option)}>
                  <span className="biotope-icon">{option === "Désertique" ? <Sun size={16} /> : option === "Paludarium" ? <Waves size={16} /> : <Sprout size={16} />}</span>
                  <span>{option}</span>
                  {biotope === option && <Check size={14} className="option-check" />}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section decor-section">
            <div className="section-title"><span>03</span><h2>Le décor</h2><span className="count-pill">{decorations.length}</span></div>
            <div className="decor-tools">
              <button type="button" onClick={() => addDecoration("Plante")}><Plus size={14} /><Leaf size={15} /> Plante</button>
              <button type="button" onClick={() => addDecoration("Cachette")}><Plus size={14} /><Expand size={14} /> Cachette</button>
              <button type="button" onClick={() => addDecoration("Roche")}><Plus size={14} /><span className="rock-icon" /> Roche</button>
            </div>
            <div className="decor-list">
              {decorations.map((item, index) => (
                <div className={`decor-item ${selectedDecorationId === item.id ? "selected" : ""}`} key={item.id}>
                  <span className={`decor-swatch swatch-${item.kind.toLowerCase()}`}>{item.kind === "Plante" ? <Leaf size={14} /> : item.kind === "Cachette" ? <Expand size={14} /> : <span className="rock-icon" />}</span>
                  <span className="decor-label" onClick={() => setSelectedDecorationId(item.id)}><span>{item.kind} <small>{String(index + 1).padStart(2, "0")}</small></span><small className="decor-position">X {Math.round((item.position.x + 1) * dimensions.width / 2)} cm · Z {Math.round((item.position.z + 1) * dimensions.depth / 2)} cm · centre → paroi {Math.round(Math.min((item.position.x + 1) * dimensions.width / 2, (1 - item.position.x) * dimensions.width / 2, (item.position.z + 1) * dimensions.depth / 2, (1 - item.position.z) * dimensions.depth / 2))} cm</small></span>
                  <button type="button" className="remove-button" title={`Retirer ${item.kind}`} aria-label={`Retirer ${item.kind}`} onClick={() => removeDecoration(item.id)}><X size={14} /></button>
                </div>
              ))}
              {decorations.length === 0 && <p className="empty-decor">Le terrarium est vide pour le moment.</p>}
            </div>
          </section>

          <section className="form-section species-section">
            <div className="section-title"><span>04</span><h2>Son habitant</h2></div>
            <label className="species-select-wrap">
              <span className="sr-only">Espèce de reptile ou amphibien</span>
              <select value={species} onChange={(event) => setSpecies(event.target.value)}>
                {speciesList.map((item) => <option key={item.label}>{item.label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <p className="species-note"><CircleHelp size={13} /> {selectedSpecies.source ? "Les critères incomplets restent à vérifier." : "Aucune source de maintenance vérifiée pour cette espèce."}</p>
            {selectedSpecies.referenceRanges && <div className="measurement-form">
              <p className="field-label">Mesures relevées <small>optionnel</small></p>
              <div className="measurement-grid">
                <label><span>Zone chaude · °C</span><input aria-label="Température zone chaude en degrés" type="number" step="0.1" value={measurements.hotSideTemperature ?? ""} onChange={(event) => updateMeasurement("hotSideTemperature", event.target.value)} /></label>
                <label><span>Zone fraîche · °C</span><input aria-label="Température zone fraîche en degrés" type="number" step="0.1" value={measurements.coolSideTemperature ?? ""} onChange={(event) => updateMeasurement("coolSideTemperature", event.target.value)} /></label>
                <label><span>UVI · basking</span><input aria-label="Indice UVB UVI dans la zone de basking" type="number" min="0" step="0.1" value={measurements.baskingUvi ?? ""} onChange={(event) => updateMeasurement("baskingUvi", event.target.value)} /></label>
                <label><span>Humidité · %</span><input aria-label="Humidité côté frais en pourcentage" type="number" min="0" max="100" step="1" value={measurements.coolSideHumidity ?? ""} onChange={(event) => updateMeasurement("coolSideHumidity", event.target.value)} /></label>
              </div>
              <p className="measurement-note">Repères {selectedSpecies.source?.publisher}; températures en °C converties si nécessaire. Mesurez chaque zone séparément.</p>
            </div>}
          </section>
        </aside>

        <section className="stage-column" aria-label="Visualisation 3D">
          <div className="stage-toolbar">
            <div className="view-tabs"><button className={viewMode === "3d" ? "active" : ""} type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}><Eye size={14} /> Vue 3D</button><button className={viewMode === "plan" ? "active" : ""} type="button" aria-pressed={viewMode === "plan"} onClick={() => setViewMode("plan")}><Ruler size={14} /> Plan</button></div>
            <span className="stage-dimensions">{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</span>
          </div>
          <div className="viewport-wrap">
            <div className="viewport" ref={viewportRef} data-mode={viewMode} />
            <div className="viewport-label"><span className="live-dot" /> {viewMode === "plan" ? "VUE EN PLAN" : "APERÇU EN DIRECT"}</div>
            <div className="viewport-tools"><button type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={16} /></button></div>
            <div className="viewport-caption"><span className="caption-index">FIG. 01</span><span>{biotope} <b>·</b> {shape.toLowerCase()}</span></div>
          </div>
          <div className="stage-footer"><span><span className="legend-dot glass-dot" /> Verre clair</span><span><span className="legend-dot ground-dot" /> Substrat {biotope.toLowerCase()}</span><span className="orbit-hint">{viewMode === "plan" ? "Glisser un élément pour le déplacer" : `${decorations.length} éléments dans la scène`}</span></div>
        </section>

        <aside className="panel right-panel">
          <div className="analysis-heading"><span className="analysis-icon"><ShieldCheck size={19} /></span><div><p className="eyebrow">BILAN DU PROJET</p><h2>Conformité</h2></div></div>
          <div className={`status-block ${hasInsufficientCheck ? "insufficient" : hasAttentionCheck ? "attention" : ""}`}>
            <div className="status-top"><span className="status-mark">{hasInsufficientCheck || hasAttentionCheck ? <AlertTriangle size={15} /> : <CircleHelp size={15} />}</span><span>{overallStatus}</span></div>
            <p>{hasInsufficientCheck ? "Au moins un repère de la source n’est pas atteint. Consultez le détail ci-dessous." : hasAttentionCheck ? "Au moins une mesure est hors de la plage de référence; vérifiez le matériel, le point de mesure et le guide complet." : "Ce bilan est partiel : les critères sans données sourcées restent inconnus et ne sont pas considérés comme conformes."}</p>
          </div>
          <div className="selected-species"><p className="field-label">ESPÈCE SÉLECTIONNÉE</p><strong>{selectedSpecies.commonName}</strong><span>{selectedSpecies.scientificName}</span></div>
          <div className="species-source"><p className="field-label">RÉFÉRENCE</p>{selectedSpecies.source ? <><a href={selectedSpecies.source.url} target="_blank" rel="noreferrer">{selectedSpecies.source.title} · {selectedSpecies.source.publisher}</a><small>Consultée le {selectedSpecies.source.checkedAt}</small></> : <span>Aucune référence vérifiée. Ces points restent inconnus.</span>}</div>
          <div className="checklist-heading"><span>Points à vérifier</span><span className="checklist-line" /></div>
          {checks.map((check) => <div className="check-row" key={check.label}><span className={`check-icon ${check.status}`}>{check.status === "met" ? <Check size={14} /> : check.status === "insufficient" ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}</span><span>{check.label}</span><small>{check.detail}</small></div>)}
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
              <div><p className="eyebrow">RAPPORT D'HABITAT · {new Date().toLocaleDateString("fr-FR")}</p><h2 id="report-title">{projectName}</h2><p>{selectedSpecies.commonName} · <i>{selectedSpecies.scientificName}</i></p></div>
              <button type="button" className="report-close" aria-label="Fermer le rapport" autoFocus onClick={() => setShowReport(false)}><X size={17} /></button>
            </header>
            <dl className="report-facts">
              <div><dt>Dimensions intérieures</dt><dd>{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</dd></div>
              <div><dt>Biotope et format</dt><dd>{biotope} · {shape.toLowerCase()}</dd></div>
              <div><dt>Volume estimé</dt><dd>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</dd></div>
              <div><dt>Statut du bilan</dt><dd>{overallStatus}</dd></div>
            </dl>
            <h3>Critères et relevés</h3>
            <div className="report-checks">
              {checks.map((check) => <div className="report-check" key={check.label}>
                <span className={`check-icon ${check.status}`}>{check.status === "met" ? <Check size={14} /> : check.status === "insufficient" || check.status === "attention" ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}</span>
                <strong>{check.label}</strong><span className={`report-check-status ${check.status}`}>{checkStatusLabels[check.status]}</span><p>{check.detail}</p>
              </div>)}
            </div>
            <section className="report-reference"><h3>Référence consultée</h3>{selectedSpecies.source ? <><a href={selectedSpecies.source.url} target="_blank" rel="noreferrer">{selectedSpecies.source.title} · {selectedSpecies.source.publisher}</a><p>Consultée le {selectedSpecies.source.checkedAt}. Les repères ne remplacent pas le guide complet.</p></> : <p>Aucune référence de maintenance vérifiée pour cette espèce.</p>}</section>
            <p className="report-disclaimer">Ce bilan est partiel; les critères non documentés ne sont pas considérés comme conformes. Il ne certifie pas un habitat et ne remplace pas l’avis d’un vétérinaire spécialisé.</p>
            <div className="report-actions"><button type="button" className="cancel-button" onClick={() => setShowReport(false)}>Fermer</button><button type="button" className="save-button" onClick={() => window.print()}><Printer size={15} /> Imprimer / PDF</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
