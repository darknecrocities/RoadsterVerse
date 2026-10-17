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
import {
  createCarbonWeaveTexture,
  createPaddockDeckTexture,
  createStuntRoadTexture,
} from './proceduralTextures.ts';

export class ProvingGroundSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly roadsterRig: RoadsterRig;
  private readonly starshipRig: StarshipRig;
  private readonly ghostRoadsters: RoadsterRig[] = [];
  private readonly ghostStarships: StarshipRig[] = [];
  private readonly smokeSystem = new VolumetricPlumeSmokeSystem(220);
  private readonly roadsterArenaGroup = new THREE.Group();
  private readonly stuntKickerGroup = new THREE.Group();
  private readonly wallRampGroup = new THREE.Group();
  private readonly starbasePaddockGroup = new THREE.Group();
  private readonly targetMarker: THREE.Mesh;
  private chopstickLeftMesh!: THREE.Mesh;
  private chopstickRightMesh!: THREE.Mesh;
  private craneHoistCable!: THREE.Mesh;
  private cameraMode: CameraMode = 'orbit';
  private orbitAngle = 0.35;
  private smoothedCamPos = new THREE.Vector3(0, 4.8, 13.5);
  private smoothedLookAt = new THREE.Vector3(0, 1.5, 0);

  constructor(container: HTMLElement) {
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 400);
    this.camera.position.copy(this.smoothedCamPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    container.replaceChildren(this.renderer.domElement);

    this.setupLighting();
    this.buildRoadsterStuntRoadAndWall();
    this.buildStarshipLaunchPaddockAndCrane();

    // Monochrome Target Waypoint Ring
    const ringGeo = new THREE.TorusGeometry(1.65, 0.045, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
    });
    this.targetMarker = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(this.targetMarker);

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
    this.scene.background = new THREE.Color(0x030303);
    this.scene.fog = new THREE.FogExp2(0x030303, 0.013);

    const ambient = new THREE.AmbientLight(0xd4d4d4, 0.85);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(10, 24, 14);

    const rimLightLeft = new THREE.PointLight(0xffffff, 3.8, 32);
    rimLightLeft.position.set(-10, 4.5, -5);
    const rimLightRight = new THREE.PointLight(0xe5e5e5, 3.5, 32);
    rimLightRight.position.set(10, 6.0, 6);

    this.scene.add(ambient, keyLight, rimLightLeft, rimLightRight);
  }

  /**
   * Builds the Tesla Demo Stunt Road:
   * - Textured high-contrast asphalt stunt track with white chevrons
   * - 22-deg Stunt Launch Kicker Ramp (for the 360° Air Kickflip!)
   * - Stunt Landing Deck + Overhead Telemetry Arches
   * - 90-Degree Curved Concrete Mega-Ramp with white LED edge strips
   */
  private buildRoadsterStuntRoadAndWall(): void {
    const roadTex = createStuntRoadTexture();
    const carbonTex = createCarbonWeaveTexture();

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080808,
      roughness: 0.45,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.roadsterArenaGroup.add(floor);

    const grid = new THREE.GridHelper(70, 70, 0x333333, 0x171717);
    grid.position.y = 0.01;
    this.roadsterArenaGroup.add(grid);

    // Textured Tesla Demo Stunt Road Track Strip
    const stuntStripMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      bumpMap: roadTex,
      bumpScale: 0.015,
      roughness: 0.5,
    });
    const stuntStrip = new THREE.Mesh(new THREE.BoxGeometry(26, 0.05, 5.2), stuntStripMat);
    stuntStrip.position.set(-0.5, 0.025, 0);
    this.roadsterArenaGroup.add(stuntStrip);

    // Stunt Road Launch Kicker Ramp (x: -3.8 to -1.2) for the Kickflip Stunt!
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x262626,
      map: carbonTex,
      roughness: 0.4,
      metalness: 0.35,
    });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const kickerRamp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 4.4), rampMat);
    kickerRamp.position.set(-2.5, 0.52, 0);
    kickerRamp.rotation.z = 0.36;
    const kickerLed = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.25, 0.08), ledMat);
    kickerLed.position.set(-2.5, 0.54, 2.22);
    kickerLed.rotation.z = 0.36;
    const kickerLedR = kickerLed.clone();
    kickerLedR.position.z = -2.22;
    this.stuntKickerGroup.add(kickerRamp, kickerLed, kickerLedR);

    // Overhead Stunt Road Telemetry Gantry Arches
    for (const archX of [-7.5, 5.0]) {
      const arch = new THREE.Group();
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.2, 0.18), rampMat);
      pillarL.position.set(archX, 2.6, 2.7);
      const pillarR = pillarL.clone();
      pillarR.position.z = -2.7;
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 5.6), ledMat);
      topBeam.position.set(archX, 5.2, 0);
      arch.add(pillarL, pillarR, topBeam);
      this.stuntKickerGroup.add(arch);
    }
    this.roadsterArenaGroup.add(this.stuntKickerGroup);

    // 90-Degree Curved Concrete Wall Mega-Ramp
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x525252,
      roughness: 0.6,
      metalness: 0.15,
    });
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
      this.wallRampGroup.add(slab);

      const ledL = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.32, 0.08), ledMat);
      ledL.position.set(cx, cy + 0.03, 2.42);
      ledL.rotation.z = angle;
      const ledR = ledL.clone();
      ledR.position.z = -2.42;
      this.wallRampGroup.add(ledL, ledR);
    }

    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 8.0, 4.8), concreteMat);
    upperWall.position.set(12.0, 12.8, 0);
    const upperLedL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.0, 0.08), ledMat);
    upperLedL.position.set(12.0, 12.8, 2.42);
    const upperLedR = upperLedL.clone();
    upperLedR.position.z = -2.42;
    this.wallRampGroup.add(upperWall, upperLedL, upperLedR);

    this.roadsterArenaGroup.add(this.wallRampGroup);
    this.scene.add(this.roadsterArenaGroup);
  }

  /**
   * Builds the SpaceX Orbital Launch Paddock, 6-Pillar Launch Mount, Cryo Tank Farm,
   * Cross-Braced Integration Tower, Top Cantilever Crane Beam, and Articulated Chopstick Arms!
   */
  private buildStarshipLaunchPaddockAndCrane(): void {
    const paddockTex = createPaddockDeckTexture();
    const paddockPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        map: paddockTex,
        bumpMap: paddockTex,
        bumpScale: 0.02,
        roughness: 0.75,
      })
    );
    paddockPlane.rotation.x = -Math.PI / 2;
    this.starbasePaddockGroup.add(paddockPlane);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x404040,
      metalness: 0.78,
      roughness: 0.28,
    });
    const brightSteelMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d4,
      metalness: 0.85,
      roughness: 0.2,
    });
    const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 1. Orbital Launch Paddock Mount (OLM Ring + 6 Heavy Steel Columns + Flame Deflector)
    const olmRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.22, 16, 32), steelMat);
    olmRing.rotation.x = Math.PI / 2;
    olmRing.position.set(0, 1.35, 0);
    this.starbasePaddockGroup.add(olmRing);

    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.35, 12), brightSteelMat);
      leg.position.set(Math.cos(a) * 1.1, 0.67, Math.sin(a) * 1.1);
      this.starbasePaddockGroup.add(leg);
    }

    // 2. Paddock Cryogenic Tank Farm (4 Vertical Stainless Cryo Silos)
    for (let t = 0; t < 4; t++) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 4.2, 20), brightSteelMat);
      silo.position.set(-7.5, 2.1, -4.5 + t * 2.4);
      this.starbasePaddockGroup.add(silo);
    }

    // 3. Tall Cross-Braced Mechazilla Launch Tower + Top Cantilever Crane Beam
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-2.35, 0, 0);

    const towerCore = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 22.0, 1.35),
      new THREE.MeshStandardMaterial({ color: 0x262626, metalness: 0.75, roughness: 0.3, wireframe: true })
    );
    towerCore.position.y = 11.0;
    towerGroup.add(towerCore);

    // 4 Corner Structural Columns of the Tower
    for (const cx of [-0.65, 0.65]) {
      for (const cz of [-0.65, 0.65]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 22.0, 0.16), steelMat);
        col.position.set(cx, 11.0, cz);
        towerGroup.add(col);
      }
    }

    // Heavy Top Cantilever Crane Beam & Pulley Jib extending over the Starship Launch Mount!
    const craneMainBeam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.55, 1.45), brightSteelMat);
    craneMainBeam.position.set(1.4, 22.25, 0);
    const craneLedStrip = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.08, 1.5), whiteLedMat);
    craneLedStrip.position.set(1.4, 22.56, 0);
    towerGroup.add(craneMainBeam, craneLedStrip);

    // Diagonal Crane Tension Tie-Rod Struts above the Cantilever Beam
    const mastApex = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), steelMat);
    mastApex.position.set(-0.2, 23.4, 0);
    const tieCable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), whiteLedMat);
    tieCable.position.set(1.4, 23.3, 0);
    tieCable.rotation.z = 0.98;
    towerGroup.add(mastApex, tieCable);

    // Vertical Crane Hoist Cable dropping from the Cantilever Beam toward the Nosecone
    this.craneHoistCable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 6.0, 8),
      brightSteelMat
    );
    this.craneHoistCable.position.set(2.35, 19.2, 0);
    towerGroup.add(this.craneHoistCable);

    // 4. Articulated Chopstick Catch Arms / Structural Beams on the Tower
    this.chopstickLeftMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.24), brightSteelMat);
    this.chopstickLeftMesh.position.set(1.5, 11.5, 0.92);
    this.chopstickRightMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.24), brightSteelMat);
    this.chopstickRightMesh.position.set(1.5, 11.5, -0.92);
    towerGroup.add(this.chopstickLeftMesh, this.chopstickRightMesh);

    this.starbasePaddockGroup.add(towerGroup);
    this.starbasePaddockGroup.visible = false;
    this.scene.add(this.starbasePaddockGroup);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public setWheelSpec(spec: WheelSpec): void {
    this.roadsterRig.setWheelSpec(spec);
  }

  public triggerWarpTransition(): void {
    this.camera.fov = 66;
    this.camera.updateProjectionMatrix();
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
    this.stuntKickerGroup.visible = missionId === 'roadster-barrel-roll';
    this.wallRampGroup.visible = missionId !== 'roadster-barrel-roll';
    this.starbasePaddockGroup.visible = !isRoadster;

    // Smoothly relax FOV warp back to 48 deg
    if (Math.abs(this.camera.fov - 48) > 0.2) {
      this.camera.fov += (48 - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }

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

      // Animate Paddock Crane Chopstick Arms & Hoist Cable
      const armSpread =
        missionId === 'starship-launch'
          ? primaryState.position.y > 2.5
            ? 0.42
            : 0.0
          : Math.max(0, Math.min(0.38, (primaryState.position.y - 3.6) * 0.065));
      this.chopstickLeftMesh.rotation.y = armSpread;
      this.chopstickRightMesh.rotation.y = -armSpread;
      this.craneHoistCable.visible = primaryState.position.y < 4.0;
    }

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

    const nozzleEmitters = isRoadster
      ? this.roadsterRig.getActiveNozzleEmitters(primaryThrusters)
      : [];
    this.smokeSystem.update(dt, vehicle, primaryState, primaryThrusters, nozzleEmitters);

    // Smooth Physics-Damped Camera Tracking
    const px = primaryState.position.x;
    const py = primaryState.position.y;
    const desiredCam = new THREE.Vector3();
    const desiredLook = new THREE.Vector3(px, Math.max(1.2, py + 0.4), 0);

    if (this.cameraMode === 'orbit') {
      this.orbitAngle += dt * 0.14;
      const dist = isRoadster ? 11.8 : 16.5;
      desiredCam.set(
        px + Math.sin(this.orbitAngle) * dist * 0.35,
        Math.max(2.4, py + 2.0),
        dist
      );
    } else if (this.cameraMode === 'chase') {
      desiredCam.set(px - 7.2, Math.max(2.0, py + 2.4), 6.5);
      desiredLook.set(px + 1.5, py + 0.5, 0);
    } else if (this.cameraMode === 'thruster-cam') {
      desiredCam.set(px - 1.2, Math.max(0.6, py - 1.2), 6.2);
      desiredLook.set(px, py + 0.2, 0);
    } else {
      desiredCam.set(5.5, 9.8, 17.5);
      desiredLook.set(px * 0.5 + 1.5, Math.max(3.5, py), 0);
    }

    const lerpFactor = Math.min(1, dt * 8.5);
    this.smoothedCamPos.lerp(desiredCam, lerpFactor);
    this.smoothedLookAt.lerp(desiredLook, lerpFactor);
    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
