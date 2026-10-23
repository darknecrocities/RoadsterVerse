import * as THREE from 'three';
import type { DebrisPiece, VehicleId, Vector3D } from '../types/simulation.ts';

interface MeshPieceBinding {
  id: string;
  mesh: THREE.Mesh;
}

/**
 * High-Fidelity 3D Multi-Body Debris, Shrapnel & Catastrophic Explosion FX:
 * 1) Realistic physical debris meshes (detached wheels, carbon panels, stainless rings, Raptor bells).
 * 2) Cold-gas COPV 700-bar nitrogen BLEVE vapor cloud.
 * 3) High-voltage battery pack cyan electrical arc flash.
 * 4) 35m cryogenic methane deflagration fireball and ground scorch flash.
 */
export class DebrisAndDestructionFX {
  public readonly group = new THREE.Group();
  private readonly pieceMeshes: MeshPieceBinding[] = [];
  private readonly copvVaporMesh: THREE.Mesh;
  private readonly copvVaporMat: THREE.MeshBasicMaterial;
  private readonly electricalArcLight: THREE.PointLight;
  private readonly methaneFireball: THREE.Mesh;
  private readonly methaneFireballMat: THREE.MeshBasicMaterial;
  private copvVaporAge = 999;
  private fireballAge = 999;
  private arcTimer = 0;

  constructor() {
    // 1. Build Pre-Allocated Pool of Multi-Body Debris Meshes
    // A. Detached Wheels (Cylinder)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.85,
      metalness: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.visible = false;
      this.group.add(mesh);
      const id = i === 0 ? 'wheel-fl' : i === 1 ? 'wheel-fr' : i === 2 ? 'wheel-rl' : 'wheel-rr';
      this.pieceMeshes.push({ id, mesh });
    }

    // B. Carbon-Fiber Body Panels (Box)
    const panelGeo = new THREE.BoxGeometry(0.85, 0.05, 0.48);
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x262626,
      roughness: 0.35,
      metalness: 0.55,
    });
    const panelNames = ['panel-hood', 'panel-wing', 'panel-door-left', 'panel-door-right', 'panel-splitter', 'panel-diffuser'];
    for (const name of panelNames) {
      const mesh = new THREE.Mesh(panelGeo, carbonMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pieceMeshes.push({ id: name, mesh });
    }

    // C. Polycarbonate Glass / Shrapnel Splinters
    const glassGeo = new THREE.TetrahedronGeometry(0.18, 0);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    for (let k = 0; k < 12; k++) {
      const mesh = new THREE.Mesh(glassGeo, glassMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pieceMeshes.push({ id: `shrapnel-glass-${k}`, mesh });
    }

    // D. Starship Stainless Steel Barrel Rings (Torus/Cylinder)
    const ringGeo = new THREE.CylinderGeometry(2.2, 2.2, 1.8, 24, 1, true);
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    for (let r = 0; r < 4; r++) {
      const mesh = new THREE.Mesh(ringGeo, steelMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pieceMeshes.push({ id: `starship-barrel-ring-${r}`, mesh });
    }

    // E. Titanium Grid Fins & Flaps
    const finGeo = new THREE.BoxGeometry(1.4, 0.12, 0.85);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
    for (let f = 0; f < 4; f++) {
      const mesh = new THREE.Mesh(finGeo, finMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pieceMeshes.push({ id: `starship-flap-${f}`, mesh });
    }

    // F. Raptor Engine Bells
    const bellGeo = new THREE.ConeGeometry(0.85, 1.6, 18, 1, true);
    bellGeo.rotateX(Math.PI);
    const bellMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.78, roughness: 0.35, side: THREE.DoubleSide });
    for (let b = 0; b < 3; b++) {
      const mesh = new THREE.Mesh(bellGeo, bellMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pieceMeshes.push({ id: `raptor-bell-${b}`, mesh });
    }

    // 2. High-Pressure Nitrogen COPV BLEVE Vapor Cloud
    const vaporGeo = new THREE.SphereGeometry(1.0, 24, 20);
    this.copvVaporMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.copvVaporMesh = new THREE.Mesh(vaporGeo, this.copvVaporMat);
    this.copvVaporMesh.visible = false;
    this.group.add(this.copvVaporMesh);

    // 3. High-Voltage Battery Pack Electric Arc Light
    this.electricalArcLight = new THREE.PointLight(0x38bdf8, 0, 24);
    this.group.add(this.electricalArcLight);

    // 4. Starship Methane Deflagration Fireball
    const fireballGeo = new THREE.SphereGeometry(1.0, 32, 24);
    this.methaneFireballMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.methaneFireball = new THREE.Mesh(fireballGeo, this.methaneFireballMat);
    this.methaneFireball.visible = false;
    this.group.add(this.methaneFireball);
  }

  public triggerCrash(
    vehicle: VehicleId,
    pos: Vector3D,
    pieces: DebrisPiece[],
    impactJoules: number
  ): void {
    // 1. Activate Debris Meshes
    for (const binding of this.pieceMeshes) {
      const pieceData = pieces.find((p) => p.id === binding.id);
      if (pieceData) {
        binding.mesh.position.set(pieceData.position.x, pieceData.position.y, pieceData.position.z);
        binding.mesh.rotation.set(pieceData.rotation.x, pieceData.rotation.y, pieceData.rotation.z);
        binding.mesh.visible = true;
      } else {
        binding.mesh.visible = false;
      }
    }

    // 2. Trigger Vehicle-Specific Catastrophic Visuals
    if (vehicle === 'roadster') {
      // COPV nitrogen BLEVE cloud:
      this.copvVaporAge = 0;
      this.copvVaporMesh.position.set(pos.x, Math.max(0.4, pos.y), pos.z);
      this.copvVaporMesh.scale.set(1, 1, 1);
      this.copvVaporMesh.visible = true;

      // Battery pack electrical arc flash:
      this.arcTimer = 0.65;
      this.electricalArcLight.position.set(pos.x, pos.y + 0.3, pos.z);
      this.electricalArcLight.intensity = 18.0;
    } else {
      // Starship 35m methane fireball:
      this.fireballAge = 0;
      this.methaneFireball.position.set(pos.x, Math.max(2.0, pos.y), pos.z);
      this.methaneFireball.scale.set(1, 1, 1);
      this.methaneFireball.visible = true;
    }
  }

  public update(dt: number, pieces: DebrisPiece[]): void {
    // Step debris mesh positions from ballistic physics engine
    for (const binding of this.pieceMeshes) {
      const pieceData = pieces.find((p) => p.id === binding.id);
      if (pieceData && pieceData.ageSec < pieceData.maxAgeSec) {
        binding.mesh.position.set(pieceData.position.x, pieceData.position.y, pieceData.position.z);
        binding.mesh.rotation.set(pieceData.rotation.x, pieceData.rotation.y, pieceData.rotation.z);
        binding.mesh.visible = true;
      } else {
        binding.mesh.visible = false;
      }
    }

    // Step COPV vapor expansion
    if (this.copvVaporAge < 1.2) {
      this.copvVaporAge += dt;
      const progress = this.copvVaporAge / 1.2;
      const scale = 1.0 + progress * 9.5;
      this.copvVaporMesh.scale.set(scale, scale * 0.75, scale);
      this.copvVaporMat.opacity = Math.max(0, (1 - progress) * 0.82);
    } else if (this.copvVaporMesh.visible) {
      this.copvVaporMesh.visible = false;
    }

    // Step battery arc flashes
    if (this.arcTimer > 0) {
      this.arcTimer -= dt;
      const flicker = Math.random() > 0.35 ? 1 : 0.2;
      this.electricalArcLight.intensity = Math.max(0, this.arcTimer * 22.0 * flicker);
    }

    // Step Starship methane fireball expansion
    if (this.fireballAge < 1.8) {
      this.fireballAge += dt;
      const progress = this.fireballAge / 1.8;
      const scale = 2.0 + progress * 24.0;
      this.methaneFireball.scale.set(scale, scale * 1.15, scale);
      this.methaneFireball.position.y += dt * 3.5; // Thermal buoyancy rise
      this.methaneFireballMat.opacity = Math.max(0, (1 - progress * progress) * 0.88);
      if (progress > 0.45) {
        this.methaneFireballMat.color.setHex(0xdc2626);
      }
    } else if (this.methaneFireball.visible) {
      this.methaneFireball.visible = false;
    }
  }

  public reset(): void {
    for (const b of this.pieceMeshes) {
      b.mesh.visible = false;
    }
    this.copvVaporMesh.visible = false;
    this.methaneFireball.visible = false;
    this.electricalArcLight.intensity = 0;
    this.copvVaporAge = 999;
    this.fireballAge = 999;
  }
}
