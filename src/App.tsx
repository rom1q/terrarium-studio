import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  Expand,
  Eye,
  FileText,
  GitBranch,
  Layers,
  Leaf,
  Move,
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
import {
  calculateProjectChecks,
  duplicateDecoration,
  getBiotopeGuidance,
  getDecorationVariantsForBiotope,
  getDefaultDecorationVariant,
  getHabitatZoneGuidance,
  isStoredProject,
  measureDecorationPlacement,
  parseProjectExport,
  positionDecorationAtCm,
  PROJECT_EXPORT_FORMAT,
  resolveBiotopeSelection,
  removeSavedProjectRecord,
  resizeDecoration,
  rotateDecoration,
  renameSavedProjectRecord,
  updateDecorationVariant,
  type Biotope,
  type DecorationKind,
  type DecorationAxis,
  type CheckStatus,
  type Decoration,
  type MeasurementKey,
  type Measurements,
  type LifeStage,
  type HabitatZoneKey,
  type ProjectExport,
  type Shape,
  type SpeciesProfile,
  type StoredProject,
} from "./projectLogic";

type SaveStatus = "idle" | "pending" | "saved" | "error";

const projectsStorageKey = "terrarium-studio-projects";
const currentProjectStorageKey = "terrarium-studio-current-project";

const speciesList: SpeciesProfile[] = [
  {
    label: "Pogona vitticeps · Dragon barbu",
    scientificName: "Pogona vitticeps",
    commonName: "Dragon barbu",
    source: { title: "Caring for your bearded dragon", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/beardeddragon", checkedAt: "2026-11-06" },
    biotopeGuidance: {
      Désertique: { status: "compatible", detail: "La RSPCA décrit un habitat d’origine sec et recommande 30–40 % d’humidité." },
      Tropical: { status: "incompatible", detail: "La RSPCA décrit un habitat sec et une humidité basse (30–40 %)." },
      Paludarium: { status: "incompatible", detail: "La RSPCA recommande un habitat sec, bien ventilé et à faible humidité (30–40 %)." },
    },
    stageGuidance: {
      juvenile: "Les jeunes dragons ont besoin d’une plus grande part de proies; la part de végétaux augmente avec l’âge. La RSPCA indique deux repas par jour pour les bébés et un pour les juvéniles.",
    },
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
    biotopeGuidance: {
      Désertique: { status: "compatible", detail: "ReptiFiles situe l’espèce en zones semi-désertiques et prairies arides, avec 30–40 % d’humidité." },
      Tropical: { status: "incompatible", detail: "Les repères ReptiFiles sont adaptés à un habitat aride et une humidité de 30–40 %." },
      Paludarium: { status: "incompatible", detail: "Les repères ReptiFiles indiquent un habitat aride et une humidité de 30–40 %, pas une configuration humide." },
    },
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
    biotopeGuidance: {
      Désertique: { status: "incompatible", detail: "ReptiFiles décrit une espèce arboricole de Nouvelle-Calédonie avec 60–80 % d’humidité." },
      Tropical: { status: "compatible", detail: "ReptiFiles décrit un gecko arboricole de Nouvelle-Calédonie avec une humidité de 60–80 %." },
    },
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
const speciesLabels = speciesList.map((species) => species.label);

function DecorationIcon({ kind, size }: { kind: DecorationKind; size: number }) {
  if (kind === "Plante") return <Leaf size={size} />;
  if (kind === "Cachette") return <Expand size={size} />;
  if (kind === "Branche") return <GitBranch size={size} />;
  if (kind === "Plateforme") return <Layers size={size} />;
  if (kind === "Gamelle") return <Waves size={size} />;
  return <span className="rock-icon" />;
}

const habitatZoneLabels: Record<HabitatZoneKey, string> = {
  hot: "Zone chaude",
  cool: "Zone fraîche",
  uv: "UVB / basking",
  retreat: "Retraits",
};

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

function readCurrentProject(): StoredProject | null {
  try {
    const value = localStorage.getItem(currentProjectStorageKey);
    if (!value) return null;
    const project: unknown = JSON.parse(value);
    return isStoredProject(project, speciesLabels) ? project : null;
  } catch {
    return null;
  }
}

function readSavedProjects(): StoredProject[] {
  try {
    const value = localStorage.getItem(projectsStorageKey);
    if (!value) return [];
    const projects: unknown = JSON.parse(value);
    return Array.isArray(projects) ? projects.filter((project): project is StoredProject => isStoredProject(project, speciesLabels)) : [];
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
  const initialSpeciesProfile = speciesList.find((item) => item.label === initialProject?.species) ?? speciesList[0];
  const initialBiotope = resolveBiotopeSelection(initialSpeciesProfile, initialProject?.biotope ?? "Désertique");
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
  const [biotope, setBiotope] = useState<Biotope>(initialBiotope);
  const [dimensions, setDimensions] = useState(initialProject?.dimensions ?? { width: 120, depth: 60, height: 80 });
  const [species, setSpecies] = useState(initialProject?.species ?? speciesList[0].label);
  const selectedSpecies = speciesList.find((item) => item.label === species) ?? speciesList[0];
  const habitatZoneGuidance = getHabitatZoneGuidance(selectedSpecies);
  const [showHabitatZones, setShowHabitatZones] = useState(false);
  const [lifeStage, setLifeStage] = useState<LifeStage>(initialProject?.lifeStage ?? "adult");
  const [measurements, setMeasurements] = useState<Measurements>(initialProject?.measurements ?? createDefaultMeasurements());
  const [viewMode, setViewMode] = useState<"3d" | "plan">("3d");
  const [selectedDecorationId, setSelectedDecorationId] = useState<number | null>(null);
  const selectedDecorationIdRef = useRef<number | null>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate");
  const [decorations, setDecorations] = useState<Decoration[]>(initialProject?.decorations ?? createDefaultDecorations());
  const [nextId, setNextId] = useState(initialProject?.nextId ?? 4);
  const selectDecoration = (id: number | null) => {
    selectedDecorationIdRef.current = id;
    setSelectedDecorationId(id);
  };

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
  }, [projectId, projectName, shape, biotope, dimensions, species, lifeStage, decorations, nextId, measurements]);

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
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(transformMode);
    transformControls.rotationSnap = Math.PI / 12;
    transformControls.showX = transformMode !== "rotate";
    transformControls.showZ = transformMode !== "rotate";

    const width = Math.min(3.2, Math.max(1.7, dimensions.width / 58));
    const depth = Math.min(2.5, Math.max(1.25, dimensions.depth / 38));
    const heightScale = shape === "Verticale" ? 0.038 : shape === "Cubique" ? 0.03 : 0.022;
    const height = Math.min(3.1, Math.max(1.65, dimensions.height * heightScale));
    const floorY = 0.12;
    const colors = biotopeColors[biotope];
    const zoneIsDocumented = (key: HabitatZoneKey) => habitatZoneGuidance.find((zone) => zone.key === key)?.status === "documented";
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
    const decorationObjectsById = new Map<number, THREE.Object3D>();
    decorations.forEach((item) => {
      const x = item.position.x * widthHalf;
      const z = item.position.z * depthHalf;
      const verticalOffset = (item.position.y ?? 0) * height;
      const sizeScale = (item.size ?? 100) / 100;
      const variant = item.variant ?? getDefaultDecorationVariant(item.kind, biotope);
      if (item.kind === "Plante") {
        const plant = new THREE.Group();
        plant.userData.decorationId = item.id;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.026, 0.62, 7),
          new THREE.MeshStandardMaterial({ color: 0x65804b, roughness: 0.8 }),
        );
        if (variant === "Rosette") stem.visible = false;
        stem.position.y = 0.38;
        plant.add(stem);
        const leafCount = variant === "Feuillage dense" ? 5 : 8;
        for (let leaf = 0; leaf < leafCount; leaf += 1) {
          const angle = leaf * (Math.PI * 2 / leafCount);
          const leafRadius = variant === "Fougère" ? 0.1 : variant === "Rosette" ? 0.16 : 0.13;
          const leafWidth = variant === "Fougère" ? 0.07 : 0.13;
          const leafHeight = variant === "Rosette" ? 0.3 : variant === "Fougère" ? 0.36 : 0.42;
          const leafY = variant === "Rosette" ? 0.22 : 0.48 + leaf * (variant === "Fougère" ? 0.065 : 0.1);
          const foliage = new THREE.Mesh(
            new THREE.ConeGeometry(leafWidth, leafHeight, 5),
            new THREE.MeshStandardMaterial({ color: leaf % 2 ? 0x55804b : colors.plant, roughness: 0.78 }),
          );
          foliage.position.set(Math.cos(angle) * leafRadius, leafY, Math.sin(angle) * leafRadius);
          foliage.rotation.z = Math.cos(angle) * (variant === "Rosette" ? 0.8 : 0.5);
          foliage.rotation.x = Math.sin(angle) * (variant === "Rosette" ? 0.8 : 0.4);
          plant.add(foliage);
        }
        plant.scale.setScalar(sizeScale);
        plant.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        plant.position.set(x, floorY + 0.1 + verticalOffset, z);
        scene.add(plant);
        decorationObjects.push(plant);
        decorationObjectsById.set(item.id, plant);
      } else if (item.kind === "Cachette") {
        const hide = new THREE.Group();
        hide.userData.decorationId = item.id;
        const isHollowTrunk = variant === "Tronc creux";
        const body = new THREE.Mesh(
          isHollowTrunk ? new THREE.CylinderGeometry(0.32, 0.34, 0.95, 12) : new THREE.DodecahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({ color: variant === "Écorce creuse" ? 0x785a3c : isHollowTrunk ? 0x76513a : 0x88735b, roughness: 1 }),
        );
        if (variant === "Écorce creuse") body.scale.set(1.45, 0.38, 1.05);
        else if (isHollowTrunk) body.scale.set(1, 0.8, 0.9);
        else body.scale.set(1.25, 0.68, 0.95);
        if (isHollowTrunk) body.rotation.z = Math.PI / 2;
        body.position.y = 0.26;
        hide.add(body);
        const entrance = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16),
          new THREE.MeshStandardMaterial({ color: 0x352e27, roughness: 1 }),
        );
        if (isHollowTrunk) {
          entrance.rotation.z = Math.PI / 2;
          entrance.position.set(0.35, 0.19, 0);
        } else {
          entrance.rotation.x = Math.PI / 2;
          entrance.position.set(0, 0.19, 0.36);
        }
        hide.add(entrance);
        hide.scale.setScalar(sizeScale);
        hide.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        hide.position.set(x, floorY + 0.1 + verticalOffset, z);
        scene.add(hide);
        decorationObjects.push(hide);
        decorationObjectsById.set(item.id, hide);
      } else if (item.kind === "Branche") {
        const branch = new THREE.Group();
        branch.userData.decorationId = item.id;
        const wood = new THREE.MeshStandardMaterial({ color: variant === "Branche droite" ? 0x805f42 : 0x705238, roughness: 0.94 });
        const addSegment = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
          const direction = new THREE.Vector3().subVectors(end, start);
          const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, direction.length(), 8), wood);
          segment.position.copy(start).add(end).multiplyScalar(0.5);
          segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
          branch.add(segment);
        };
        addSegment(new THREE.Vector3(-0.48, 0.16, 0), new THREE.Vector3(0.48, 0.78, 0), 0.075);
        if (variant === "Branche fourchue") {
          addSegment(new THREE.Vector3(0.06, 0.48, 0), new THREE.Vector3(-0.2, 0.9, 0.18), 0.045);
          addSegment(new THREE.Vector3(0.23, 0.59, 0), new THREE.Vector3(0.38, 0.98, -0.16), 0.04);
        }
        branch.scale.setScalar(sizeScale);
        branch.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        branch.position.set(x, floorY + 0.1 + verticalOffset, z);
        scene.add(branch);
        decorationObjects.push(branch);
        decorationObjectsById.set(item.id, branch);
      } else if (item.kind === "Plateforme") {
        const platform = new THREE.Group();
        platform.userData.decorationId = item.id;
        const material = new THREE.MeshStandardMaterial({ color: variant === "Plateau en liège" ? 0x9a7855 : 0x806344, roughness: 0.92 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.62), material);
        slab.position.y = 0.48;
        platform.add(slab);
        for (const supportX of [-0.36, 0.36]) {
          for (const supportZ of [-0.22, 0.22]) {
            const support = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), material);
            support.position.set(supportX, 0.22, supportZ);
            platform.add(support);
          }
        }
        platform.scale.setScalar(sizeScale);
        platform.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        platform.position.set(x, floorY + 0.1 + verticalOffset, z);
        scene.add(platform);
        decorationObjects.push(platform);
        decorationObjectsById.set(item.id, platform);
      } else if (item.kind === "Gamelle") {
        const bowl = new THREE.Group();
        bowl.userData.decorationId = item.id;
        const ceramic = new THREE.MeshStandardMaterial({ color: 0x8b8b79, roughness: 0.48 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.21, 0.15, 20, 1, true), ceramic);
        body.position.y = 0.075;
        bowl.add(body);
        const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.025, 20), ceramic);
        bottom.position.y = 0.02;
        bowl.add(bottom);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.022, 6, 24), ceramic);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.145;
        bowl.add(rim);
        if (variant === "Gamelle d’eau") {
          const water = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.012, 20),
            new THREE.MeshPhysicalMaterial({ color: colors.water, roughness: 0.2, metalness: 0.08 }),
          );
          water.position.y = 0.075;
          bowl.add(water);
        }
        bowl.scale.setScalar(sizeScale);
        bowl.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        bowl.position.set(x, floorY + 0.1 + verticalOffset, z);
        scene.add(bowl);
        decorationObjects.push(bowl);
        decorationObjectsById.set(item.id, bowl);
      } else {
        const isPebble = variant === "Galet";
        const rock = new THREE.Mesh(
          isPebble ? new THREE.SphereGeometry(0.32, 12, 8) : new THREE.DodecahedronGeometry(0.32, 0),
          new THREE.MeshStandardMaterial({ color: variant === "Stratifiée" ? 0x9a9284 : item.id % 2 ? 0x9a8b76 : 0x776a5d, roughness: isPebble ? 0.72 : 0.98 }),
        );
        const rockScale = variant === "Stratifiée" ? [1.35, 0.48, 1.1] : isPebble ? [1.25, 0.72, 0.95] : [1.2, 0.82, 0.95];
        rock.scale.set(rockScale[0] * sizeScale, rockScale[1] * sizeScale, rockScale[2] * sizeScale);
        rock.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        rock.position.set(x, floorY + 0.28 + verticalOffset, z);
        rock.userData.decorationId = item.id;
        scene.add(rock);
        decorationObjects.push(rock);
        decorationObjectsById.set(item.id, rock);
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

    if (showHabitatZones) {
      const addFloorZone = (key: HabitatZoneKey, x: number, z: number, radiusX: number, radiusZ: number, color: number) => {
        const zone = new THREE.Mesh(
          new THREE.CircleGeometry(1, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
        );
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(x, floorY + 0.112 + (key === "uv" ? 0.002 : 0), z);
        zone.scale.set(radiusX, radiusZ, 1);
        scene.add(zone);
      };
      if (zoneIsDocumented("hot")) addFloorZone("hot", -width * 0.24, 0, width * 0.24, depth * 0.38, 0xc47a53);
      if (zoneIsDocumented("cool")) addFloorZone("cool", width * 0.24, 0, width * 0.24, depth * 0.38, 0x6d9fac);
      if (zoneIsDocumented("uv")) addFloorZone("uv", -width * 0.24, -depth * 0.14, width * 0.12, depth * 0.2, 0xc4a64e);
      if (zoneIsDocumented("retreat")) {
        decorations.filter((item) => item.kind === "Cachette").forEach((item) => {
          addFloorZone("retreat", item.position.x * widthHalf, item.position.z * depthHalf, 0.28, 0.24, 0x75837d);
        });
      }
    }

    transformControls.detach();
    scene.add(transformControls.getHelper());
    const selectedObject = selectedDecorationIdRef.current === null ? undefined : decorationObjectsById.get(selectedDecorationIdRef.current);
    if (viewMode === "3d" && selectedObject) transformControls.attach(selectedObject);
    transformControls.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    const saveTransformedDecoration = () => {
      const object = transformControls.object;
      if (!object || object.userData.decorationId == null) return;
      const id = Number(object.userData.decorationId);
      const decoration = decorations.find((item) => item.id === id);
      if (!decoration) return;
      const position = {
        x: THREE.MathUtils.clamp(object.position.x / widthHalf, -1, 1),
        y: THREE.MathUtils.clamp((object.position.y - floorY - (decoration.kind === "Roche" ? 0.28 : 0.1)) / height, 0, 1),
        z: THREE.MathUtils.clamp(object.position.z / depthHalf, -1, 1),
      };
      const degrees = THREE.MathUtils.radToDeg(object.rotation.y);
      setDecorations((current) => rotateDecoration(
        current.map((item) => item.id === id ? { ...item, position } : item),
        id,
        degrees,
      ));
    };
    transformControls.addEventListener("mouseUp", saveTransformedDecoration);

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
      if (event.button !== 0 || transformControls.dragging || transformControls.axis !== null) return;
      updatePointerRay(event);
      const hit = raycaster.intersectObjects(decorationObjects, true)[0];
      if (!hit) {
        selectDecoration(null);
        transformControls.detach();
        return;
      }
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.decorationId == null) object = object.parent;
      if (!object) return;
      const id = Number(object.userData.decorationId);
      selectDecoration(id);
      if (viewMode === "3d") {
        transformControls.attach(object);
        return;
      }
      const point = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (!point) return;
      draggedObject = object;
      draggedId = id;
      dragOffset.set(object.position.x - point.x, object.position.z - point.z);
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
      const previousPosition = decorations.find((item) => item.id === id)?.position;
      const position = { ...previousPosition, x: draggedObject.position.x / widthHalf, z: draggedObject.position.z / depthHalf };
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
      transformControls.dispose();
      scene.remove(transformControls.getHelper());
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
  }, [shape, dimensions, biotope, decorations, viewMode, transformMode, selectedSpecies, habitatZoneGuidance, showHabitatZones]);

  const updateDimension = (key: keyof typeof dimensions, value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      setDimensions((current) => ({ ...current, [key]: numericValue }));
    }
  };

  const updateSpecies = (speciesLabel: string) => {
    const nextSpecies = speciesList.find((item) => item.label === speciesLabel) ?? speciesList[0];
    const nextBiotope = resolveBiotopeSelection(nextSpecies, biotope);
    setSpecies(speciesLabel);
    if (nextBiotope !== biotope) {
      setBiotope(nextBiotope);
      setSaveFeedback(`Biotope adapté : ${nextBiotope}`);
      window.setTimeout(() => setSaveFeedback(""), 2200);
    }
  };

  const updateBiotope = (nextBiotope: Biotope) => {
    if (getBiotopeGuidance(selectedSpecies, nextBiotope).status === "incompatible") return;
    setBiotope(nextBiotope);
  };

  const addDecoration = (kind: Decoration["kind"]) => {
    setDecorations((current) => {
      const column = current.length % 3;
      const row = Math.floor(current.length / 3);
      const position = { x: (column - 1) * 0.5, z: row % 2 === 0 ? -0.45 : 0.45 };
      return [...current, { id: nextId, kind, variant: getDefaultDecorationVariant(kind, biotope), position }];
    });
    setNextId((current) => current + 1);
  };

  const updateDecorationPosition = (id: number, axis: DecorationAxis, value: string) => {
    const centimeters = Number(value);
    if (!Number.isFinite(centimeters)) return;
    setDecorations((current) => positionDecorationAtCm(current, id, axis, centimeters, dimensions));
  };

  const updateDecorationSize = (id: number, value: string) => {
    setDecorations((current) => resizeDecoration(current, id, Number(value)));
  };

  const updateDecorationRotation = (id: number, value: string) => {
    setDecorations((current) => rotateDecoration(current, id, Number(value)));
  };

  const updateDecorationVariantChoice = (id: number, variant: string) => {
    setDecorations((current) => updateDecorationVariant(current, id, variant));
  };

  const duplicateSelectedDecoration = () => {
    const id = selectedDecorationIdRef.current;
    if (id === null || !decorations.some((item) => item.id === id)) return;
    setDecorations((current) => duplicateDecoration(current, id, nextId));
    setNextId((current) => current + 1);
    selectDecoration(nextId);
  };

  const removeDecoration = (id: number) => {
    setDecorations((current) => current.filter((item) => item.id !== id));
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
      lifeStage,
      decorations,
      nextId,
      measurements,
    };
    const exportData: ProjectExport = { format: PROJECT_EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), project };
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
      importedProject = parseProjectExport(JSON.parse(await file.text()) as unknown, speciesLabels);
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
    setLifeStage(project.lifeStage ?? "adult");
    setDecorations(project.decorations);
    setNextId(project.nextId);
    setMeasurements(project.measurements ?? createDefaultMeasurements());
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
    setShape(project.shape);
    setBiotope(projectBiotope);
    setDimensions(project.dimensions);
    setSpecies(project.species);
    setLifeStage(project.lifeStage ?? "adult");
    setDecorations(project.decorations);
    setNextId(project.nextId);
    setMeasurements(project.measurements ?? createDefaultMeasurements());
    selectDecoration(null);
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
    setBiotope("Désertique");
    setDimensions({ width: 120, depth: 60, height: 80 });
    setSpecies(speciesList[0].label);
    setLifeStage("adult");
    setDecorations(createDefaultDecorations());
    setNextId(4);
    setMeasurements(createDefaultMeasurements());
    selectDecoration(null);
    setViewMode("3d");
    setSaveStatus("idle");
    setSaveFeedback("");
    localStorage.removeItem(currentProjectStorageKey);
    projectMenuRef.current?.removeAttribute("open");
  };

  const selectedBiotopeGuidance = getBiotopeGuidance(selectedSpecies, biotope);
  const { checks, hasInsufficientCheck, hasAttentionCheck, overallStatus } = calculateProjectChecks({ species: selectedSpecies, dimensions, decorations, measurements, lifeStage });
  const checkStatusLabels: Record<CheckStatus, string> = {
    met: "Repère atteint",
    insufficient: "À compléter",
    attention: "À vérifier",
    unknown: "Non documenté",
  };
  const positionedDecorations = measureDecorationPlacement(decorations, dimensions);
  const decorationCounts = (["Plante", "Cachette", "Roche", "Branche", "Plateforme", "Gamelle"] as const)
    .map((kind) => ({ kind, count: decorations.filter((item) => item.kind === kind).length }))
    .filter((item) => item.count > 0);

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

          <section className="form-section decor-section">
            <div className="section-title"><span>03</span><h2>Le décor</h2><span className="count-pill">{decorations.length}</span></div>
            <div className="decor-tools">
              <button type="button" onClick={() => addDecoration("Plante")}><Plus size={14} /><Leaf size={15} /> Plante</button>
              <button type="button" onClick={() => addDecoration("Cachette")}><Plus size={14} /><Expand size={14} /> Cachette</button>
              <button type="button" onClick={() => addDecoration("Roche")}><Plus size={14} /><span className="rock-icon" /> Roche</button>
              <button type="button" onClick={() => addDecoration("Branche")}><Plus size={14} /><GitBranch size={14} /> Branche</button>
              <button type="button" onClick={() => addDecoration("Plateforme")}><Plus size={14} /><Layers size={14} /> Plate-forme</button>
              <button type="button" onClick={() => addDecoration("Gamelle")}><Plus size={14} /><Waves size={14} /> Gamelle</button>
            </div>
            <p className="decor-variant-note">Variantes visuelles uniquement; vérifiez la compatibilité des matériaux avec l’espèce.</p>
            <div className="decor-list">
              {positionedDecorations.map((item, index) => {
                const selectedVariant = item.variant ?? getDefaultDecorationVariant(item.kind, biotope);
                const variantOptions = getDecorationVariantsForBiotope(item.kind, biotope);
                const variantIsSuggested = variantOptions.includes(selectedVariant);
                return <div className={`decor-item ${selectedDecorationId === item.id ? "selected" : ""}`} key={item.id}>
                  <span className={`decor-swatch swatch-${item.kind.toLowerCase()}`}><DecorationIcon kind={item.kind} size={14} /></span>
                  <div className="decor-editor">
                    <div className="decor-item-heading"><span>{item.kind} · {item.variant ?? getDefaultDecorationVariant(item.kind, biotope)} <small>{String(index + 1).padStart(2, "0")}</small></span><small className="decor-position">Paroi proche {item.nearestWallCm} cm</small></div>
                    {selectedDecorationId === item.id && viewMode === "3d" && <div className="transform-tools" role="group" aria-label={`Outils pour ${item.kind}`}>
                      <div className="transform-modes" role="group" aria-label="Mode de transformation">
                        <button type="button" className={transformMode === "translate" ? "active" : ""} aria-label="Déplacer" aria-pressed={transformMode === "translate"} title="Déplacer" onClick={() => setTransformMode("translate")}><Move size={13} /></button>
                        <button type="button" className={transformMode === "rotate" ? "active" : ""} aria-label="Pivoter" aria-pressed={transformMode === "rotate"} title="Pivoter" onClick={() => setTransformMode("rotate")}><RotateCcw size={13} /></button>
                      </div>
                      <button type="button" aria-label="Dupliquer" title="Dupliquer" onClick={duplicateSelectedDecoration}><Copy size={13} /></button>
                      <button type="button" className="transform-delete" aria-label="Supprimer" title="Supprimer" onClick={() => removeDecoration(item.id)}><Trash2 size={13} /></button>
                    </div>}
                    <label className="decor-variant-control"><span>Type</span><select aria-label={`Type de ${item.kind}`} value={selectedVariant} onChange={(event) => updateDecorationVariantChoice(item.id, event.target.value)}>{!variantIsSuggested && <option value={selectedVariant}>{selectedVariant} · non proposé pour {biotope.toLowerCase()}</option>}{variantOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                    {item.kind === "Plante" && <small className={`plant-variant-note ${variantIsSuggested ? "" : "not-suggested"}`}>{variantIsSuggested ? "Style visuel uniquement; vérifiez l’espèce botanique." : `Style non proposé pour le biotope ${biotope.toLowerCase()}.`}</small>}
                    <div className="decor-coordinate-grid">
                      <label><span>X · gauche</span><input type="number" min="0" max={dimensions.width} step="1" aria-label={`Position X de ${item.kind} en centimètres`} value={item.xCm} onChange={(event) => updateDecorationPosition(item.id, "x", event.target.value)} /></label>
                      <label><span>Z · haut</span><input type="number" min="0" max={dimensions.depth} step="1" aria-label={`Position Z de ${item.kind} en centimètres`} value={item.zCm} onChange={(event) => updateDecorationPosition(item.id, "z", event.target.value)} /></label>
                      <label><span>Y · hauteur</span><input type="number" min="0" max={dimensions.height} step="1" aria-label={`Hauteur Y de ${item.kind} en centimètres`} value={item.yCm} onChange={(event) => updateDecorationPosition(item.id, "y", event.target.value)} /></label>
                    </div>
                    <label className="decor-size-control"><span>Taille visuelle <output>{item.size ?? 100}%</output></span><input type="range" min="50" max="150" step="10" aria-label={`Taille visuelle de ${item.kind}`} value={item.size ?? 100} onChange={(event) => updateDecorationSize(item.id, event.target.value)} /></label>
                    <label className="decor-rotation-control"><span>Rotation Y · degrés</span><input type="number" min="0" max="359" step="15" aria-label={`Rotation de ${item.kind} en degrés`} value={item.rotation ?? 0} onChange={(event) => updateDecorationRotation(item.id, event.target.value)} /></label>
                  </div>
                  <button type="button" className="remove-button" title={`Retirer ${item.kind}`} aria-label={`Retirer ${item.kind}`} onClick={() => removeDecoration(item.id)}><X size={14} /></button>
                </div>;
              })}
              {decorations.length === 0 && <p className="empty-decor">Le terrarium est vide pour le moment.</p>}
            </div>
          </section>

          <section className="form-section species-section">
            <div className="section-title"><span>04</span><h2>Son habitant</h2></div>
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
                <button type="button" className={lifeStage === "juvenile" ? "active" : ""} aria-pressed={lifeStage === "juvenile"} onClick={() => setLifeStage("juvenile")}>Juvénile</button>
                <button type="button" className={lifeStage === "adult" ? "active" : ""} aria-pressed={lifeStage === "adult"} onClick={() => setLifeStage("adult")}>Adulte</button>
              </div>
            </div>
            <p className="species-note"><CircleHelp size={13} /> {lifeStage === "juvenile" ? "Profil d’habitat juvénile incomplet; les seuils adultes ne sont pas appliqués." : selectedSpecies.source ? "Les critères incomplets restent à vérifier." : "Aucune source de maintenance vérifiée pour cette espèce."}</p>
            {selectedSpecies.stageGuidance?.[lifeStage] && <div className="stage-guidance"><p className="field-label">Repère alimentaire · {selectedSpecies.source?.publisher}</p><p>{selectedSpecies.stageGuidance[lifeStage]}</p></div>}
            {selectedSpecies.referenceRanges && <div className="measurement-form">
              <p className="field-label">Mesures relevées <small>optionnel</small></p>
              <div className="measurement-grid">
                <label><span>Zone chaude · °C</span><input aria-label="Température zone chaude en degrés" type="number" step="0.1" value={measurements.hotSideTemperature ?? ""} onChange={(event) => updateMeasurement("hotSideTemperature", event.target.value)} /></label>
                <label><span>Zone fraîche · °C</span><input aria-label="Température zone fraîche en degrés" type="number" step="0.1" value={measurements.coolSideTemperature ?? ""} onChange={(event) => updateMeasurement("coolSideTemperature", event.target.value)} /></label>
                <label><span>UVI · basking</span><input aria-label="Indice UVB UVI dans la zone de basking" type="number" min="0" step="0.1" value={measurements.baskingUvi ?? ""} onChange={(event) => updateMeasurement("baskingUvi", event.target.value)} /></label>
                <label><span>Humidité · %</span><input aria-label="Humidité côté frais en pourcentage" type="number" min="0" max="100" step="1" value={measurements.coolSideHumidity ?? ""} onChange={(event) => updateMeasurement("coolSideHumidity", event.target.value)} /></label>
              </div>
              <p className="measurement-note">{lifeStage === "adult" ? `Repères ${selectedSpecies.source?.publisher} pour adulte; températures en °C converties si nécessaire.` : "Relevés conservés, mais aucune plage juvénile vérifiée ne permet de les comparer."} Mesurez chaque zone séparément.</p>
            </div>}
          </section>
        </aside>

        <section className="stage-column" aria-label="Visualisation 3D">
          <div className="stage-toolbar">
            <div className="stage-view-controls">
              <div className="view-tabs"><button className={viewMode === "3d" ? "active" : ""} type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}><Eye size={14} /> Vue 3D</button><button className={viewMode === "plan" ? "active" : ""} type="button" aria-pressed={viewMode === "plan"} onClick={() => setViewMode("plan")}><Ruler size={14} /> Plan</button></div>
              <button className={`zones-toggle ${showHabitatZones ? "active" : ""}`} type="button" aria-pressed={showHabitatZones} onClick={() => setShowHabitatZones((visible) => !visible)}><Layers size={14} /> Zones</button>
            </div>
            <span className="stage-dimensions">{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</span>
          </div>
          <div className="viewport-wrap">
            <div className="viewport" ref={viewportRef} data-mode={viewMode} />
            <div className="viewport-label"><span className="live-dot" /> {viewMode === "plan" ? "VUE EN PLAN" : "APERÇU EN DIRECT"}</div>
            <div className="viewport-tools"><button type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={16} /></button></div>
            {showHabitatZones && <div className="habitat-zone-guide" aria-label="Disponibilité des zones selon les sources">
              <p>Repères sourcés · {selectedSpecies.source?.publisher ?? "aucune source"}</p>
              {habitatZoneGuidance.map((zone) => {
                const rangeText = zone.range ? `${zone.range[0]}–${zone.range[1]} ${zone.key === "uv" ? "UVI" : "°C"}` : zone.status === "documented" ? "Requis" : zone.status === "not-required" ? "Non requis" : "Non documenté";
                return <div className={`habitat-zone-row ${zone.key} ${zone.status}`} key={zone.key}><i /><span>{habitatZoneLabels[zone.key]}</span><strong>{rangeText}</strong></div>;
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
              <div><p className="eyebrow">RAPPORT D'HABITAT · {new Date().toLocaleDateString("fr-FR")}</p><h2 id="report-title">{projectName}</h2><p>{selectedSpecies.commonName} · {lifeStage === "adult" ? "Adulte" : "Juvénile"} · <i>{selectedSpecies.scientificName}</i></p></div>
              <button type="button" className="report-close" aria-label="Fermer le rapport" autoFocus onClick={() => setShowReport(false)}><X size={17} /></button>
            </header>
            <dl className="report-facts">
              <div><dt>Dimensions intérieures</dt><dd>{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</dd></div>
              <div><dt>Biotope et format</dt><dd>{biotope} · {shape.toLowerCase()}</dd></div>
              <div><dt>Stade de vie</dt><dd>{lifeStage === "adult" ? "Adulte" : "Juvénile"}</dd></div>
              <div><dt>Volume estimé</dt><dd>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</dd></div>
              <div><dt>Statut du bilan</dt><dd>{overallStatus}</dd></div>
            </dl>
            <section className="report-plan-section">
              <h3>Plan coté</h3>
              <div className="report-plan-dimensions"><span>Largeur intérieure <strong>{dimensions.width} cm</strong></span><span>Profondeur intérieure <strong>{dimensions.depth} cm</strong></span></div>
              <div className="report-plan-frame" role="img" aria-label={`Plan du terrarium de ${dimensions.width} par ${dimensions.depth} centimètres avec le décor placé`} style={{ aspectRatio: `${Math.max(1, dimensions.width)} / ${Math.max(1, dimensions.depth)}`, backgroundSize: `${Math.min(100, 1000 / Math.max(10, dimensions.width))}% ${Math.min(100, 1000 / Math.max(10, dimensions.depth))}%` }}>
                {positionedDecorations.map((item) => { const markerSize = 16 + (item.size ?? 100) * 0.08; return <span key={item.id} className={`report-plan-marker marker-${item.kind.toLowerCase()}`} style={{ left: `${Math.min(97, Math.max(3, (item.position.x + 1) * 50))}%`, top: `${Math.min(97, Math.max(3, (item.position.z + 1) * 50))}%`, width: markerSize, height: markerSize }} title={`${item.kind} · X ${item.xCm} cm · Z ${item.zCm} cm · ${item.size ?? 100}%`} aria-label={`${item.kind}, X ${item.xCm} cm, Z ${item.zCm} cm, taille ${item.size ?? 100}%`}><DecorationIcon kind={item.kind} size={13} /></span>; })}
              </div>
              <div className="report-plan-legend"><span><i className="legend-dot plant-dot" /> Plante</span><span><i className="legend-dot hide-dot" /> Cachette</span><span><i className="legend-dot rock-dot" /> Roche</span><span><i className="legend-dot branch-dot" /> Branche</span><span><i className="legend-dot platform-dot" /> Plate-forme</span><span><i className="legend-dot bowl-dot" /> Gamelle</span></div>
              <h4>Décor à prévoir</h4>
              {decorationCounts.length === 0 ? <p className="report-no-decor">Aucun élément de décor placé.</p> : <>
                <div className="report-material-counts">{decorationCounts.map((item) => <span key={item.kind}>{item.kind} <strong>× {item.count}</strong></span>)}</div>
                <ul className="report-material-list">{positionedDecorations.map((item, index) => <li key={item.id}><span className={`decor-swatch swatch-${item.kind.toLowerCase()}`}><DecorationIcon kind={item.kind} size={13} /></span><span><strong>{item.kind} {String(index + 1).padStart(2, "0")} · {item.variant ?? getDefaultDecorationVariant(item.kind, biotope)}</strong><small>X {item.xCm} cm depuis la gauche · Y {item.yCm} cm au-dessus du fond · Z {item.zCm} cm depuis le haut · rotation Y {item.rotation ?? 0}° · taille visuelle {item.size ?? 100}% · paroi proche {item.nearestWallCm} cm</small></span></li>)}</ul>
              </>}
            </section>
            <h3>Critères et relevés</h3>
            <div className="report-checks">
              {checks.map((check) => <div className="report-check" key={check.label}>
                <span className={`check-icon ${check.status}`}>{check.status === "met" ? <Check size={14} /> : check.status === "insufficient" || check.status === "attention" ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}</span>
                <strong>{check.label}</strong><span className={`report-check-status ${check.status}`}>{checkStatusLabels[check.status]}</span><p>{check.detail}</p>
              </div>)}
            </div>
            {selectedSpecies.stageGuidance?.[lifeStage] && <section className="report-stage-guidance"><h3>Repère alimentaire · {selectedSpecies.source?.publisher}</h3><p>{selectedSpecies.stageGuidance[lifeStage]}</p></section>}
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
