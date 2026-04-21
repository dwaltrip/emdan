import type { TileTerrain } from "../../../shared/protocol.ts";

const INITIAL_WALL_CHANCE = 0.42;
const CA_PASSES = 4;
const CA_WALL_THRESHOLD = 5;
const SPAWN_CLEAR_RADIUS = 2;

type TerrainGrid = TileTerrain[][];

export function generateTerrain(width: number, height: number): TerrainGrid {
  const halfWidth = Math.ceil(width / 2);
  let half = randomFill(halfWidth, height);

  for (let i = 0; i < CA_PASSES; i += 1) {
    half = caStep(half, halfWidth, height);
  }

  const grid = mirrorHorizontally(half, width, height);
  clearSpawnCorners(grid, width, height);
  removeIsolatedPockets(grid, width, height);

  return grid;
}

function randomFill(width: number, height: number): TerrainGrid {
  const grid: TerrainGrid = [];
  for (let y = 0; y < height; y += 1) {
    const row: TileTerrain[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push(Math.random() < INITIAL_WALL_CHANCE ? "wall" : "blank");
    }
    grid.push(row);
  }
  return grid;
}

function caStep(grid: TerrainGrid, width: number, height: number): TerrainGrid {
  const next: TerrainGrid = [];
  for (let y = 0; y < height; y += 1) {
    const row: TileTerrain[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push(countWallNeighbors(grid, x, y, width, height) >= CA_WALL_THRESHOLD ? "wall" : "blank");
    }
    next.push(row);
  }
  return next;
}

function countWallNeighbors(grid: TerrainGrid, x: number, y: number, width: number, height: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        count += 1;
        continue;
      }
      if (grid[ny]![nx] === "wall") count += 1;
    }
  }
  return count;
}

function mirrorHorizontally(half: TerrainGrid, width: number, height: number): TerrainGrid {
  const grid: TerrainGrid = [];
  for (let y = 0; y < height; y += 1) {
    const row: TileTerrain[] = [];
    for (let x = 0; x < width; x += 1) {
      const sourceX = x < half[y]!.length ? x : width - 1 - x;
      row.push(half[y]![sourceX]!);
    }
    grid.push(row);
  }
  return grid;
}

function clearSpawnCorners(grid: TerrainGrid, width: number, height: number): void {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = -SPAWN_CLEAR_RADIUS; dy <= SPAWN_CLEAR_RADIUS; dy += 1) {
      for (let dx = -SPAWN_CLEAR_RADIUS; dx <= SPAWN_CLEAR_RADIUS; dx += 1) {
        const x = cx! + dx;
        const y = cy! + dy;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        grid[y]![x] = "blank";
      }
    }
  }
}

function removeIsolatedPockets(grid: TerrainGrid, width: number, height: number): void {
  const visited: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
  let start: [number, number] | null = null;
  for (let y = 0; y < height && !start; y += 1) {
    for (let x = 0; x < width && !start; x += 1) {
      if (grid[y]![x] === "blank") start = [x, y];
    }
  }
  if (!start) return;

  const queue: Array<[number, number]> = [start];
  visited[start[1]]![start[0]] = true;
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx!;
      const ny = y + dy!;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (visited[ny]![nx]) continue;
      if (grid[ny]![nx] !== "blank") continue;
      visited[ny]![nx] = true;
      queue.push([nx, ny]);
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y]![x] === "blank" && !visited[y]![x]) {
        grid[y]![x] = "wall";
      }
    }
  }
}
