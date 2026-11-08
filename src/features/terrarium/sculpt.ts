import * as THREE from "three";

// Moves each vertex along its normal and bakes a per-vertex colour; offsets stay inward so shared bounds hold.
// The callback may overwrite `normal` to choose the displacement direction, e.g. when duplicated vertices must move together.
export function sculpt(geometry: THREE.BufferGeometry, shape: (position: THREE.Vector3, normal: THREE.Vector3, color: THREE.Color) => number) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(positions.count * 3);
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    position.fromBufferAttribute(positions, index);
    normal.fromBufferAttribute(normals, index);
    const offset = shape(position, normal, color);
    positions.setXYZ(index, position.x + normal.x * offset, position.y + normal.y * offset, position.z + normal.z * offset);
    colors.set([color.r, color.g, color.b], index * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
}
