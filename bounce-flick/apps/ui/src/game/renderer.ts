import type * as Matter from 'matter-js';
import { BALL_RADIUS, INK_THICKNESS, WALL_THICKNESS } from './constants';
import type { InkSegment, Point, Runtime, ViewState } from './types';

const PLATFORM_STROKE = '#142f36';
const PLATFORM_FILLS = [
  '#2c6470',
  '#245761',
  '#31675a',
  '#2f5f68',
  '#2f6b61',
  '#275965',
  '#35655c',
];
const WALL_FILL = '#244f58';
const WALL_STROKE = '#142f36';
const HAZARD_FILL = '#e14d42';
const HAZARD_STROKE = '#7f201b';

export function renderScene(
  context: CanvasRenderingContext2D,
  runtime: Runtime,
  view: ViewState,
  ghostBalls: readonly Point[] = [],
) {
  context.clearRect(0, 0, view.viewportWidth, view.viewportHeight);

  context.save();
  context.translate(-view.cameraX, -view.cameraY);

  const viewLeft = view.cameraX - 160;
  const viewRight = view.cameraX + view.viewportWidth + 160;

  runtime.terrain.forEach((piece) => {
    if (piece.bounds.max.x < viewLeft || piece.bounds.min.x > viewRight) {
      return;
    }

    const { spec } = piece;
    if (spec.type === 'wall') {
      drawWall(context, spec.points);
      return;
    }

    if (spec.type === 'hazard') {
      piece.bodies.forEach((body) => drawHazard(context, body));
      return;
    }

    piece.bodies.forEach((body) => {
      drawBody(context, body, platformFill(spec.skin), PLATFORM_STROKE);
    });
  });

  drawFinishGate(context, runtime.goal);

  runtime.inkSegments.forEach((segment) => {
    const minX = Math.min(segment.from.x, segment.to.x);
    const maxX = Math.max(segment.from.x, segment.to.x);
    if (maxX >= viewLeft && minX <= viewRight) {
      drawInkSegment(context, segment);
    }
  });

  drawBall(context, runtime.ball);

  ghostBalls.forEach((ghostBall) => {
    drawGhostBall(context, ghostBall.x, ghostBall.y);
  });

  context.restore();

  if (runtime.phase !== 'running') {
    context.fillStyle = 'rgba(247, 248, 251, 0.28)';
    context.fillRect(0, 0, view.viewportWidth, view.viewportHeight);
  }
}

function platformFill(skin: number) {
  return PLATFORM_FILLS[Math.abs(Math.trunc(skin)) % PLATFORM_FILLS.length]!;
}

function drawBody(
  context: CanvasRenderingContext2D,
  body: Matter.Body,
  fill: string,
  stroke: string,
) {
  bodyPath(context, body);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = stroke;
  context.stroke();
}

function bodyPath(context: CanvasRenderingContext2D, body: Matter.Body) {
  context.beginPath();
  body.vertices.forEach((vertex, index) => {
    if (index === 0) {
      context.moveTo(vertex.x, vertex.y);
      return;
    }

    context.lineTo(vertex.x, vertex.y);
  });
  context.closePath();
}

function drawWall(context: CanvasRenderingContext2D, points: Point[]) {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }

    context.lineTo(point.x, point.y);
  });

  context.lineWidth = WALL_THICKNESS + 4;
  context.strokeStyle = WALL_STROKE;
  context.stroke();

  context.lineWidth = WALL_THICKNESS;
  context.strokeStyle = WALL_FILL;
  context.stroke();
  context.restore();
}

function drawHazard(context: CanvasRenderingContext2D, body: Matter.Body) {
  drawBody(context, body, HAZARD_FILL, HAZARD_STROKE);

  const { min, max } = body.bounds;
  const height = max.y - min.y;

  context.save();
  bodyPath(context, body);
  context.clip();
  context.lineWidth = 6;
  context.strokeStyle = 'rgba(255, 238, 190, 0.7)';
  for (let x = min.x - height; x < max.x; x += 20) {
    context.beginPath();
    context.moveTo(x, min.y);
    context.lineTo(x + height, max.y);
    context.stroke();
  }
  context.restore();

  bodyPath(context, body);
  context.lineWidth = 3;
  context.strokeStyle = HAZARD_STROKE;
  context.stroke();
}

function drawFinishGate(context: CanvasRenderingContext2D, body: Matter.Body) {
  const { min, max } = body.bounds;
  const poleX = (min.x + max.x) / 2;
  const top = min.y - 18;
  const bottom = max.y + 46;
  const flagHeight = 62;
  const flagWidth = 96;

  context.save();
  context.lineCap = 'round';
  context.lineWidth = 10;
  context.strokeStyle = '#27393d';
  context.beginPath();
  context.moveTo(poleX, top);
  context.lineTo(poleX, bottom);
  context.stroke();

  context.fillStyle = '#f7f8fb';
  context.strokeStyle = '#27393d';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(poleX, top + 8, flagWidth, flagHeight, 8);
  context.fill();
  context.stroke();

  const tile = flagHeight / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      if ((row + column) % 2 === 0) {
        context.fillStyle = '#27393d';
        context.fillRect(poleX + column * tile, top + 8 + row * tile, tile, tile);
      }
    }
  }
  context.restore();
}

function drawInkSegment(context: CanvasRenderingContext2D, segment: InkSegment) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = INK_THICKNESS;
  context.strokeStyle = '#167f90';
  context.shadowBlur = 10;
  context.shadowColor = 'rgba(22, 127, 144, 0.22)';
  context.beginPath();
  context.moveTo(segment.from.x, segment.from.y);
  context.lineTo(segment.to.x, segment.to.y);
  context.stroke();

  context.shadowBlur = 0;
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(229, 255, 252, 0.78)';
  context.stroke();
  context.restore();
}

function drawBall(context: CanvasRenderingContext2D, ball: Matter.Body) {
  context.save();
  context.translate(ball.position.x, ball.position.y);
  context.rotate(ball.angle);

  context.shadowBlur = 18;
  context.shadowColor = 'rgba(39, 57, 61, 0.25)';
  const gradient = context.createRadialGradient(-7, -9, 2, 0, 0, BALL_RADIUS);
  gradient.addColorStop(0, '#fff6c7');
  gradient.addColorStop(0.42, '#f6b949');
  gradient.addColorStop(1, '#dc563d');

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.lineWidth = 3;
  context.strokeStyle = '#7f2d24';
  context.stroke();

  context.lineWidth = 4;
  context.strokeStyle = 'rgba(127, 45, 36, 0.58)';
  context.beginPath();
  context.arc(0, 0, BALL_RADIUS * 0.58, -1.2, 1.2);
  context.stroke();
  context.beginPath();
  context.moveTo(-BALL_RADIUS * 0.8, -3);
  context.lineTo(BALL_RADIUS * 0.8, 3);
  context.stroke();
  context.restore();
}

function drawGhostBall(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.globalAlpha = 0.4;
  context.translate(x, y);
  context.beginPath();
  context.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  context.fillStyle = '#9fb4bb';
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(31, 44, 47, 0.55)';
  context.stroke();
  context.restore();
}
