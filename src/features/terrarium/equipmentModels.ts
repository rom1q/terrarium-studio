import * as THREE from "three";
import { otherDecorationGeometryProfiles } from "../../domain/decorationGeometry";

type DecorVariant = string | undefined;

function createRoundedSlabGeometry(width: number, depth: number, height: number, radius: number) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, -halfDepth);
  shape.lineTo(halfWidth - radius, -halfDepth);
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius);
  shape.lineTo(halfWidth, halfDepth - radius);
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);
  shape.lineTo(-halfWidth + radius, halfDepth);
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius);
  shape.lineTo(-halfWidth, -halfDepth + radius);
  shape.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + radius, -halfDepth);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 8 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createPlatformModel(variant: DecorVariant, woodGrain: THREE.Texture, surfaceNoise: THREE.Texture): THREE.Group {
  const profile = otherDecorationGeometryProfiles.platform;
  const platform = new THREE.Group();
  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x4f3c2a, roughness: 0.95, bumpMap: woodGrain, bumpScale: 0.04 });

  if (variant === "Plateau en liège") {
    const cork = new THREE.MeshStandardMaterial({ color: 0xa58260, roughness: 1, bumpMap: surfaceNoise, bumpScale: 0.09 });
    const slab = new THREE.Mesh(createRoundedSlabGeometry(profile.slab.width, profile.slab.depth, profile.slab.height, 0.12), cork);
    slab.position.y = profile.slab.y - profile.slab.height / 2;
    platform.add(slab);
  } else {
    const plankCount = 5;
    const gap = 0.012;
    const plankDepth = profile.slab.depth / plankCount - gap;
    for (let index = 0; index < plankCount; index += 1) {
      const tint = 0.82 + ((index * 37) % 11) / 11 * 0.3;
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x806344).multiplyScalar(tint), roughness: 0.92, bumpMap: woodGrain, bumpScale: 0.05 });
      const plank = new THREE.Mesh(new THREE.BoxGeometry(profile.slab.width, profile.slab.height, plankDepth), material);
      plank.position.set(0, profile.slab.y, -profile.slab.depth / 2 + (index + 0.5) * (profile.slab.depth / plankCount));
      platform.add(plank);
    }
  }

  for (const supportX of profile.support.x) {
    for (const supportZ of profile.support.z) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(profile.support.width, profile.support.height, profile.support.depth), supportMaterial);
      support.position.set(supportX, profile.support.y, supportZ);
      platform.add(support);
    }
  }
  return platform;
}

function createGlow(texture: THREE.Texture, color: number, opacity: number, width: number, height: number) {
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(width, height, 1);
  return glow;
}

export function createHeatLampModel(frameMaterial: THREE.Material, glowTexture: THREE.Texture): THREE.Group {
  const profile = otherDecorationGeometryProfiles.heater;
  const lamp = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x555d57, metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(profile.shade.topRadius, profile.shade.bottomRadius, profile.shade.height, 24, 1, true), metal);
  shade.position.y = profile.shade.y;
  lamp.add(shade);

  const shadeBottom = profile.shade.y - profile.shade.height / 2;
  for (const amount of [0.2, 0.5, 0.8]) {
    const radius = THREE.MathUtils.lerp(profile.shade.bottomRadius, profile.shade.topRadius, amount);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 6, 28), metal);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = shadeBottom + profile.shade.height * amount;
    lamp.add(rib);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(profile.shade.topRadius * 0.55, profile.shade.topRadius, 0.05, 16), metal);
  cap.position.y = profile.shade.y + profile.shade.height / 2 + 0.02;
  lamp.add(cap);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(profile.bulb.radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf3b66a, emissive: 0xff8f3a, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  bulb.position.y = profile.bulb.y;
  lamp.add(bulb);
  const halo = createGlow(glowTexture, 0xffa24d, 0.55, 0.52, 0.52);
  halo.position.y = profile.bulb.y;
  lamp.add(halo);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(profile.cable.radius, profile.cable.radius, profile.cable.height, 8), frameMaterial);
  cable.position.y = profile.cable.y;
  lamp.add(cable);
  return lamp;
}

export function createUvbModel(frameMaterial: THREE.Material, glowTexture: THREE.Texture): THREE.Group {
  const profile = otherDecorationGeometryProfiles.uvb;
  const tube = new THREE.Group();
  const lightTube = new THREE.Mesh(
    new THREE.CylinderGeometry(profile.tube.radius, profile.tube.radius, profile.tube.length, 14),
    new THREE.MeshStandardMaterial({ color: 0xe6efdc, emissive: 0x8fb4c2, emissiveIntensity: 0.6, roughness: 0.25 }),
  );
  lightTube.rotation.z = Math.PI / 2;
  lightTube.position.y = profile.tube.y;
  tube.add(lightTube);

  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x4a524c, roughness: 0.5, metalness: 0.3 });
  for (const direction of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(profile.tube.radius * 1.15, profile.tube.radius * 1.15, 0.03, 14), capMaterial);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(direction * (profile.tube.length / 2 + 0.01), profile.tube.y, 0);
    tube.add(cap);
  }

  const mount = new THREE.Mesh(new THREE.BoxGeometry(profile.mount.width, profile.mount.height, profile.mount.depth), frameMaterial);
  mount.position.y = profile.mount.y;
  tube.add(mount);
  const glow = createGlow(glowTexture, 0x9fd0e6, 0.35, profile.tube.length * 1.1, 0.2);
  glow.position.y = profile.tube.y;
  tube.add(glow);
  return tube;
}
