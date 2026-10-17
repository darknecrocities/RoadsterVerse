export interface HalfLoopSample {
  arcLength: number;
  surfaceX: number;
  surfaceY: number;
  carCenterX: number;
  carCenterY: number;
  tangentAngle: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  curvature: number;
  isOnLoop: boolean;
  isPastLip: boolean;
}

export interface KickflipRampSample {
  surfaceX: number;
  surfaceY: number;
  carCenterY: number;
  tangentAngle: number;
  isOnRamp: boolean;
}

export const HALF_LOOP_RUNWAY_START_X = -9.5;
export const HALF_LOOP_ENTRY_X = 1.0;
export const HALF_LOOP_RUNWAY_LENGTH = HALF_LOOP_ENTRY_X - HALF_LOOP_ENTRY_X + 10.5; // 10.5m
export const HALF_LOOP_RADIUS = 6.8;
export const HALF_LOOP_MAX_ANGLE = 2.48; // ~142 deg overhanging inverted ramp (Image 1)
export const HALF_LOOP_ARC_LENGTH = HALF_LOOP_RADIUS * HALF_LOOP_MAX_ANGLE; // ~16.86m
export const HALF_LOOP_OVERHANG_LIP_LENGTH = 3.6;
export const HALF_LOOP_TOTAL_LENGTH =
  HALF_LOOP_RUNWAY_LENGTH + HALF_LOOP_ARC_LENGTH + HALF_LOOP_OVERHANG_LIP_LENGTH;
export const CAR_RIDE_HEIGHT = 0.39;

/**
 * Exact parametric geometry for the Giant C-Shaped Overhanging Half-Loop Ramp (Image 1 & Image 3).
 * Shared by both the 60 Hz physics integrator and the Three.js mesh builder so the car NEVER clips through the ramp.
 */
export function sampleHotWheelsHalfLoop(s: number): HalfLoopSample {
  const clampedS = Math.max(0, s);

  if (clampedS <= HALF_LOOP_RUNWAY_LENGTH) {
    const surfaceX = HALF_LOOP_RUNWAY_START_X + clampedS;
    const surfaceY = 0.04;
    return {
      arcLength: clampedS,
      surfaceX,
      surfaceY,
      carCenterX: surfaceX,
      carCenterY: surfaceY + CAR_RIDE_HEIGHT,
      tangentAngle: 0,
      tangentX: 1,
      tangentY: 0,
      normalX: 0,
      normalY: 1,
      curvature: 0,
      isOnLoop: false,
      isPastLip: false,
    };
  }

  const loopS = clampedS - HALF_LOOP_RUNWAY_LENGTH;
  if (loopS <= HALF_LOOP_ARC_LENGTH) {
    const theta = loopS / HALF_LOOP_RADIUS;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const surfaceX = HALF_LOOP_ENTRY_X + HALF_LOOP_RADIUS * sinT;
    const surfaceY = 0.04 + HALF_LOOP_RADIUS * (1 - cosT);
    const normalX = -sinT;
    const normalY = cosT;

    return {
      arcLength: clampedS,
      surfaceX,
      surfaceY,
      carCenterX: surfaceX + normalX * CAR_RIDE_HEIGHT,
      carCenterY: surfaceY + normalY * CAR_RIDE_HEIGHT,
      tangentAngle: theta,
      tangentX: cosT,
      tangentY: sinT,
      normalX,
      normalY,
      curvature: 1 / HALF_LOOP_RADIUS,
      isOnLoop: true,
      isPastLip: false,
    };
  }

  // Overhanging straight exit deck at angle HALF_LOOP_MAX_ANGLE (142 deg)
  const lipDist = Math.min(
    HALF_LOOP_OVERHANG_LIP_LENGTH,
    loopS - HALF_LOOP_ARC_LENGTH
  );
  const theta = HALF_LOOP_MAX_ANGLE;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const arcEndX = HALF_LOOP_ENTRY_X + HALF_LOOP_RADIUS * sinT;
  const arcEndY = 0.04 + HALF_LOOP_RADIUS * (1 - cosT);

  const surfaceX = arcEndX + lipDist * cosT;
  const surfaceY = arcEndY + lipDist * sinT;
  const normalX = -sinT;
  const normalY = cosT;

  return {
    arcLength: clampedS,
    surfaceX,
    surfaceY,
    carCenterX: surfaceX + normalX * CAR_RIDE_HEIGHT,
    carCenterY: surfaceY + normalY * CAR_RIDE_HEIGHT,
    tangentAngle: theta,
    tangentX: cosT,
    tangentY: sinT,
    normalX,
    normalY,
    curvature: 0,
    isOnLoop: true,
    isPastLip: clampedS >= HALF_LOOP_TOTAL_LENGTH,
  };
}

export const KICKFLIP_RAMP_START_X = -5.6;
export const KICKFLIP_RAMP_END_X = -1.4;
export const KICKFLIP_RAMP_HEIGHT = 1.75;

/**
 * Exact parametric geometry for the Curved Steel Quarter-Pipe Launch Ramp (Image 2).
 */
export function sampleCurvedKickflipRamp(x: number): KickflipRampSample {
  if (x < KICKFLIP_RAMP_START_X || x > KICKFLIP_RAMP_END_X) {
    return {
      surfaceX: x,
      surfaceY: 0.04,
      carCenterY: 0.04 + CAR_RIDE_HEIGHT,
      tangentAngle: 0,
      isOnRamp: false,
    };
  }

  const span = KICKFLIP_RAMP_END_X - KICKFLIP_RAMP_START_X;
  const u = (x - KICKFLIP_RAMP_START_X) / span;
  const surfaceY = 0.04 + KICKFLIP_RAMP_HEIGHT * (u * u);
  const dyDx = (2 * KICKFLIP_RAMP_HEIGHT * u) / span;
  const tangentAngle = Math.atan(dyDx);
  const normalY = Math.cos(tangentAngle);

  return {
    surfaceX: x,
    surfaceY,
    carCenterY: surfaceY + CAR_RIDE_HEIGHT * normalY,
    tangentAngle,
    isOnRamp: true,
  };
}
