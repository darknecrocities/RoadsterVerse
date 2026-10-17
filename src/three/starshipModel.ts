import * as THREE from 'three';
import type { ThrusterActivation } from '../types/simulation.ts';

export interface StarshipRig {
  root: THREE.Group;
  shipGroup: THREE.Group;
  boosterGroup: THREE.Group;
  flaps: {
    frontLeft: THREE.Mesh;
    frontRight: THREE.Mesh;
    aftLeft: THREE.Mesh;
    aftRight: THREE.Mesh;
  };
  boosterPlume: THREE.Mesh;
  shipPlume: THREE.Mesh;
  plumeLight: THREE.PointLight;
  updateStarship: (t: ThrusterActivation, isLaunchMission: boolean, timeSec: number) => void;
}

/**
 * Generates a high-detail procedural texture replicating Image 5:
 * 304L brushed stainless steel ring weld lines on the leeward side +
 * black hexagonal TPS heat-shield tiles with jagged stepped borders on the windward belly.
 */
function createStarshipHullTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Brushed 304L stainless steel base
    const metalGrad = ctx.createLinearGradient(0, 0, 512, 0);
    metalGrad.addColorStop(0.0, '#cbd5e1');
    metalGrad.addColorStop(0.25, '#f1f5f9');
    metalGrad.addColorStop(0.5, '#94a3b8');
    metalGrad.addColorStop(1.0, '#cbd5e1');
    ctx.fillStyle = metalGrad;
    ctx.fillRect(0, 0, 512, 1024);

    // Circumferential barrel weld seams & panel variegation (Image 5)
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 1024; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Windward Black Hexagonal TPS Heat Shield Tiles with jagged edge (Image 5 right side)
    ctx.fillStyle = '#111827';
    for (let y = 0; y < 1024; y += 16) {
      const jaggedOffset = ((y * 17) % 44) - 18;
      const startX = 275 + jaggedOffset;
      ctx.fillRect(startX, y, 512 - startX, 15);
    }

    // Vertical red/silver raceway spine & circular inspection portholes (Image 5 center)
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(138, 180, 8, 760);
    ctx.fillStyle = '#0f172a';
    for (const py of [310, 540, 820]) {
      ctx.beginPath();
      ctx.arc(178, py, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createRaptorMachPlume(length: number, radius: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
  geo.translate(0, -length / 2, 0);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Replicates the brilliant white-magenta-orange 33-Raptor plume in Image 4
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(251, 207, 232, 0.95)');
    grad.addColorStop(0.45, 'rgba(236, 72, 153, 0.88)');
    grad.addColorStop(0.72, 'rgba(249, 115, 22, 0.65)');
    grad.addColorStop(1.0, 'rgba(239, 68, 68, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

export function createStarshipModel(isGhost = false): StarshipRig {
  const root = new THREE.Group();
  const shipGroup = new THREE.Group();
  const boosterGroup = new THREE.Group();
  root.add(shipGroup, boosterGroup);

  const hullTex = isGhost ? undefined : createStarshipHullTexture();
  const shipMat = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        wireframe: true,
        transparent: true,
        opacity: 0.26,
      })
    : new THREE.MeshStandardMaterial({
        map: hullTex,
        metalness: 0.78,
        roughness: 0.26,
      });

  const darkTpsMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.35,
    roughness: 0.55,
    transparent: isGhost,
    opacity: isGhost ? 0.22 : 1,
  });

  // 1. Starship Upper Stage Cylindrical Barrel + Ogive Nosecone (Image 5)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.1, 32), shipMat);
  barrel.position.y = 1.55;
  shipGroup.add(barrel);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.45, 32), shipMat);
  nose.position.y = 3.82;
  shipGroup.add(nose);

  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 24), darkTpsMat);
  noseTip.position.y = 4.35;
  shipGroup.add(noseTip);

  // 2. Four Articulated Stainless Steel Aerodynamic Flaps (2 Forward + 2 Aft, Image 5)
  const fwdFlapGeo = new THREE.BoxGeometry(0.06, 0.88, 0.52);
  const frontLeft = new THREE.Mesh(fwdFlapGeo, shipMat);
  frontLeft.position.set(0, 3.45, 0.72);
  frontLeft.rotation.x = -0.22;

  const frontRight = new THREE.Mesh(fwdFlapGeo, shipMat);
  frontRight.position.set(0, 3.45, -0.72);
  frontRight.rotation.x = 0.22;

  const aftFlapGeo = new THREE.BoxGeometry(0.07, 1.25, 0.68);
  const aftLeft = new THREE.Mesh(aftFlapGeo, shipMat);
  aftLeft.position.set(0, 0.72, 0.82);
  aftLeft.rotation.x = -0.15;

  const aftRight = new THREE.Mesh(aftFlapGeo, shipMat);
  aftRight.position.set(0, 0.72, -0.82);
  aftRight.rotation.x = 0.15;

  shipGroup.add(frontLeft, frontRight, aftLeft, aftRight);

  // 3. Super Heavy Booster + Vented Hot-Stage Interstage + 4 Waffle Grid Fins (Image 4)
  const hotStageRing = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.32, 24), darkTpsMat);
  hotStageRing.position.y = -0.16;
  boosterGroup.add(hotStageRing);

  const boosterHull = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 4.4, 32), shipMat);
  boosterHull.position.y = -2.52;
  boosterGroup.add(boosterHull);

  // 4 Waffle Grid Fins near top of Super Heavy Booster
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.34), darkTpsMat);
    fin.position.set(Math.cos(angle) * 0.78, -0.52, Math.sin(angle) * 0.78);
    fin.rotation.y = -angle;
    boosterGroup.add(fin);
  }

  // 33 Raptor Engine Cluster Skirt + Plumes
  const boosterPlume = createRaptorMachPlume(6.8, 0.78);
  boosterPlume.position.y = -4.72;
  boosterGroup.add(boosterPlume);

  const shipPlume = createRaptorMachPlume(4.2, 0.52);
  shipPlume.position.y = 0.0;
  shipGroup.add(shipPlume);

  const plumeLight = new THREE.PointLight(0xf472b6, 0, 22);
  plumeLight.position.set(0, -2.5, 0);
  root.add(plumeLight);

  return {
    root,
    shipGroup,
    boosterGroup,
    flaps: { frontLeft, frontRight, aftLeft, aftRight },
    boosterPlume,
    shipPlume,
    plumeLight,
    updateStarship(t: ThrusterActivation, isLaunchMission: boolean, timeSec: number) {
      if (isGhost) return;
      const flicker = 0.9 + Math.sin(timeSec * 80) * 0.1;

      // Articulate all 4 aerodynamic flaps based on RL policy outputs
      frontLeft.rotation.y = (t.flapFrontLeft - 0.5) * 1.1;
      frontRight.rotation.y = -(t.flapFrontRight - 0.5) * 1.1;
      aftLeft.rotation.y = (t.flapAftLeft - 0.5) * 1.1;
      aftRight.rotation.y = -(t.flapAftRight - 0.5) * 1.1;

      if (isLaunchMission) {
        boosterGroup.visible = true;
        if (t.hotStageSeparated) {
          boosterGroup.position.y = Math.max(-7.5, boosterGroup.position.y - 0.06);
          boosterPlume.visible = false;
          shipPlume.visible = t.raptorThrottle > 0.05;
          shipPlume.scale.set(1, t.raptorThrottle * flicker, 1);
        } else {
          boosterGroup.position.y = 0;
          boosterPlume.visible = t.raptorThrottle > 0.05;
          shipPlume.visible = false;
          boosterPlume.scale.set(
            0.85 + t.raptorThrottle * 0.3,
            t.raptorThrottle * flicker,
            0.85 + t.raptorThrottle * 0.3
          );
          boosterPlume.rotation.z = t.gimbalPitch * 0.22;
        }
      } else {
        // Belly-flop & Flip-and-Burn mode (Upper Stage Ship only, Image 5)
        boosterGroup.visible = false;
        boosterPlume.visible = false;
        shipPlume.visible = t.raptorThrottle > 0.05;
        shipPlume.scale.set(
          0.75 + t.raptorThrottle * 0.35,
          t.raptorThrottle * flicker,
          0.75 + t.raptorThrottle * 0.35
        );
        shipPlume.rotation.z = t.gimbalPitch * 0.28;
      }

      plumeLight.intensity = t.raptorThrottle * 14 * flicker;
    },
  };
}
