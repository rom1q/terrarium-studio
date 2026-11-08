function lattice(x: number, y: number, z: number) {
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

export function noise3(x: number, y: number, z: number) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const cellZ = Math.floor(z);
  const fx = x - cellX;
  const fy = y - cellY;
  const fz = z - cellZ;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const lerpX = (dy: number, dz: number) => lattice(cellX, cellY + dy, cellZ + dz) * (1 - sx) + lattice(cellX + 1, cellY + dy, cellZ + dz) * sx;
  const lerpY = (dz: number) => lerpX(0, dz) * (1 - sy) + lerpX(1, dz) * sy;
  return lerpY(0) * (1 - sz) + lerpY(1) * sz;
}

export function fbm(x: number, y: number, z: number) {
  return noise3(x, y, z) * 0.6 + noise3(x * 2.3, y * 2.3, z * 2.3) * 0.3 + noise3(x * 5.1, y * 5.1, z * 5.1) * 0.1;
}
