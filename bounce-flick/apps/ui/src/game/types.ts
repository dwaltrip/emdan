import type * as Matter from 'matter-js';

import type { LevelPiece, Point } from '@shared/level';

export type {
  GeneratedLevel,
  HazardSpec,
  LevelPiece,
  PlatformRole,
  PlatformSpec,
  Point,
  Rect,
  WallSpec,
} from '@shared/level';

export type Phase = 'running' | 'cleared' | 'crashed';

export type HudSnapshot = {
  ink: number;
  maxInk: number;
  phase: Phase;
  progress: number;
  speed: number;
};

export type InkSegment = {
  body: Matter.Body;
  from: Point;
  to: Point;
};

export type TerrainPiece = {
  bodies: Matter.Body[];
  bounds: Matter.Bounds;
  spec: LevelPiece;
};

export type Runtime = {
  ball: Matter.Body;
  engine: Matter.Engine;
  goal: Matter.Body;
  goalX: number;
  ink: number;
  inkSegments: InkSegment[];
  phase: Phase;
  startX: number;
  terrain: TerrainPiece[];
};

export type ViewState = {
  cameraFrozen: boolean;
  cameraX: number;
  cameraY: number;
  viewportHeight: number;
  viewportWidth: number;
};
