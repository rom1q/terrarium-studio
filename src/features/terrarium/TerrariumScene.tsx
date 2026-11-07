import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { getDefaultDecorationVariant, getEquipmentZoneSources, rotateDecoration, type Biotope, type Decoration, type HabitatZoneGuidance, type HabitatZoneKey, type Shape, type SpeciesProfile } from "../../domain/projectLogic";
import { plantCatalog } from "../../data/plantCatalog";
import { createPlantModel } from "./plantModels";
import { createRockModel } from "./decorationModels";
import { createHideModel } from "./hideModels";
import { getTerrariumSceneDimensions, type LayoutSuggestion, type LayoutWarning } from "../../domain/layoutValidation";
import { getDecorationGeometryProfile, otherDecorationGeometryProfiles } from "../../domain/decorationGeometry";

type TerrariumSceneProps = {
  shape: Shape;
  dimensions: { width: number; depth: number; height: number };
  biotope: Biotope;
  decorations: Decoration[];
  viewMode: "3d" | "plan";
  selectedDecorationId: number | null;
  transformMode: "translate" | "rotate";
  selectedSpecies: SpeciesProfile;
  habitatZoneGuidance: HabitatZoneGuidance[];
  showHabitatZones: boolean;
  activeLayoutWarning: LayoutWarning | null;
  previewedLayoutSuggestion: LayoutSuggestion | null;
  onDecorationSelectionChange: (id: number | null) => void;
  onDecorationsChange: Dispatch<SetStateAction<Decoration[]>>;
};
type CameraViewState = {
  viewMode: "3d" | "plan";
  position: [number, number, number];
  up: [number, number, number];
  target: [number, number, number];
};

const biotopeColors: Record<Biotope, { ground: number; plant: number; water: number }> = {
  Désertique: { ground: 0xcda875, plant: 0x74884b, water: 0x8dbdc1 },
  Tropical: { ground: 0x604c38, plant: 0x568b50, water: 0x83bfc0 },
  Paludarium: { ground: 0x665342, plant: 0x4c8051, water: 0x69abb0 },
};

function getPlantProfile(id: string | undefined) {
  return id ? plantCatalog.find((plant) => plant.id === id) : undefined;
}

function createContactShadowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot((x + 0.5 - size / 2) / (size / 2), (y + 0.5 - size / 2) / (size / 2));
      const alpha = Math.pow(Math.max(0, 1 - distance), 1.8) * 190;
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function TerrariumScene({ shape, dimensions, biotope, decorations, viewMode, selectedDecorationId, transformMode, selectedSpecies, habitatZoneGuidance, showHabitatZones, activeLayoutWarning, previewedLayoutSuggestion, onDecorationSelectionChange, onDecorationsChange }: TerrariumSceneProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraViewRef = useRef<CameraViewState | null>(null);
  const habitatZoneGuidanceRef = useRef(habitatZoneGuidance);
  const selectionHandlerRef = useRef(onDecorationSelectionChange);
  const selectedDecorationIdRef = useRef(selectedDecorationId);
  const activeLayoutWarningRef = useRef(activeLayoutWarning);
  const previewedLayoutSuggestionRef = useRef(previewedLayoutSuggestion);
  const activeLayoutWarningKey = activeLayoutWarning ? JSON.stringify(activeLayoutWarning) : "";
  const previewedLayoutSuggestionKey = previewedLayoutSuggestion ? JSON.stringify(previewedLayoutSuggestion) : "";
  const habitatZoneGuidanceKey = habitatZoneGuidance.map((zone) => `${zone.key}:${zone.status}`).join("|");
  habitatZoneGuidanceRef.current = habitatZoneGuidance;
  selectionHandlerRef.current = onDecorationSelectionChange;
  selectedDecorationIdRef.current = selectedDecorationId;
  activeLayoutWarningRef.current = activeLayoutWarning;
  previewedLayoutSuggestionRef.current = previewedLayoutSuggestion;

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9ede4");
    const contactShadowTexture = createContactShadowTexture();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const previousView = cameraViewRef.current?.viewMode === viewMode ? cameraViewRef.current : null;
    if (viewMode === "plan") {
      camera.up.set(0, 0, -1);
      camera.position.set(0, 8.5, 0);
    } else {
      camera.position.set(4.8, 3.8, 5.7);
    }
    if (previousView) {
      camera.position.set(...previousView.position);
      camera.up.set(...previousView.up);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8e9, 0x65745c, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffedc8, 3.4);
    keyLight.position.set(-3, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3.5;
    keyLight.shadow.camera.right = 3.5;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.updateProjectionMatrix();
    keyLight.shadow.bias = -0.00015;
    keyLight.shadow.normalBias = 0.003;
    keyLight.shadow.radius = 2;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc5e0d1, 0.25);
    fillLight.position.set(5, 3, -4);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, viewMode === "plan" ? 0.22 : 0.9, 0);
    if (previousView) controls.target.set(...previousView.target);
    controls.minDistance = 3.2;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enableRotate = viewMode !== "plan";
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(transformMode);
    transformControls.rotationSnap = Math.PI / 12;
    transformControls.showX = transformMode !== "rotate";
    transformControls.showZ = transformMode !== "rotate";

    const { width, depth, height } = getTerrariumSceneDimensions(shape, dimensions);
    const floorY = 0.12;
    const colors = biotopeColors[biotope];
    const zoneIsDocumented = (key: HabitatZoneKey) => habitatZoneGuidanceRef.current.find((zone) => zone.key === key)?.status === "documented";
    const equipmentZoneSources = getEquipmentZoneSources(decorations);
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
    floor.receiveShadow = true;
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
      beam.castShadow = true;
      beam.receiveShadow = true;
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
      const plantProfile = item.kind === "Plante" ? getPlantProfile(item.plantSpeciesId) : undefined;
      const variant = item.variant ?? plantProfile?.visualVariant ?? getDefaultDecorationVariant(item.kind, biotope);
      const geometryProfile = getDecorationGeometryProfile(item, biotope);
      if (item.kind === "Plante") {
        const plant = createPlantModel(plantProfile?.visual, variant, colors.plant);
        plant.userData.decorationId = item.id;
        plant.scale.multiplyScalar(sizeScale);
        plant.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        plant.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(plant);
        decorationObjects.push(plant);
        decorationObjectsById.set(item.id, plant);
      } else if (item.kind === "Cachette") {
        const hide = createHideModel(variant as "Grotte" | "Tronc creux" | "Écorce creuse");
        hide.userData.decorationId = item.id;
        hide.scale.setScalar(sizeScale);
        hide.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        hide.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(hide);
        decorationObjects.push(hide);
        decorationObjectsById.set(item.id, hide);
      } else if (item.kind === "Branche") {
        const branch = new THREE.Group();
        branch.userData.decorationId = item.id;
        const branchProfile = otherDecorationGeometryProfiles.branch[variant === "Branche droite" ? "straight" : "forked"];
        const wood = new THREE.MeshStandardMaterial({ color: variant === "Branche droite" ? 0x805f42 : 0x705238, roughness: 0.94 });
        const addSegment = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
          const direction = new THREE.Vector3().subVectors(end, start);
          const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, direction.length(), 8), wood);
          segment.position.copy(start).add(end).multiplyScalar(0.5);
          segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
          branch.add(segment);
        };
        branchProfile.segments.forEach((segment) => addSegment(
          new THREE.Vector3(segment.start[0], segment.start[1], segment.start[2]),
          new THREE.Vector3(segment.end[0], segment.end[1], segment.end[2]),
          segment.radius,
        ));
        branch.scale.setScalar(sizeScale);
        branch.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        branch.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(branch);
        decorationObjects.push(branch);
        decorationObjectsById.set(item.id, branch);
      } else if (item.kind === "Plateforme") {
        const platform = new THREE.Group();
        platform.userData.decorationId = item.id;
        const platformProfile = otherDecorationGeometryProfiles.platform;
        const material = new THREE.MeshStandardMaterial({ color: variant === "Plateau en liège" ? 0x9a7855 : 0x806344, roughness: 0.92 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(platformProfile.slab.width, platformProfile.slab.height, platformProfile.slab.depth), material);
        slab.position.y = platformProfile.slab.y;
        platform.add(slab);
        for (const supportX of platformProfile.support.x) {
          for (const supportZ of platformProfile.support.z) {
            const support = new THREE.Mesh(new THREE.BoxGeometry(platformProfile.support.width, platformProfile.support.height, platformProfile.support.depth), material);
            support.position.set(supportX, platformProfile.support.y, supportZ);
            platform.add(support);
          }
        }
        platform.scale.setScalar(sizeScale);
        platform.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        platform.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(platform);
        decorationObjects.push(platform);
        decorationObjectsById.set(item.id, platform);
      } else if (item.kind === "Gamelle") {
        const bowl = new THREE.Group();
        bowl.userData.decorationId = item.id;
        const bowlProfile = otherDecorationGeometryProfiles.bowl;
        const ceramic = new THREE.MeshStandardMaterial({ color: 0x8b8b79, roughness: 0.48 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(bowlProfile.body.topRadius, bowlProfile.body.bottomRadius, bowlProfile.body.height, 20, 1, true), ceramic);
        body.position.y = bowlProfile.body.y;
        bowl.add(body);
        const bottom = new THREE.Mesh(new THREE.CylinderGeometry(bowlProfile.bottom.radius, bowlProfile.bottom.radius, bowlProfile.bottom.height, 20), ceramic);
        bottom.position.y = bowlProfile.bottom.y;
        bowl.add(bottom);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(bowlProfile.rim.radius, bowlProfile.rim.tube, 6, 24), ceramic);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = bowlProfile.rim.y;
        bowl.add(rim);
        if (variant === "Gamelle d’eau") {
          const water = new THREE.Mesh(
            new THREE.CylinderGeometry(bowlProfile.water.radius, bowlProfile.water.radius, bowlProfile.water.height, 20),
            new THREE.MeshPhysicalMaterial({ color: colors.water, roughness: 0.2, metalness: 0.08 }),
          );
          water.position.y = bowlProfile.water.y;
          bowl.add(water);
        }
        bowl.scale.setScalar(sizeScale);
        bowl.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        bowl.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(bowl);
        decorationObjects.push(bowl);
        decorationObjectsById.set(item.id, bowl);
      } else if (item.kind === "Lampe chauffante") {
        const lamp = new THREE.Group();
        lamp.userData.decorationId = item.id;
        const lampProfile = otherDecorationGeometryProfiles.heater;
        const shade = new THREE.Mesh(
          new THREE.CylinderGeometry(lampProfile.shade.topRadius, lampProfile.shade.bottomRadius, lampProfile.shade.height, 16, 1, true),
          new THREE.MeshStandardMaterial({ color: 0x555d57, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide }),
        );
        shade.position.y = lampProfile.shade.y;
        lamp.add(shade);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(lampProfile.bulb.radius, 12, 8),
          new THREE.MeshStandardMaterial({ color: 0xe9a85d, emissive: 0xe58a3d, emissiveIntensity: 0.65, roughness: 0.35 }),
        );
        bulb.position.y = lampProfile.bulb.y;
        lamp.add(bulb);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(lampProfile.cable.radius, lampProfile.cable.radius, lampProfile.cable.height, 8), frameMaterial);
        cable.position.y = lampProfile.cable.y;
        lamp.add(cable);
        lamp.scale.setScalar(sizeScale);
        lamp.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        lamp.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(lamp);
        decorationObjects.push(lamp);
        decorationObjectsById.set(item.id, lamp);
      } else if (item.kind === "Tube UVB") {
        const tube = new THREE.Group();
        tube.userData.decorationId = item.id;
        const tubeProfile = otherDecorationGeometryProfiles.uvb;
        const lightTube = new THREE.Mesh(
          new THREE.CylinderGeometry(tubeProfile.tube.radius, tubeProfile.tube.radius, tubeProfile.tube.length, 10),
          new THREE.MeshStandardMaterial({ color: 0xdde8cd, emissive: 0x87a9ad, emissiveIntensity: 0.4, roughness: 0.32 }),
        );
        lightTube.rotation.z = Math.PI / 2;
        lightTube.position.y = tubeProfile.tube.y;
        tube.add(lightTube);
        const mount = new THREE.Mesh(new THREE.BoxGeometry(tubeProfile.mount.width, tubeProfile.mount.height, tubeProfile.mount.depth), frameMaterial);
        mount.position.y = tubeProfile.mount.y;
        tube.add(mount);
        tube.scale.setScalar(sizeScale);
        tube.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        tube.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        scene.add(tube);
        decorationObjects.push(tube);
        decorationObjectsById.set(item.id, tube);
      } else {
        const rock = createRockModel(variant as "Roche anguleuse" | "Galet" | "Stratifiée", item.id);
        rock.scale.setScalar(sizeScale);
        rock.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
        rock.position.set(x, floorY + 0.1 + geometryProfile.rootOffsetY + verticalOffset, z);
        rock.userData.decorationId = item.id;
        scene.add(rock);
        decorationObjects.push(rock);
        decorationObjectsById.set(item.id, rock);
      }
      if (item.kind !== "Lampe chauffante" && item.kind !== "Tube UVB") {
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(
            Math.max(0.32, geometryProfile.bounds.halfWidth * 1.7 * sizeScale),
            Math.max(0.32, geometryProfile.bounds.halfDepth * 1.7 * sizeScale),
          ),
          new THREE.MeshBasicMaterial({
            color: 0x453b2f,
            map: contactShadowTexture,
            transparent: true,
            opacity: 0.62,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(x, floorY + 0.106, z);
        shadow.renderOrder = 1;
        scene.add(shadow);
      }
    });
    decorationObjects.forEach((object) => object.traverse((part) => {
      if (part instanceof THREE.Mesh) part.castShadow = true;
    }));

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
      const addFloorZone = (key: HabitatZoneKey, x: number, z: number, radiusX: number, radiusZ: number, color: number, rotation = 0) => {
        const zone = new THREE.Mesh(
          new THREE.CircleGeometry(1, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
        );
        zone.rotation.set(-Math.PI / 2, THREE.MathUtils.degToRad(rotation), 0);
        zone.position.set(x, floorY + 0.112 + (key === "uv" ? 0.002 : 0), z);
        zone.scale.set(radiusX, radiusZ, 1);
        scene.add(zone);
      };
      if (zoneIsDocumented("hot")) equipmentZoneSources.heat.forEach((source) => {
        addFloorZone("hot", source.x * widthHalf, source.z * depthHalf, width * 0.17, depth * 0.22, 0xc47a53, source.rotation);
      });
      if (zoneIsDocumented("cool") && equipmentZoneSources.heat.length > 0) {
        const heatX = equipmentZoneSources.heat.reduce((sum, source) => sum + source.x, 0) / equipmentZoneSources.heat.length;
        const heatZ = equipmentZoneSources.heat.reduce((sum, source) => sum + source.z, 0) / equipmentZoneSources.heat.length;
        const coolX = Math.abs(heatX) < 0.18 ? 0.58 : -heatX;
        addFloorZone("cool", coolX * widthHalf, -heatZ * depthHalf, width * 0.2, depth * 0.3, 0x6d9fac);
      }
      if (zoneIsDocumented("uv")) equipmentZoneSources.uv.forEach((source) => {
        addFloorZone("uv", source.x * widthHalf, source.z * depthHalf, width * 0.23, depth * 0.16, 0xc4a64e, source.rotation);
      });
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
    const layoutWarning = activeLayoutWarningRef.current;
    if (viewMode === "3d" && layoutWarning) {
      layoutWarning.bounds.forEach((bounds, index) => {
        const toWorldX = (centimeters: number) => (centimeters / dimensions.width - 0.5) * width;
        const toWorldY = (centimeters: number) => floorY + 0.1 + centimeters / dimensions.height * height;
        const toWorldZ = (centimeters: number) => (centimeters / dimensions.depth - 0.5) * depth;
        const box = new THREE.Box3(
          new THREE.Vector3(toWorldX(bounds.minX), toWorldY(bounds.minY), toWorldZ(bounds.minZ)),
          new THREE.Vector3(toWorldX(bounds.maxX), toWorldY(bounds.maxY), toWorldZ(bounds.maxZ)),
        );
        const color = layoutWarning.type === "boundary" || index === 0 ? 0xc65342 : 0xe0a44c;
        const helper = new THREE.Box3Helper(box, color);
        const material = helper.material as THREE.LineBasicMaterial;
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 0.9;
        helper.renderOrder = 10;
        scene.add(helper);
      });
      const focusObject = decorationObjectsById.get(layoutWarning.decorationIds[0]);
      if (focusObject) {
        const focusPosition = focusObject.getWorldPosition(new THREE.Vector3());
        const cameraOffset = camera.position.clone().sub(controls.target);
        controls.target.copy(focusPosition);
        camera.position.copy(focusPosition).add(cameraOffset);
      }
    }
    const previewSuggestion = previewedLayoutSuggestionRef.current;
    if (viewMode === "3d" && previewSuggestion) {
      const source = decorationObjectsById.get(previewSuggestion.decorationId);
      const decoration = decorations.find((item) => item.id === previewSuggestion.decorationId);
      if (source && decoration) {
        const ghost = source.clone(true);
        ghost.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry = object.geometry.clone();
          const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
          const previewMaterials = originalMaterials.map((original) => {
            const material = original.clone();
            material.transparent = true;
            material.opacity = 0.38;
            material.depthWrite = false;
            if ("color" in material) (material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(0x48a7b6), 0.45);
            return material;
          });
          object.material = Array.isArray(object.material) ? previewMaterials : previewMaterials[0];
          object.renderOrder = 8;
        });
        const profile = getDecorationGeometryProfile(decoration, biotope);
        ghost.position.set(
          previewSuggestion.position.x * widthHalf,
          floorY + 0.1 + profile.rootOffsetY + previewSuggestion.position.y * height,
          previewSuggestion.position.z * depthHalf,
        );
        scene.add(ghost);
        ghost.updateMatrixWorld(true);
        const previewOutline = new THREE.Box3Helper(new THREE.Box3().setFromObject(ghost), 0x3394a4);
        const previewMaterial = previewOutline.material as THREE.LineBasicMaterial;
        previewMaterial.depthTest = false;
        previewMaterial.transparent = true;
        previewMaterial.opacity = 0.95;
        previewOutline.renderOrder = 11;
        scene.add(previewOutline);
      }
    }
    transformControls.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    const saveTransformedDecoration = () => {
      const object = transformControls.object;
      if (!object || object.userData.decorationId == null) return;
      const id = Number(object.userData.decorationId);
      const decoration = decorations.find((item) => item.id === id);
      if (!decoration) return;
      const geometryProfile = getDecorationGeometryProfile(decoration, biotope);
      const position = {
        x: THREE.MathUtils.clamp(object.position.x / widthHalf, -1, 1),
        y: THREE.MathUtils.clamp((object.position.y - floorY - 0.1 - geometryProfile.rootOffsetY) / height, 0, 1),
        z: THREE.MathUtils.clamp(object.position.z / depthHalf, -1, 1),
      };
      const degrees = THREE.MathUtils.radToDeg(object.rotation.y);
      onDecorationsChange((current) => rotateDecoration(
        current.map((item) => item.id === id ? { ...item, position } : item),
        id,
        degrees,
      ));
    };
    transformControls.addEventListener("mouseUp", saveTransformedDecoration);

    let draggedObject: THREE.Object3D | null = null;
    let draggedId: number | null = null;
    let dragMoved = false;
    const dragOffset = new THREE.Vector2();
    const dragStartPointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    let dragStartRotation = 0;
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
        selectionHandlerRef.current(null);
        transformControls.detach();
        return;
      }
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.decorationId == null) object = object.parent;
      if (!object) return;
      const id = Number(object.userData.decorationId);
      selectionHandlerRef.current(id);
      dragMoved = false;
      dragStartPointer.set(event.clientX, event.clientY);
      if (viewMode === "3d") {
        transformControls.attach(object);
        draggedObject = object;
        draggedId = id;
        dragStartRotation = object.rotation.y;
        if (transformMode === "translate") {
          dragPlane.set(new THREE.Vector3(0, 1, 0), -object.position.y);
          const point = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
          if (!point) {
            draggedObject = null;
            draggedId = null;
            return;
          }
          dragOffset.set(object.position.x - point.x, object.position.z - point.z);
        }
        controls.enabled = false;
        renderer.domElement.setPointerCapture(event.pointerId);
        event.preventDefault();
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
      if (!dragMoved && Math.hypot(event.clientX - dragStartPointer.x, event.clientY - dragStartPointer.y) < 3) return;
      dragMoved = true;
      if (viewMode === "3d" && transformMode === "rotate") {
        draggedObject.rotation.y = dragStartRotation + (event.clientX - dragStartPointer.x) * 0.01;
        return;
      }
      updatePointerRay(event);
      const point = raycaster.ray.intersectPlane(viewMode === "3d" ? dragPlane : floorPlane, new THREE.Vector3());
      if (!point) return;
      draggedObject.position.x = THREE.MathUtils.clamp(point.x + dragOffset.x, -widthHalf + 0.18, widthHalf - 0.18);
      draggedObject.position.z = THREE.MathUtils.clamp(point.z + dragOffset.y, -depthHalf + 0.18, depthHalf - 0.18);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!draggedObject || draggedId === null) return;
      const id = draggedId;
      const previousPosition = decorations.find((item) => item.id === id)?.position;
      const position = { ...previousPosition, x: draggedObject.position.x / widthHalf, z: draggedObject.position.z / depthHalf };
      const degrees = THREE.MathUtils.radToDeg(draggedObject.rotation.y);
      const shouldSavePosition = dragMoved;
      draggedObject = null;
      draggedId = null;
      dragMoved = false;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (!shouldSavePosition) return;
      onDecorationsChange((current) => rotateDecoration(
        current.map((item) => item.id === id ? { ...item, position } : item),
        id,
        degrees,
      ));
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
      cameraViewRef.current = {
        viewMode,
        position: [camera.position.x, camera.position.y, camera.position.z],
        up: [camera.up.x, camera.up.y, camera.up.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      };
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
      contactShadowTexture?.dispose();
    };
  }, [shape, dimensions, biotope, decorations, viewMode, transformMode, selectedSpecies, habitatZoneGuidanceKey, showHabitatZones, activeLayoutWarningKey, previewedLayoutSuggestionKey]);

  return <div className="viewport" ref={viewportRef} data-mode={viewMode} />;
}
