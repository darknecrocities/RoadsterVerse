import * as THREE from 'three';
import type {
  CameraMode,
  MissionId,
  RigidBodyState,
  ThrusterActivation,
  VehicleId,
  WheelSpec,
} from '../types/simulation.ts';
import { createRoadsterModel, type RoadsterRig } from './roadsterModel.ts';
import { createStarshipModel, type StarshipRig } from './starshipModel.ts';
import { VolumetricPlumeSmokeSystem } from './plumeAndSmokeFX.ts';

export class ProvingGroundSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly roadsterRig: RoadsterRig;
  private readonly starshipRig: StarshipRig;
  private readonly ghostRoadsters: RoadsterRig[] = [];
  private readonly ghostStarships: StarshipRig[] = [];
  private readonly smokeSystem = new VolumetricPlumeSmokeSystem(120);
  private readonly roadsterArenaGroup = new THREE.Group();
  private readonly starbaseCoastalGroup = new THREE.Group();
  private readonly targetMarker: THREE.Mesh;
  private cameraMode: CameraMode = 'orbit';
  private orbitAngle = 0.42;

  constructor(container: HTMLElement) {
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 400);
    this.camera.position.set(0, 4.8, 13.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.replaceChildren(this.renderer.domElement);

    this.setupLighting();
    this.buildRoadsterNightProvingGround();
    this.buildStarbaseCoastalWetlands();

    // Target Hover / Waypoint Hologram Ring
    const ringGeo = new THREE.TorusGeometry(1.65, 0.045, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.55,
    });
    this.targetMarker = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(this.targetMarker);

    // Primary Vehicles & Ghost Swarm Pool
    this.roadsterRig = createRoadsterModel(false);
    this.starshipRig = createStarshipModel(false);
    this.scene.add(this.roadsterRig.root, this.starshipRig.root, this.smokeSystem.group);

    for (let i = 0; i < 8; i++) {
      const gR = createRoadsterModel(true);
      const gS = createStarshipModel(true);
      gR.root.visible = false;
      gS.root.visible = false;
      this.ghostRoadsters.push(gR);
      this.ghostStarships.push(gS);
      this.scene.add(gR.root, gS.root);
    }
  }

  private setupLighting(): void {
    this.scene.background = new THREE.Color(0x040711);
    this.scene.fog = new THREE.FogExp2(0x040711, 0.014);

    const ambient = new THREE.AmbientLight(0x94a3b8, 0.75);
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.1);
    keyLight.position.set(8, 22, 14);

    // Studio warm orange left rim light + cool blue right haze matching Image 1 & 2
    const warmArenaLight = new THREE.PointLight(0xf97316, 4.5, 28);
    warmArenaLight.position.set(-10, 2.5, -4);
    const coolArenaLight = new THREE.PointLight(0x0ea5e9, 4.0, 28);
    coolArenaLight.position.set(10, 5.5, 6);

    this.scene.add(ambient, keyLight, warmArenaLight, coolArenaLight);
  }

  /**
   * Builds the Night Proving Ground + 90-Degree Curved Concrete Wall Mega-Ramp
   * with glowing LED vertical edge strips from Image 3!
   */
  private buildRoadsterNightProvingGround(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      roughness: 0.35,
      metalness: 0.25,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), asphaltMat);
    ground.rotation.x = -Math.PI / 2;
    this.roadsterArenaGroup.add(ground);

    const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x0f172a);
    grid.position.y = 0.01;
    this.roadsterArenaGroup.add(grid);

    // 90-Degree Curved Concrete Wall Mega-Ramp (Image 3 right side)
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.65,
      metalness: 0.1,
    });
    const ledEdgeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });

    const rampGroup = new THREE.Group();
    const segments = 18;
    const radius = 9.0;
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const angle = frac * (Math.PI / 2);
      const cx = 3.0 + Math.sin(angle) * radius;
      const cy = radius - Math.cos(angle) * radius;

      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 4.8), concreteMat);
      slab.position.set(cx, cy, 0);
      slab.rotation.z = angle;
      rampGroup.add(slab);

      // Glowing white LED edge strips on both sides of the concrete ramp (Image 3)
      const ledL = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.32, 0.08), ledEdgeMat);
      ledL.position.set(cx, cy + 0.03, 2.42);
      ledL.rotation.z = angle;
      const ledR = ledL.clone();
      ledR.position.z = -2.42;
      rampGroup.add(ledL, ledR);
    }

    // Upper vertical concrete wall extension above the curve
    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 8.0, 4.8), concreteMat);
    upperWall.position.set(12.0, 12.8, 0);
    const upperLedL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.0, 0.08), ledEdgeMat);
    upperLedL.position.set(12.0, 12.8, 2.42);
    const upperLedR = upperLedL.clone();
    upperLedR.position.z = -2.42;
    rampGroup.add(upperWall, upperLedL, upperLedR);

    this.roadsterArenaGroup.add(rampGroup);
    this.scene.add(this.roadsterArenaGroup);
  }

  /**
   * Builds the Starbase Boca Chica Coastal Wetlands & Orbital Launch Mount
   * matching the aerial coastal vista in Image 4!
   */
  private buildStarbaseCoastalWetlands(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e3a5f'; // Coastal lagoon water
      ctx.fillRect(0, 0, 512, 512);
      // Marshland green peninsulas & sandbars (Image 4)
      ctx.fillStyle = '#365314';
      for (let i = 0; i < 28; i++) {
        ctx.beginPath();
        ctx.ellipse(
          (i * 73) % 512,
          (i * 119) % 512,
          45 + (i % 5) * 18,
          20 + (i % 4) * 12,
          (i * 0.4) % Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(210, 210, 90, 90);
    }
    const coastalTex = new THREE.CanvasTexture(canvas);
    const coastalPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshStandardMaterial({ map: coastalTex, roughness: 0.8 })
    );
    coastalPlane.rotation.x = -Math.PI / 2;
    this.starbaseCoastalGroup.add(coastalPlane);

    // Orbital Launch Mount & Mechazilla Catch Tower
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.7,
      roughness: 0.3,
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 16, 1.1), towerMat);
    tower.position.set(-2.3, 8.0, 0);
    const chopsticks = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 1.5), towerMat);
    chopsticks.position.set(-1.1, 13.5, 0);
    this.starbaseCoastalGroup.add(tower, chopsticks);

    this.starbaseCoastalGroup.visible = false;
    this.scene.add(this.starbaseCoastalGroup);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public setWheelSpec(spec: WheelSpec): void {
    this.roadsterRig.setWheelSpec(spec);
  }

  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public renderFrame(
    missionId: MissionId,
    vehicle: VehicleId,
    primaryState: RigidBodyState,
    primaryThrusters: ThrusterActivation,
    ghostStates: RigidBodyState[],
    targetPos: { x: number; y: number; z: number },
    dt: number
  ): void {
    const isRoadster = vehicle === 'roadster';
    this.roadsterRig.root.visible = isRoadster;
    this.starshipRig.root.visible = !isRoadster;
    this.roadsterArenaGroup.visible = isRoadster;
    this.starbaseCoastalGroup.visible = !isRoadster;

    this.scene.background = new THREE.Color(
      missionId === 'starship-launch' ? 0x0f172a : 0x040711
    );

    this.targetMarker.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.targetMarker.rotation.z = missionId === 'roadster-wall-climb' ? Math.PI / 2 : 0;

    if (isRoadster) {
      this.roadsterRig.root.position.set(
        primaryState.position.x,
        primaryState.position.y,
        primaryState.position.z
      );
      this.roadsterRig.root.rotation.set(
        primaryState.attitude.roll,
        primaryState.attitude.yaw,
        primaryState.attitude.pitch
      );
      this.roadsterRig.updateThrusters(primaryThrusters, primaryState.elapsedTimeSec);
    } else {
      this.starshipRig.root.position.set(
        primaryState.position.x,
        primaryState.position.y,
        primaryState.position.z
      );
      this.starshipRig.root.rotation.set(
        primaryState.attitude.roll,
        primaryState.attitude.yaw,
        primaryState.attitude.pitch
      );
      this.starshipRig.updateStarship(
        primaryThrusters,
        missionId === 'starship-launch',
        primaryState.elapsedTimeSec
      );
    }

    // Update Ghost Swarm agents
    for (let i = 0; i < this.ghostRoadsters.length; i++) {
      const gState = ghostStates[i];
      this.ghostRoadsters[i].root.visible = Boolean(isRoadster && gState);
      this.ghostStarships[i].root.visible = Boolean(!isRoadster && gState);
      if (gState) {
        const targetRig = isRoadster ? this.ghostRoadsters[i].root : this.ghostStarships[i].root;
        targetRig.position.set(gState.position.x, gState.position.y, gState.position.z + (i - 2) * 0.45);
        targetRig.rotation.set(gState.attitude.roll, gState.attitude.yaw, gState.attitude.pitch);
      }
    }

    this.smokeSystem.update(dt, vehicle, primaryState, primaryThrusters);

    // Update Camera Rig
    const px = primaryState.position.x;
    const py = primaryState.position.y;
    if (this.cameraMode === 'orbit') {
      this.orbitAngle += dt * 0.14;
      const dist = isRoadster ? 11.5 : 14.5;
      this.camera.position.set(
        px + Math.sin(this.orbitAngle) * dist * 0.35,
        Math.max(2.2, py + 1.8),
        dist
      );
      this.camera.lookAt(px, Math.max(1.2, py + 0.4), 0);
    } else if (this.cameraMode === 'chase') {
      this.camera.position.set(px - 6.8, Math.max(1.8, py + 2.2), 6.2);
      this.camera.lookAt(px + 1.5, py + 0.5, 0);
    } else if (this.cameraMode === 'thruster-cam') {
      // Low-angle dramatic thruster & smoke shot matching Images 2 & 3!
      this.camera.position.set(px - 1.2, Math.max(0.55, py - 1.4), 6.4);
      this.camera.lookAt(px, py + 0.2, 0);
    } else {
      // Tower / Ramp Overview Cam
      this.camera.position.set(6.5, 9.5, 16.5);
      this.camera.lookAt(px * 0.5 + 3.0, Math.max(3.5, py), 0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
