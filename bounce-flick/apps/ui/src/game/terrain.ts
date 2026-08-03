import * as Matter from 'matter-js';

import { WALL_THICKNESS } from './constants';
import { distance } from '@shared/math';
import type { GeneratedLevel, LevelPiece, Point, TerrainPiece } from './types';

export function createTerrain(engine: Matter.Engine, level: GeneratedLevel) {
  const terrain = level.pieces.map((spec): TerrainPiece => {
    const bodies = createBodies(spec);
    Matter.Composite.add(engine.world, bodies);
    return { bodies, bounds: combineBodyBounds(bodies), spec };
  });
  const { angle = 0, height, width, x, y } = level.goal;
  const goal = Matter.Bodies.rectangle(x, y, width, height, {
    angle,
    isSensor: true,
    isStatic: true,
    label: 'goal',
  });
  Matter.Composite.add(engine.world, goal);

  return { goal, terrain };
}

function createBodies(spec: LevelPiece): Matter.Body[] {
  if (spec.type === 'wall') {
    return createWallBodies(spec.points);
  }

  const { angle = 0, height, width, x, y } = spec.rect;
  if (spec.type === 'hazard') {
    return [
      Matter.Bodies.rectangle(x, y, width, height, {
        angle,
        isSensor: true,
        isStatic: true,
        label: 'hazard',
      }),
    ];
  }

  return [
    Matter.Bodies.rectangle(x, y, width, height, {
      angle,
      chamfer: { radius: 12 },
      friction: 0.92,
      isStatic: true,
      label: 'platform',
      restitution: 0.03,
    }),
  ];
}

function createWallBodies(points: Point[]): Matter.Body[] {
  const bodies: Matter.Body[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = distance(from, to);
    if (length < 1) {
      continue;
    }

    bodies.push(
      Matter.Bodies.rectangle((from.x + to.x) / 2, (from.y + to.y) / 2, length, WALL_THICKNESS, {
        angle: Math.atan2(to.y - from.y, to.x - from.x),
        friction: 0.92,
        isStatic: true,
        label: 'wall',
        restitution: 0.03,
      }),
    );
  }

  return bodies;
}

function combineBodyBounds(bodies: Matter.Body[]): Matter.Bounds {
  const firstBody = bodies[0];
  if (!firstBody) {
    return { max: { x: 0, y: 0 }, min: { x: 0, y: 0 } };
  }

  const bounds = {
    max: { x: firstBody.bounds.max.x, y: firstBody.bounds.max.y },
    min: { x: firstBody.bounds.min.x, y: firstBody.bounds.min.y },
  };
  bodies.slice(1).forEach((body) => {
    bounds.min.x = Math.min(bounds.min.x, body.bounds.min.x);
    bounds.min.y = Math.min(bounds.min.y, body.bounds.min.y);
    bounds.max.x = Math.max(bounds.max.x, body.bounds.max.x);
    bounds.max.y = Math.max(bounds.max.y, body.bounds.max.y);
  });

  return bounds;
}
