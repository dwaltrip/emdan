// Preview the terrain generator in the terminal.
// Run from blob-wars/: `pnpm dlx tsx tmp-scripts/render-terrain.ts [width] [height] [count]`
// Defaults: 80 x 80, 1 board.

import { GRID_HEIGHT, GRID_WIDTH } from "../shared/protocol.ts";
import { generateTerrain } from "../server/src/wss/terrain.ts";

const WALL = "█ ";
const BLANK = "· ";

function renderBoard(width: number, height: number): void {
  const grid = generateTerrain(width, height);
  let wallCount = 0;

  for (const row of grid) {
    let line = "";
    for (const cell of row) {
      if (cell === "wall") {
        line += WALL;
        wallCount += 1;
      } else {
        line += BLANK;
      }
    }
    console.log(line);
  }

  const total = width * height;
  const pct = ((wallCount / total) * 100).toFixed(1);
  console.log(`\n${width}x${height} — walls: ${wallCount}/${total} (${pct}%)\n`);
}

function main(): void {
  const [widthArg, heightArg, countArg] = process.argv.slice(2);
  const width = widthArg ? Number.parseInt(widthArg, 10) : GRID_WIDTH;
  const height = heightArg ? Number.parseInt(heightArg, 10) : GRID_HEIGHT;
  const count = countArg ? Number.parseInt(countArg, 10) : 1;

  for (let i = 0; i < count; i += 1) {
    if (count > 1) console.log(`--- board ${i + 1} ---`);
    renderBoard(width, height);
  }
}

main();
