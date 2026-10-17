import * as THREE from 'three';
import type {
  CameraMode,
  MissionId,
  RigidBodyState,
  ThrusterActivation,
  VehicleId,
  WheelSpec,
} from '../types/simulation.ts';
import {
  HALF_LOOP_RUNWAY_LENGTH,
  HALF_LOOP_TOTAL_LENGTH,
  KICKFLIP_RAMP_END_X,
  KICKFLIP_RAMP_START_X,
  sampleCurvedKickflipRamp,
  sampleHotWheelsHalfLoop,
} from '../physics/rampGeometry.ts';
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
  private orbitAngle = 0.28;
  private smoothedCamPos = new THREE.Vector3(0, 4.8, 15.0);
  private smoothedLookAt = new THREE.Vector3(0, 2.0, 0);

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
    this.buildRoadsterStuntRoadAndHalfLoop();
    this.buildStarshipLaunchPaddockAndCrane();

    const ringGeo = new THREE.TorusGeometry(1.55, 0.04, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
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
    this.scene.fog = new THREE.FogExp2(0x030303, 0.011);

    const ambient = new THREE.AmbientLight(0xd4d4d4, 0.9);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(10, 26, 16);

    const rimLightLeft = new THREE.PointLight(0xffffff, 3.8, 36);
    rimLightLeft.position.set(-10, 5.0, -5);
    const rimLightRight = new THREE.PointLight(0xe5e5e5, 3.6, 36);
    rimLightRight.position.set(10, 8.0, 6);

    this.scene.add(ambient, keyLight, rimLightLeft, rimLightRight);
  }

  /** Builds the Stunt Road Track, Curved Steel Quarter-Pipe Ramp, and Giant C-Shaped Half-Loop */
  private buildRoadsterStuntRoadAndHalfLoop(): void {
    const roadTex = createStuntRoadTexture();
    const carbonTex = createCarbonWeaveTexture();

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.42, metalness: 0.22 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.roadsterArenaGroup.add(floor);

    const grid = new THREE.GridHelper(80, 80, 0x2e2e2e, 0x141414);
    grid.position.y = 0.01;
    this.roadsterArenaGroup.add(grid);

    const stuntStripMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      bumpMap: roadTex,
      bumpScale: 0.015,
      roughness: 0.5,
    });
    const stuntStrip = new THREE.Mesh(new THREE.BoxGeometry(28, 0.04, 5.2), stuntStripMat);
    stuntStrip.position.set(-0.5, 0.02, 0);
    this.roadsterArenaGroup.add(stuntStrip);

    const rampMat = new THREE.MeshStandardMaterial({ color: 0x262626, map: carbonTex, roughness: 0.38, metalness: 0.42 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x737373, metalness: 0.72, roughness: 0.3 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // A. Curved Steel Quarter-Pipe Launch Ramp with Truss Frame (Image 2)
    const kickSteps = 18;
    const kickSpan = KICKFLIP_RAMP_END_X - KICKFLIP_RAMP_START_X;
    const segLen = kickSpan / kickSteps;
    for (let i = 0; i < kickSteps; i++) {
      const xm = KICKFLIP_RAMP_START_X + (i + 0.5) * segLen;
      const sample = sampleCurvedKickflipRamp(xm);
      const slabLen = segLen / Math.cos(sample.tangentAngle) + 0.04;

      const slab = new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.14, 4.4), rampMat);
      slab.position.set(xm, sample.surfaceY - 0.07, 0);
      slab.rotation.z = sample.tangentAngle;
      this.stuntKickerGroup.add(slab);

      for (const zSide of [-2.22, 2.22]) {
        const edgeLed = new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.16, 0.06), ledMat);
        edgeLed.position.set(xm, sample.surfaceY - 0.05, zSide);
        edgeLed.rotation.z = sample.tangentAngle;
        this.stuntKickerGroup.add(edgeLed);
      }

      if (i % 3 === 2 && sample.surfaceY > 0.25) {
        for (const zCol of [-1.95, 1.95]) {
          const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, sample.surfaceY, 0.1), trussMat);
          strut.position.set(xm, sample.surfaceY / 2, zCol);
          this.stuntKickerGroup.add(strut);
        }
      }
    }
    this.roadsterArenaGroup.add(this.stuntKickerGroup);

    // B. Hot-Wheels Giant Overhanging C-Shaped Half-Loop Ramp + Steel Truss Backing (Image 1 & Image 3)
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.45, metalness: 0.18 });

    const loopSegments = 38;
    const loopArcSpan = HALF_LOOP_TOTAL_LENGTH - HALF_LOOP_RUNWAY_LENGTH;
    const ds = loopArcSpan / loopSegments;

    for (let i = 0; i <= loopSegments; i++) {
      const s = HALF_LOOP_RUNWAY_LENGTH + i * ds;
      const sample = sampleHotWheelsHalfLoop(s);

      // Offset slab outward (-normal) by half slab thickness (0.14m) so inner track matches sample.surfaceX/Y
      const slabX = sample.surfaceX - sample.normalX * 0.14;
      const slabY = sample.surfaceY - sample.normalY * 0.14;

      const slab = new THREE.Mesh(new THREE.BoxGeometry(ds * 1.12, 0.28, 4.6), concreteMat);
      slab.position.set(slabX, slabY, 0);
      slab.rotation.z = sample.tangentAngle;
      this.wallRampGroup.add(slab);

      for (const zSide of [-2.32, 2.32]) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(ds * 1.14, 0.32, 0.07), ledMat);
        led.position.set(slabX, slabY, zSide);
        led.rotation.z = sample.tangentAngle;
        this.wallRampGroup.add(led);
      }

      // Outer structural truss ribs hugging the back of the C-Loop
      if (i % 3 === 0) {
        const ribX = sample.surfaceX - sample.normalX * 0.55;
        const ribY = sample.surfaceY - sample.normalY * 0.55;
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 4.7), trussMat);
        rib.position.set(ribX, ribY, 0);
        rib.rotation.z = sample.tangentAngle;
        this.wallRampGroup.add(rib);
      }
    }

    // Rear Vertical Steel Scaffolding Truss Tower supporting the Giant C-Loop (Image 1)
    const trussTowerX = 8.4;
    const towerHeight = 14.8;
    for (const tx of [trussTowerX - 0.7, trussTowerX + 0.7]) {
      for (const tz of [-2.1, 2.1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, towerHeight, 0.16), trussMat);
        col.position.set(tx, towerHeight / 2, tz);
        this.wallRampGroup.add(col);
      }
    }
    for (let y = 2.0; y <= towerHeight; y += 2.4) {
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 4.3), trussMat);
      crossBeam.position.set(trussTowerX, y, 0);
      this.wallRampGroup.add(crossBeam);
    }
    // Top overhanging truss canopy supporting the 142-deg inverted ramp lip
    const topCanopyTruss = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.75, 4.4), trussMat);
    topCanopyTruss.position.set(4.8, 14.7, 0);
    topCanopyTruss.rotation.z = -0.35;
    this.wallRampGroup.add(topCanopyTruss);

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

    for (let t = 0; t < 4; t++) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 4.2, 20), brightSteelMat);
      silo.position.set(-7.5, 2.1, -4.5 + t * 2.4);
      this.starbasePaddockGroup.add(silo);
    }

    const towerGroup = new THREE.Group();
    towerGroup.position.set(-2.35, 0, 0);

    const towerCore = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 22.0, 1.35),
      new THREE.MeshStandardMaterial({
        color: 0x262626,
        metalness: 0.75,
        roughness: 0.3,
        wireframe: true,
      })
    );
    towerCore.position.y = 11.0;
    towerGroup.add(towerCore);

    for (const cx of [-0.65, 0.65]) {
      for (const cz of [-0.65, 0.65]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 22.0, 0.16), steelMat);
        col.position.set(cx, 11.0, cz);
        towerGroup.add(col);
      }
    }

    // Top Hammerhead Cantilever Crane Truss + Mid-Tower Quick-Disconnect (QD) Arm (Image 4)
    const craneMainBeam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.65, 1.45), brightSteelMat);
    craneMainBeam.position.set(1.4, 22.25, 0);
    const craneLedStrip = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.08, 1.5), whiteLedMat);
    craneLedStrip.position.set(1.4, 22.62, 0);
    const qdArm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 0.55), steelMat);
    qdArm.position.set(1.1, 6.2, -0.65);
    towerGroup.add(craneMainBeam, craneLedStrip, qdArm);

    const mastApex = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), steelMat);
    mastApex.position.set(-0.2, 23.4, 0);
    const tieCable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), whiteLedMat);
    tieCable.position.set(1.4, 23.3, 0);
    tieCable.rotation.z = 0.98;
    this.craneHoistCable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.0, 8), brightSteelMat);
    this.craneHoistCable.position.set(2.35, 19.2, 0);
    towerGroup.add(mastApex, tieCable, this.craneHoistCable);

    this.chopstickLeftMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.24), brightSteelMat);
    this.chopstickLeftMesh.position.set(1.5, 5.6, 0.88);
    this.chopstickRightMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.24), brightSteelMat);
    this.chopstickRightMesh.position.set(1.5, 5.6, -0.88);
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
    this.wallRampGroup.position.x = missionId === 'roadster-hover' ? 5.2 : 0;
    this.starbasePaddockGroup.visible = !isRoadster;

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
      const isTwoStageMission =
        missionId === 'starship-launch' || missionId === 'starship-booster-catch';
      const stageSepTime = Math.max(0, -primaryState.velocity.z);
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
        isTwoStageMission,
        primaryState.elapsedTimeSec,
        primaryState.position.y,
        primaryState.attitude.pitch,
        stageSepTime
      );

      const isSeparated = primaryThrusters.hotStageSeparated;
      const armSpread = isTwoStageMission
        ? !isSeparated
          ? primaryState.position.y > 2.2
            ? 0.42
            : 0.08
          : missionId === 'starship-booster-catch'
            ? Math.max(0.0, Math.min(0.38, (primaryState.position.y - 2.4) * 0.055))
            : 0.35
        : Math.max(0, Math.min(0.38, (primaryState.position.y - 3.0) * 0.055));
      this.chopstickLeftMesh.rotation.y = armSpread;
      this.chopstickRightMesh.rotation.y = -armSpread;
      this.craneHoistCable.visible = !isSeparated && primaryState.position.y < 3.5;
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

    const px = primaryState.position.x;
    const py = primaryState.position.y;
    const desiredCam = new THREE.Vector3();
    const desiredLook = new THREE.Vector3(px, Math.max(1.4, py + 0.3), 0);

    if (this.cameraMode === 'orbit') {
      this.orbitAngle += dt * 0.1;
      const dist = missionId === 'roadster-wall-climb' ? 18.5 : isRoadster ? 13.0 : 17.0;
      desiredCam.set(
        px * 0.65 + Math.sin(this.orbitAngle) * dist * 0.25,
        Math.max(2.6, py * 0.75 + 2.4),
        dist
      );
    } else if (this.cameraMode === 'chase') {
      desiredCam.set(px - 7.5, Math.max(2.2, py + 2.5), 7.0);
      desiredLook.set(px + 1.5, py + 0.5, 0);
    } else if (this.cameraMode === 'thruster-cam') {
      desiredCam.set(px - 1.2, Math.max(0.6, py - 1.2), 6.2);
      desiredLook.set(px, py + 0.2, 0);
    } else {
      desiredCam.set(2.0, 7.5, 21.0);
      desiredLook.set(1.5, Math.max(4.5, py * 0.8), 0);
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
