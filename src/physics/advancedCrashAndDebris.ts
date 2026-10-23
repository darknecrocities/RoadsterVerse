import type {
  CrashType,
  DebrisPiece,
  EulerAngles,
  SubsystemHealthState,
  Vector3D,
  VehicleId,
} from '../types/simulation.ts';

export interface CrashForensicReport {
  isCatastrophic: boolean;
  impactKineticEnergyJoules: number;
  diagnosticSequence: string[];
  spawnedDebris: DebrisPiece[];
  updatedHealth: SubsystemHealthState;
}

/**
 * Computes structural impact kinetic energy in Joules:
 * E_k = 0.5 * m * v^2 + 0.5 * I * omega^2
 */
export function computeImpactKineticEnergy(
  massKg: number,
  velocity: Vector3D,
  angularVelocity: Vector3D,
  vehicle: VehicleId
): number {
  const vSq = velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z;
  const transJoules = 0.5 * massKg * vSq;

  // Approximate moments of inertia (I_xx, I_yy, I_zz):
  const iX = vehicle === 'roadster' ? 750 : 250000;
  const iY = vehicle === 'roadster' ? 2200 : 850000;
  const iZ = vehicle === 'roadster' ? 2400 : 850000;

  const rotJoules =
    0.5 * (iX * angularVelocity.x * angularVelocity.x +
      iY * angularVelocity.y * angularVelocity.y +
      iZ * angularVelocity.z * angularVelocity.z);

  return transJoules + rotJoules;
}

/**
 * Spawns physically parameterized 6-DoF multi-body debris pieces for either vehicle.
 */
export function generateVehicleDebrisPieces(
  vehicle: VehicleId,
  position: Vector3D,
  velocity: Vector3D,
  attitude: EulerAngles,
  impactEnergyJoules: number
): DebrisPiece[] {
  const pieces: DebrisPiece[] = [];
  const blastSpeed = Math.min(24.0, 4.5 + Math.sqrt(impactEnergyJoules / (vehicle === 'roadster' ? 1850 : 120000)) * 0.85);

  if (vehicle === 'roadster') {
    // 1. 4 Detached Alloy Wheels with Michelin Slicks (restitution = 0.65, rubber bounce)
    const wheelOffsets = [
      { id: 'wheel-fl', x: 1.3, y: 0.35, z: 0.85 },
      { id: 'wheel-fr', x: 1.3, y: 0.35, z: -0.85 },
      { id: 'wheel-rl', x: -1.3, y: 0.35, z: 0.85 },
      { id: 'wheel-rr', x: -1.3, y: 0.35, z: -0.85 },
    ];
    for (const w of wheelOffsets) {
      const az = Math.atan2(w.z, w.x) + (Math.random() - 0.5) * 0.4;
      const spd = blastSpeed * (0.85 + Math.random() * 0.4);
      pieces.push({
        id: w.id,
        material: 'wheel-rubber',
        position: { x: position.x + w.x, y: Math.max(0.2, position.y + w.y), z: position.z + w.z },
        velocity: {
          x: velocity.x * 0.4 + Math.cos(az) * spd,
          y: Math.abs(velocity.y) * 0.5 + 4.2 + Math.random() * 5.5,
          z: velocity.z * 0.4 + Math.sin(az) * spd,
        },
        rotation: { x: Math.random() * Math.PI, y: Math.random() * Math.PI, z: 0 },
        angularVelocity: { x: (Math.random() - 0.5) * 25, y: (Math.random() - 0.5) * 15, z: (Math.random() - 0.5) * 25 },
        massKg: 28.0,
        dragAreaM2: 0.18,
        restitution: 0.62,
        ageSec: 0,
        maxAgeSec: 3.5,
        isResting: false,
      });
    }

    // 2. 6 Structural Carbon-Fiber Body Panels (hood, active wing, doors, rear diffuser)
    const panelNames = ['panel-hood', 'panel-wing', 'panel-door-left', 'panel-door-right', 'panel-splitter', 'panel-diffuser'];
    for (let i = 0; i < panelNames.length; i++) {
      const angle = (i / panelNames.length) * Math.PI * 2;
      pieces.push({
        id: panelNames[i],
        material: 'carbon-fiber',
        position: {
          x: position.x + Math.cos(angle) * 0.9,
          y: Math.max(0.3, position.y + 0.45),
          z: position.z + Math.sin(angle) * 0.6,
        },
        velocity: {
          x: velocity.x * 0.3 + Math.cos(angle) * blastSpeed * 0.95,
          y: 5.5 + Math.random() * 6.5,
          z: velocity.z * 0.3 + Math.sin(angle) * blastSpeed * 0.95,
        },
        rotation: { x: Math.random() * Math.PI, y: Math.random() * Math.PI, z: Math.random() * Math.PI },
        angularVelocity: { x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 18, z: (Math.random() - 0.5) * 18 },
        massKg: 14.5,
        dragAreaM2: 0.45,
        restitution: 0.32,
        ageSec: 0,
        maxAgeSec: 3.5,
        isResting: false,
      });
    }

    // 3. 12 Polycarbonate Canopy Glass & Shrapnel Splinters
    for (let k = 0; k < 12; k++) {
      const az = Math.random() * Math.PI * 2;
      const elev = 0.2 + Math.random() * 0.8;
      const spd = blastSpeed * (1.1 + Math.random() * 0.6);
      pieces.push({
        id: `shrapnel-glass-${k}`,
        material: 'polycarbonate-glass',
        position: { x: position.x, y: position.y + 0.6, z: position.z },
        velocity: {
          x: velocity.x * 0.2 + Math.cos(az) * Math.cos(elev) * spd,
          y: Math.sin(elev) * spd + 3.0,
          z: velocity.z * 0.2 + Math.sin(az) * Math.cos(elev) * spd,
        },
        rotation: { x: Math.random() * Math.PI, y: Math.random() * Math.PI, z: 0 },
        angularVelocity: { x: (Math.random() - 0.5) * 35, y: (Math.random() - 0.5) * 35, z: (Math.random() - 0.5) * 35 },
        massKg: 2.2,
        dragAreaM2: 0.08,
        restitution: 0.25,
        ageSec: 0,
        maxAgeSec: 3.2,
        isResting: false,
      });
    }
  } else {
    // Starship / Super Heavy: 4 Cylindrical Stainless Steel Barrel Rings + 4 Flaps + 3 Raptor Bells
    for (let r = 0; r < 4; r++) {
      const az = (r / 4) * Math.PI * 2;
      pieces.push({
        id: `starship-barrel-ring-${r}`,
        material: 'stainless-steel',
        position: { x: position.x + Math.cos(az) * 1.8, y: Math.max(0.25, position.y + r * 0.9), z: position.z + Math.sin(az) * 1.8 },
        velocity: {
          x: velocity.x * 0.3 + Math.cos(az) * (blastSpeed * 0.65),
          y: Math.max(2.0, velocity.y * 0.2) + 6.0 + Math.random() * 4.0,
          z: velocity.z * 0.3 + Math.sin(az) * (blastSpeed * 0.65),
        },
        rotation: { x: Math.random() * 0.8, y: Math.random() * Math.PI, z: 0 },
        angularVelocity: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 6 },
        massKg: 1200.0,
        dragAreaM2: 8.5,
        restitution: 0.18,
        ageSec: 0,
        maxAgeSec: 3.5,
        isResting: false,
      });
    }

    // Flap Aero fins & Raptor bells:
    for (let f = 0; f < 4; f++) {
      const az = (f / 4) * Math.PI * 2 + 0.35;
      pieces.push({
        id: `starship-flap-${f}`,
        material: 'titanium-gridfin',
        position: { x: position.x, y: Math.max(0.3, position.y + 1.2 + f * 0.4), z: position.z },
        velocity: {
          x: velocity.x * 0.2 + Math.cos(az) * blastSpeed * 0.8,
          y: 7.5 + Math.random() * 5.0,
          z: velocity.z * 0.2 + Math.sin(az) * blastSpeed * 0.8,
        },
        rotation: { x: Math.random() * Math.PI, y: 0, z: 0 },
        angularVelocity: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 },
        massKg: 350.0,
        dragAreaM2: 2.8,
        restitution: 0.22,
        ageSec: 0,
        maxAgeSec: 3.5,
        isResting: false,
      });
    }

    for (let b = 0; b < 3; b++) {
      const az = (b / 3) * Math.PI * 2;
      pieces.push({
        id: `raptor-bell-${b}`,
        material: 'raptor-bell',
        position: { x: position.x + Math.cos(az) * 0.8, y: Math.max(0.15, position.y + 0.1), z: position.z + Math.sin(az) * 0.8 },
        velocity: {
          x: velocity.x * 0.25 + Math.cos(az) * blastSpeed * 0.7,
          y: 4.5 + Math.random() * 3.5,
          z: velocity.z * 0.25 + Math.sin(az) * blastSpeed * 0.7,
        },
        rotation: { x: 0, y: Math.random() * Math.PI, z: 0 },
        angularVelocity: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 },
        massKg: 450.0,
        dragAreaM2: 1.6,
        restitution: 0.28,
        ageSec: 0,
        maxAgeSec: 3.5,
        isResting: false,
      });
    }
  }

  return pieces;
}

/**
 * Steps the 6-DoF ballistic flight equations of all active falling debris pieces:
 * m * dv/dt = m*g - 0.5*rho*C_d*A * |v - v_wind| * (v - v_wind)
 * Ground bounce damping: restitution e, sliding friction mu
 */
export function stepDebrisBallistics(
  pieces: DebrisPiece[],
  windVector: Vector3D,
  airDensityKgM3: number,
  dt: number,
  groundY = 0.12
): DebrisPiece[] {
  const updated: DebrisPiece[] = [];

  for (const p of pieces) {
    if (p.ageSec >= p.maxAgeSec) continue;

    const nextAge = p.ageSec + dt;
    if (nextAge >= p.maxAgeSec) continue;

    if (p.isResting) {
      updated.push({ ...p, ageSec: nextAge });
      continue;
    }

    // Relative airspeed for debris:
    const relVx = p.velocity.x - windVector.x;
    const relVy = p.velocity.y - windVector.y;
    const relVz = p.velocity.z - windVector.z;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

    const cd = p.material === 'wheel-rubber' ? 0.82 : p.material === 'carbon-fiber' ? 1.15 : 0.95;
    const dragForce = 0.5 * airDensityKgM3 * cd * p.dragAreaM2 * relSpeed;
    const axDrag = relSpeed > 0.1 ? -(dragForce * relVx) / (relSpeed * p.massKg) : 0;
    const ayDrag = relSpeed > 0.1 ? -(dragForce * relVy) / (relSpeed * p.massKg) : 0;
    const azDrag = relSpeed > 0.1 ? -(dragForce * relVz) / (relSpeed * p.massKg) : 0;

    let vx = p.velocity.x + axDrag * dt;
    let vy = p.velocity.y + (-9.81 + ayDrag) * dt;
    let vz = p.velocity.z + azDrag * dt;

    let px = p.position.x + vx * dt;
    let py = p.position.y + vy * dt;
    let pz = p.position.z + vz * dt;

    let isResting = false;
    // Ground collision plane:
    if (py <= groundY) {
      py = groundY;
      if (Math.abs(vy) < 0.65) {
        vy = 0;
        vx *= Math.max(0, 1 - 4.5 * dt);
        vz *= Math.max(0, 1 - 4.5 * dt);
        if (Math.hypot(vx, vz) < 0.25) {
          isResting = true;
          vx = 0;
          vz = 0;
        }
      } else {
        vy = -vy * p.restitution;
        vx *= 0.72;
        vz *= 0.72;
      }
    }

    const rx = p.rotation.x + (isResting ? 0 : p.angularVelocity.x * dt);
    const ry = p.rotation.y + (isResting ? 0 : p.angularVelocity.y * dt);
    const rz = p.rotation.z + (isResting ? 0 : p.angularVelocity.z * dt);

    updated.push({
      ...p,
      position: { x: px, y: py, z: pz },
      velocity: { x: vx, y: vy, z: vz },
      rotation: { x: rx, y: ry, z: rz },
      ageSec: nextAge,
      isResting,
    });
  }

  return updated;
}

/**
 * Evaluates structural damage breakdown and returns forensic diagnosis.
 */
export function evaluateStructuralCrash(
  crashType: CrashType,
  massKg: number,
  velocity: Vector3D,
  angularVelocity: Vector3D,
  attitude: EulerAngles,
  health: SubsystemHealthState,
  vehicle: VehicleId,
  position?: Vector3D
): CrashForensicReport {
  const impactJoules = computeImpactKineticEnergy(massKg, velocity, angularVelocity, vehicle);
  const isCatastrophic = impactJoules > (vehicle === 'roadster' ? 120000 : 4500000);

  const updatedHealth: SubsystemHealthState = {
    batteryHealthPct: Math.max(0, health.batteryHealthPct - (isCatastrophic ? 100 : 45)),
    copvHealthPct: Math.max(0, health.copvHealthPct - (isCatastrophic ? 100 : 60)),
    aeroControlHealthPct: Math.max(0, health.aeroControlHealthPct - (isCatastrophic ? 100 : 50)),
    tractionHealthPct: Math.max(0, health.tractionHealthPct - (isCatastrophic ? 100 : 75)),
    leakVentingRateKgS: isCatastrophic ? 4.2 : 1.8,
    parasiticTorqueNm: { x: 380, y: -450, z: 220 },
    structuralStressG: Number((Math.sqrt(impactJoules) / (massKg * 0.8)).toFixed(1)),
  };

  const sequence: string[] = [
    `CRASH TYPE // ${crashType.toUpperCase()}`,
    `IMPACT KINETIC ENERGY // ${(impactJoules / 1000).toFixed(1)} kJ (${(impactJoules / 1000000).toFixed(2)} MJ)`,
    `STRUCTURAL DECELERATION // ${updatedHealth.structuralStressG}G PEAK SHOCK`,
  ];

  if (vehicle === 'roadster') {
    sequence.push(
      isCatastrophic
        ? 'CHASSIS SEVERED // 4 WHEEL HUBS SHEARED // COPV 700-BAR CATACLYSMIC BLEVE'
        : 'CARBON COMPOSITE CRUSH // SUSPENSION FAILURE // HIGH-VOLTAGE PACK SAFE-ISOLATE'
    );
  } else {
    sequence.push(
      isCatastrophic
        ? 'COMMON BULKHEAD COLLAPSE // METHANE/LOX DEFLAGRATION // 35M THERMAL FIREBALL'
        : 'PAD MOUNT IMPACT // FLAP SERVO OVERLOAD // TVC HYDRAULIC SHUTDOWN'
    );
  }

  const spawnedDebris = generateVehicleDebrisPieces(
    vehicle,
    position ?? { x: 0, y: 0.5, z: 0 },
    velocity,
    attitude,
    impactJoules
  );

  return {
    isCatastrophic,
    impactKineticEnergyJoules: impactJoules,
    diagnosticSequence: sequence,
    spawnedDebris,
    updatedHealth,
  };
}
