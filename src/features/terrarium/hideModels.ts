import * as THREE from "three";
import type { DecorationVariant } from "../../domain/projectLogic";

type HideVariant = Extract<DecorationVariant, "Grotte" | "Tronc creux" | "Écorce creuse">;

function createCaveShell() {
  const silhouette = new THREE.Shape();
  silhouette.moveTo(-0.48, 0);
  silhouette.lineTo(-0.48, 0.4);
  silhouette.quadraticCurveTo(0, 0.98, 0.48, 0.4);
  silhouette.lineTo(0.48, 0);
  silhouette.closePath();

  const entrance = new THREE.Path();
  entrance.moveTo(-0.245, 0);
  entrance.lineTo(-0.245, 0.27);
  entrance.quadraticCurveTo(0, 0.58, 0.245, 0.27);
  entrance.lineTo(0.245, 0);
  entrance.closePath();
  silhouette.holes.push(entrance);

  const cave = new THREE.Mesh(
    new THREE.ExtrudeGeometry(silhouette, { depth: 0.72, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 12 }),
    new THREE.MeshStandardMaterial({ color: 0x887967, roughness: 0.98, flatShading: true }),
  );
  cave.position.z = -0.36;
  return cave;
}

function createTrunkShell() {
  const trunk = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.94, flatShading: true });
  const interior = new THREE.MeshStandardMaterial({ color: 0x352a21, roughness: 1, side: THREE.DoubleSide });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.96, 16, 1, true), bark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.285, 0.96, 16, 1, true), interior);
  outer.rotation.z = Math.PI / 2;
  inner.rotation.z = Math.PI / 2;
  outer.position.y = 0.34;
  inner.position.y = 0.34;
  trunk.add(outer, inner);

  for (const end of [-0.48, 0.48]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 24), bark);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(end, 0.34, 0);
    trunk.add(rim);
  }
  return trunk;
}

function createBarkShelter() {
  const shelter = new THREE.Group();
  const angleStart = Math.PI / 2;
  const angleLength = Math.PI;
  const outerBark = new THREE.MeshStandardMaterial({ color: 0x785a3c, roughness: 0.98, side: THREE.DoubleSide, flatShading: true });
  const innerBark = new THREE.MeshStandardMaterial({ color: 0x443329, roughness: 1, side: THREE.DoubleSide, flatShading: true });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.82, 20, 1, true, angleStart, angleLength), outerBark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.82, 20, 1, true, angleStart, angleLength), innerBark);
  outer.rotation.x = Math.PI / 2;
  inner.rotation.x = Math.PI / 2;
  outer.position.y = 0.34;
  inner.position.y = 0.34;
  shelter.add(outer, inner);
  return shelter;
}

export function createHideModel(variant: HideVariant): THREE.Group {
  const hide = new THREE.Group();
  if (variant === "Grotte") hide.add(createCaveShell());
  else if (variant === "Tronc creux") hide.add(createTrunkShell());
  else hide.add(createBarkShelter());
  return hide;
}