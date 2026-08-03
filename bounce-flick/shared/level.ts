// Plain, serializable game concepts. The server generates these values and the
// client decides how to turn them into Matter bodies and canvas visuals.

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  angle?: number;
  height: number;
  width: number;
  x: number;
  y: number;
};

export type WallSpec = {
  points: Point[];
  type: 'wall';
};

export type PlatformRole = 'start' | 'scattered' | 'finish';

export type PlatformSpec = {
  rect: Rect;
  role: PlatformRole;
  skin: number;
  type: 'platform';
};

export type HazardSpec = {
  rect: Rect;
  type: 'hazard';
};

export type LevelPiece = WallSpec | PlatformSpec | HazardSpec;

export type GeneratedLevel = {
  goal: Rect;
  pieces: LevelPiece[];
  spawn: Point;
};
