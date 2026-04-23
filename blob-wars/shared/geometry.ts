export interface Bounds {
  width: number;
  height: number;
}

export function* manhattanNeighborhood(
  cx: number,
  cy: number,
  radius: number,
  bounds: Bounds,
): Generator<[number, number]> {
  for (let dy = -radius; dy <= radius; dy++) {
    const ny = cy + dy;
    if (ny < 0 || ny >= bounds.height) continue;
    const remaining = radius - Math.abs(dy);
    for (let dx = -remaining; dx <= remaining; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= bounds.width) continue;
      yield [nx, ny];
    }
  }
}
