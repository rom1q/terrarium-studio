import * as THREE from "three";
import { hideGeometryProfiles } from "../../domain/decorationGeometry";
import type { DecorationVariant } from "../../domain/projectLogic";

type HideVariant = Extract<DecorationVariant, "Grotte" | "Tronc creux" | "Écorce creuse">;

function createCaveShell(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.cave;
  const silhouette = new THREE.Shape();
  silhouette.moveTo(-profile.outline.halfWidth, 0);
  silhouette.lineTo(-profile.outline.halfWidth, profile.outline.shoulderY);
  silhouette.quadraticCurveTo(0, profile.outline.topY, profile.outline.halfWidth, profile.outline.shoulderY);
  silhouette.lineTo(profile.outline.halfWidth, 0);
  silhouette.closePath();

  const entrance = new THREE.Path();
  entrance.moveTo(-profile.entrance.halfWidth, 0);
  entrance.lineTo(-profile.entrance.halfWidth, profile.entrance.shoulderY);
  entrance.quadraticCurveTo(0, profile.entrance.topY, profile.entrance.halfWidth, profile.entrance.shoulderY);
  entrance.lineTo(profile.entrance.halfWidth, 0);
  entrance.closePath();
  silhouette.holes.push(entrance);

  const cave = new THREE.Mesh(
    new THREE.ExtrudeGeometry(silhouette, { depth: profile.depth, bevelEnabled: true, bevelSegments: 2, bevelSize: profile.bevel, bevelThickness: profile.bevel, curveSegments: profile.curveSegments }),
    new THREE.MeshStandardMaterial({ color: 0x887967, roughness: 0.98, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.055 } : {}) }),
  );
  cave.position.z = profile.position.z;
  cave.position.y = profile.position.y;
  return cave;
}

function createTrunkShell(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.trunk;
  const trunk = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.94, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.06 } : {}) });
  const interior = new THREE.MeshStandardMaterial({ color: 0x352a21, roughness: 1, side: THREE.DoubleSide });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(profile.outerRadii.top, profile.outerRadii.bottom, profile.length, profile.segments, 1, true), bark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(profile.innerRadii.top, profile.innerRadii.bottom, profile.length, profile.segments, 1, true), interior);
  outer.rotation.z = Math.PI / 2;
  inner.rotation.z = Math.PI / 2;
  outer.position.y = profile.centerY;
  inner.position.y = profile.centerY;
  trunk.add(outer, inner);

  for (const end of [-profile.length / 2, profile.length / 2]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(profile.rim.radius, profile.rim.tube, profile.rim.radialSegments, profile.rim.tubularSegments), bark);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(end, profile.centerY, 0);
    trunk.add(rim);
  }
  return trunk;
}

function createBarkShelter(surfaceNoise?: THREE.Texture) {
  const profile = hideGeometryProfiles.bark;
  const shelter = new THREE.Group();
  const outerBark = new THREE.MeshStandardMaterial({ color: 0x785a3c, roughness: 0.98, side: THREE.DoubleSide, flatShading: true, ...(surfaceNoise ? { bumpMap: surfaceNoise, bumpScale: 0.06 } : {}) });
  const innerBark = new THREE.MeshStandardMaterial({ color: 0x443329, roughness: 1, side: THREE.DoubleSide, flatShading: true });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(profile.outerRadius, profile.outerRadius, profile.length, profile.segments, 1, true, profile.thetaStart, profile.thetaLength), outerBark);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(profile.innerRadius, profile.innerRadius, profile.length, profile.segments, 1, true, profile.thetaStart, profile.thetaLength), innerBark);
  outer.rotation.x = Math.PI / 2;
  inner.rotation.x = Math.PI / 2;
  outer.position.y = profile.centerY;
  inner.position.y = profile.centerY;
  shelter.add(outer, inner);
  return shelter;
}

export function createHideModel(variant: HideVariant, surfaceNoise?: THREE.Texture): THREE.Group {
  const hide = new THREE.Group();
  if (variant === "Grotte") hide.add(createCaveShell(surfaceNoise));
  else if (variant === "Tronc creux") hide.add(createTrunkShell(surfaceNoise));
  else hide.add(createBarkShelter(surfaceNoise));
  return hide;
}