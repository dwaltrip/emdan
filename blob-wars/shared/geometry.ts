export interface Bounds {
  width: number;
  height: number;
}

export function* circularNeighborhood(
  cx: number,
  cy: number,
  radius: number,
  bounds: Bounds,
): Generator<[number, number]> {
  const radiusSq = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const ny = cy + dy;
    if (ny < 0 || ny >= bounds.height) continue;
    const maxDx = Math.floor(Math.sqrt(radiusSq - dy * dy));
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= bounds.width) continue;
      yield [nx, ny];
    }
  }
}
