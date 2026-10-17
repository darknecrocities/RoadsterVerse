import * as THREE from 'three';
import type { ThrusterActivation, WheelSpec } from '../types/simulation.ts';

export interface RoadsterRig {
  root: THREE.Group;
  activeWing: THREE.Group;
  wheelsGroup: THREE.Group;
  nozzles: {
    fl: THREE.Mesh;
    fr: THREE.Mesh;
    rl: THREE.Mesh;
    rr: THREE.Mesh;
    latLeft: THREE.Mesh;
    latRight: THREE.Mesh;
    rearBoost: THREE.Mesh;
  };
  plumeLight: THREE.PointLight;
  tailLightGlow: THREE.PointLight;
  setWheelSpec: (spec: WheelSpec) => void;
  updateThrusters: (t: ThrusterActivation, timeSec: number) => void;
}

function createColdGasPlumeMesh(length = 2.4, radius = 0.22): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 20, 1, true);
  // Shift cone so its apex is at the nozzle origin and it extends downward (-Y)
  geo.translate(0, -length / 2, 0);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.18, 'rgba(165, 243, 252, 0.92)');
    grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.45)');
    grad.addColorStop(0.5, 'rgba(224, 242, 254, 0.88)'); // Mach shock diamond 1
    grad.addColorStop(0.68, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(0.82, 'rgba(186, 230, 253, 0.65)'); // Mach shock diamond 2
    grad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

export function createRoadsterModel(isGhost = false): RoadsterRig {
  const root = new THREE.Group();

  const bodyMat = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        metalness: 0.18,
        roughness: 0.22,
        clearcoat: 0.95,
        clearcoatRoughness: 0.12,
      });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.45,
    roughness: 0.4,
    transparent: isGhost,
    opacity: isGhost ? 0.2 : 1,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    metalness: 0.85,
    roughness: 0.08,
    transparent: true,
    opacity: isGhost ? 0.18 : 0.92,
  });

  // 1. Cyber-Wedge Sculpted Roadster Hull (matching Image 1 profile)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.15, 0.08);
  hullShape.lineTo(2.1, 0.05);     // Lower splitter line
  hullShape.lineTo(2.28, 0.34);    // Sharp wedge nose tip
  hullShape.lineTo(1.25, 0.62);    // Front hood slope
  hullShape.lineTo(0.15, 0.98);    // Windshield peak
  hullShape.lineTo(-1.15, 0.88);   // Fastback roofline
  hullShape.lineTo(-2.18, 0.64);   // Rear decklid
  hullShape.lineTo(-2.24, 0.22);   // Rear diffuser overhang
  hullShape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 1.86,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.07,
    bevelSegments: 3,
  };
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
  hullGeo.translate(0, 0, -0.93);
  const hullMesh = new THREE.Mesh(hullGeo, bodyMat);
  hullMesh.castShadow = !isGhost;
  root.add(hullMesh);

  // 2. Panoramic Dark Glass Canopy
  const canopyGeo = new THREE.BoxGeometry(2.15, 0.34, 1.48);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMat);
  canopyMesh.position.set(-0.12, 0.78, 0);
  canopyMesh.rotation.z = -0.06;
  root.add(canopyMesh);

  // 3. Carbon Fiber Lower Side Skirts, Front Splitter & Side Fender Intakes (Image 1)
  const skirtGeo = new THREE.BoxGeometry(4.42, 0.14, 1.98);
  const skirtMesh = new THREE.Mesh(skirtGeo, carbonMat);
  skirtMesh.position.set(0.02, 0.09, 0);
  root.add(skirtMesh);

  const intakeGeo = new THREE.BoxGeometry(0.18, 0.36, 2.01);
  const intakeMesh = new THREE.Mesh(intakeGeo, carbonMat);
  intakeMesh.position.set(0.68, 0.32, 0);
  intakeMesh.rotation.z = -0.18;
  root.add(intakeMesh);

  // 4. Razor-Thin Continuous Front LED Light Bar & Rear Red Light Strip (Images 1, 2, 3)
  const frontLedMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const frontLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 1.88), frontLedMat);
  frontLed.position.set(2.26, 0.34, 0);
  root.add(frontLed);

  const rearLedMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const rearLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.86), rearLedMat);
  rearLed.position.set(-2.23, 0.56, 0);
  root.add(rearLed);

  // 5. Deployed Active Rear Aerodynamic Wing on Dual Pylons (Image 1)
  const activeWing = new THREE.Group();
  activeWing.position.set(-2.05, 0.72, 0);
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.84), bodyMat);
  wingBlade.position.set(-0.12, 0.18, 0);
  wingBlade.rotation.z = 0.22;
  const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.04), carbonMat);
  pylonL.position.set(-0.05, 0.08, 0.52);
  const pylonR = pylonL.clone();
  pylonR.position.z = -0.52;
  activeWing.add(wingBlade, pylonL, pylonR);
  root.add(activeWing);

  // 6. Switchable Wheel Assemblies (6-Spoke Track Spec from Image 1 vs Aero-Disc from Image 2)
  const wheelsGroup = new THREE.Group();
  root.add(wheelsGroup);

  const wheelPositions = [
    { x: 1.35, y: 0.32, z: 0.96 },
    { x: 1.35, y: 0.32, z: -0.96 },
    { x: -1.35, y: 0.32, z: 0.96 },
    { x: -1.35, y: 0.32, z: -0.96 },
  ];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.25,
  });

  function buildWheels(spec: WheelSpec): void {
    while (wheelsGroup.children.length > 0) {
      wheelsGroup.remove(wheelsGroup.children[0]);
    }
    for (const pos of wheelPositions) {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos.x, pos.y, pos.z);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24), tireMat);
      tire.rotation.x = Math.PI / 2;
      wGroup.add(tire);

      if (spec === 'aero-disc') {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.27, 24), discMat);
        disc.rotation.x = Math.PI / 2;
        wGroup.add(disc);
      } else {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.24, 16), bodyMat);
        hub.rotation.x = Math.PI / 2;
        wGroup.add(hub);
        for (let s = 0; s < 6; s++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.055, 0.28), carbonMat);
          spoke.rotation.z = (s * Math.PI) / 3;
          wGroup.add(spoke);
        }
      }
      wheelsGroup.add(wGroup);
    }
  }
  buildWheels('six-spoke');

  // 7. Cold-Gas COPV Supersonic Thruster Plumes (4 Vertical + 2 Lateral RCS + 1 Rear Boost)
  const fl = createColdGasPlumeMesh(2.5, 0.21);
  fl.position.set(0.92, 0.12, 0.78);
  const fr = createColdGasPlumeMesh(2.5, 0.21);
  fr.position.set(0.92, 0.12, -0.78);
  const rl = createColdGasPlumeMesh(2.5, 0.21);
  rl.position.set(-0.92, 0.12, 0.78);
  const rr = createColdGasPlumeMesh(2.5, 0.21);
  rr.position.set(-0.92, 0.12, -0.78);

  // Lateral thrusters (Image 3 shows long horizontal cold-gas jet shooting sideways!)
  const latLeft = createColdGasPlumeMesh(3.1, 0.22);
  latLeft.position.set(1.55, 0.36, 1.02);
  latLeft.rotation.x = -Math.PI / 2;

  const latRight = createColdGasPlumeMesh(3.4, 0.24);
  latRight.position.set(0.4, 0.38, -1.02);
  latRight.rotation.x = Math.PI / 2;
  latRight.rotation.z = -Math.PI / 2; // Fires outward from car roof/side when pinning against wall

  const rearBoost = createColdGasPlumeMesh(3.2, 0.28);
  rearBoost.position.set(-2.25, 0.35, 0);
  rearBoost.rotation.z = -Math.PI / 2;

  root.add(fl, fr, rl, rr, latLeft, latRight, rearBoost);

  // Lights that illuminate the ground-effect smoke in cyan & red/pink (Images 2 & 3)
  const plumeLight = new THREE.PointLight(0x38bdf8, 0, 12);
  plumeLight.position.set(0, -0.6, 0);
  const tailLightGlow = new THREE.PointLight(0xff2a55, isGhost ? 0 : 2.5, 9);
  tailLightGlow.position.set(-2.1, -0.2, 0);
  root.add(plumeLight, tailLightGlow);

  return {
    root,
    activeWing,
    wheelsGroup,
    nozzles: { fl, fr, rl, rr, latLeft, latRight, rearBoost },
    plumeLight,
    tailLightGlow,
    setWheelSpec: buildWheels,
    updateThrusters(t: ThrusterActivation, timeSec: number) {
      if (isGhost) return;
      const flicker = 0.92 + Math.sin(timeSec * 65) * 0.08;

      const applyPlume = (mesh: THREE.Mesh, val: number) => {
        mesh.visible = val > 0.04;
        if (mesh.visible) {
          const s = Math.max(0.2, val * flicker);
          mesh.scale.set(0.75 + s * 0.35, s, 0.75 + s * 0.35);
        }
      };

      applyPlume(fl, t.frontLeftLift);
      applyPlume(fr, t.frontRightLift);
      applyPlume(rl, t.rearLeftLift);
      applyPlume(rr, t.rearRightLift);
      applyPlume(latLeft, t.lateralLeft);
      applyPlume(latRight, t.lateralRight);
      applyPlume(rearBoost, t.rearBoost);

      activeWing.rotation.z = 0.1 + t.activeWingAngle * 0.42;
      const avgLift =
        (t.frontLeftLift + t.frontRightLift + t.rearLeftLift + t.rearRightLift + t.lateralRight) / 5;
      plumeLight.intensity = avgLift * 8.5 * flicker;
    },
  };
}
