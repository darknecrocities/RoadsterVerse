import * as THREE from 'three';
import type { CameraMode, MissionId, RigidBodyState, ThrusterActivation, VehicleId, WheelSpec } from '../types/simulation.ts';
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
import { createOrbitalPodModel, type OrbitalPodRig } from './orbitalPodModel.ts';
import { VolumetricPlumeSmokeSystem } from './plumeAndSmokeFX.ts';
import { SpacePlumeAndStagingFX, buildSpaceEnvironment, computeBoosterSeparationPhysics } from './spacePlumeEffects.ts';
import { createCarbonWeaveTexture, createStuntRoadTexture } from './proceduralTextures.ts';
import {
  buildArticulatedStarbasePadAndCrane,
  buildObstacleCourseGroup,
  type StarbasePadAndCraneRig,
  updateStarbasePadAndCraneAnimation,
} from './starbaseAndObstacleProps.ts';
import { WeatherEnvironmentFX } from './weatherEnvironmentFX.ts';
import { DebrisAndDestructionFX } from './debrisAndDestructionFX.ts';

export class ProvingGroundSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly roadsterRig: RoadsterRig;
  private readonly starshipRig: StarshipRig;
  private readonly orbitalPodRig: OrbitalPodRig;
  private readonly spaceGroup: THREE.Group;
  private readonly smokeSystem = new VolumetricPlumeSmokeSystem(220);
  private readonly weatherFX = new WeatherEnvironmentFX();
  private readonly debrisFX = new DebrisAndDestructionFX();
  private wasCrashed = false;
  private readonly roadsterArenaGroup = new THREE.Group();
  private readonly stuntKickerGroup = new THREE.Group();
  private readonly wallRampGroup = new THREE.Group();
  private readonly obstacleCourseGroup: THREE.Group;
  private readonly starbaseRig: StarbasePadAndCraneRig;
  private readonly targetMarker: THREE.Mesh;
  private stuntStrip?: THREE.Mesh;
  private readonly wetMaterials: THREE.Material[] = [];
  private cameraMode: CameraMode = 'orbit';
  private orbitAngle = 0.28;
  private smoothedCamPos = new THREE.Vector3(0, 4.8, 15.0);
  private smoothedLookAt = new THREE.Vector3(0, 2.0, 0);

  private readonly spacePlumeFX = new SpacePlumeAndStagingFX();
  private stagingRingTriggered = false;

  constructor(container: HTMLElement) {
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 400);
    this.camera.position.copy(this.smoothedCamPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    container.replaceChildren(this.renderer.domElement);

    this.setupLighting();
    this.obstacleCourseGroup = buildObstacleCourseGroup();
    this.buildRoadsterStuntRoadAndHalfLoop();
    this.starbaseRig = buildArticulatedStarbasePadAndCrane();
    this.scene.add(this.starbaseRig.group);

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
    this.orbitalPodRig = createOrbitalPodModel(false);
    this.spaceGroup = buildSpaceEnvironment();
    this.scene.add(
      this.roadsterRig.root,
      this.starshipRig.root,
      this.orbitalPodRig.root,
      this.spaceGroup,
      this.smokeSystem.group,
      this.spacePlumeFX.group,
      this.weatherFX.group,
      this.debrisFX.group
    );
  }

  private setupLighting(): void {
    this.scene.background = new THREE.Color(0x030303);
    this.scene.fog = new THREE.FogExp2(0x030303, 0.011);
    const ambient = new THREE.AmbientLight(0xd4d4d4, 0.9);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(10, 26, 16);
    const rimLeft = new THREE.PointLight(0xffffff, 3.8, 36);
    rimLeft.position.set(-10, 5.0, -5);
    const rimRight = new THREE.PointLight(0xe5e5e5, 3.6, 36);
    rimRight.position.set(10, 8.0, 6);
    this.scene.add(ambient, keyLight, rimLeft, rimRight);
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

    const stuntStripMat = new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadTex, bumpScale: 0.015, roughness: 0.5 });
    const stuntStrip = new THREE.Mesh(new THREE.BoxGeometry(28, 0.04, 5.2), stuntStripMat);
    stuntStrip.position.set(-0.5, 0.02, 0);
    this.stuntStrip = stuntStrip;
    this.roadsterArenaGroup.add(stuntStrip);

    const rampMat = new THREE.MeshStandardMaterial({ color: 0x262626, map: carbonTex, roughness: 0.38, metalness: 0.42 });
    this.wetMaterials.push(floorMat, stuntStripMat, rampMat);
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
      slab.position.set(xm, sample.surfaceY - 0.07, 0); slab.rotation.z = sample.tangentAngle;
      this.stuntKickerGroup.add(slab);

      for (const zSide of [-2.22, 2.22]) {
        const edgeLed = new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.16, 0.06), ledMat);
        edgeLed.position.set(xm, sample.surfaceY - 0.05, zSide); edgeLed.rotation.z = sample.tangentAngle;
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

    // B. Inverted Overhanging Parabolic Half-Loop Ramp + Steel Truss Backing
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
      slab.position.set(slabX, slabY, 0); slab.rotation.z = sample.tangentAngle;
      this.wallRampGroup.add(slab);

      for (const zSide of [-2.32, 2.32]) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(ds * 1.14, 0.32, 0.07), ledMat);
        led.position.set(slabX, slabY, zSide); led.rotation.z = sample.tangentAngle;
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
        col.position.set(tx, towerHeight / 2, tz); this.wallRampGroup.add(col);
      }
    }
    for (let y = 2.0; y <= towerHeight; y += 2.4) {
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 4.3), trussMat);
      crossBeam.position.set(trussTowerX, y, 0); this.wallRampGroup.add(crossBeam);
    }
    const topCanopyTruss = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.75, 4.4), trussMat);
    topCanopyTruss.position.set(4.8, 14.7, 0); topCanopyTruss.rotation.z = -0.35;
    this.wallRampGroup.add(topCanopyTruss);

    this.roadsterArenaGroup.add(this.wallRampGroup);
    this.roadsterArenaGroup.add(this.obstacleCourseGroup);
    this.scene.add(this.roadsterArenaGroup);
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
    targetPos: { x: number; y: number; z: number },
    dt: number
  ): void {
    const isPodOrbit = missionId === 'starship-pod-orbit';
    const isRoadster = vehicle === 'roadster';
    const py = primaryState.position.y;
    this.roadsterRig.root.visible = isRoadster;
    this.starshipRig.root.visible = !isRoadster && !isPodOrbit;
    this.orbitalPodRig.root.visible = isPodOrbit;
    this.spaceGroup.visible = isPodOrbit ? py > 25.0 : false;
    this.roadsterArenaGroup.visible = isRoadster;

    // Strict exclusive stunt prop visibility — ZERO overlapping ramps or obstacles!
    if (this.stuntStrip) this.stuntStrip.visible = missionId !== 'roadster-obstacle-race';
    this.stuntKickerGroup.visible = missionId === 'roadster-barrel-roll';
    this.wallRampGroup.visible = missionId === 'roadster-wall-climb';
    this.wallRampGroup.position.x = 0;
    this.obstacleCourseGroup.visible = missionId === 'roadster-obstacle-race';
    this.starbaseRig.group.visible = !isRoadster && (!isPodOrbit || py < 45.0);
    this.targetMarker.visible = !isPodOrbit;

    // Dynamic fog adjustment for atmospheric exit into vacuum of space
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = isPodOrbit
        ? Math.max(0, 0.011 * (1 - Math.min(1, Math.max(0, (py - 25.0) / 45.0))))
        : 0.011;
    }

    if (Math.abs(this.camera.fov - 48) > 0.2) {
      this.camera.fov += (48 - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }

    this.targetMarker.position.set(targetPos.x, targetPos.y, targetPos.z);
    this.targetMarker.rotation.z = missionId === 'roadster-wall-climb' ? Math.PI / 2 : 0;

    const isRoadsterMidAir =
      !primaryState.isGrounded && !primaryState.isOnWall && !primaryState.crashed;

    if (isPodOrbit) {
      const isSeparated = py >= 28.0 || primaryState.elapsedTimeSec >= 3.8;
      if (primaryState.elapsedTimeSec < 0.2) this.stagingRingTriggered = false;

      const podY = py + 4.75;
      this.orbitalPodRig.root.position.set(primaryState.position.x, podY, primaryState.position.z);
      this.orbitalPodRig.root.rotation.set(
        primaryState.attitude.roll,
        primaryState.attitude.yaw,
        primaryState.attitude.pitch
      );
      this.orbitalPodRig.updateDeployment(isSeparated ? (primaryState.solarArrayDeployPct ?? 0) : 0);
      this.orbitalPodRig.updateRCS(
        isSeparated ? primaryThrusters : { ...primaryThrusters, podRcsBottom: 0, podRcsLateral: 0 },
        primaryState.elapsedTimeSec
      );

      if (isSeparated) {
        if (!this.stagingRingTriggered) {
          this.spacePlumeFX.triggerStagingVaporRing(new THREE.Vector3(primaryState.position.x, 28.0 + 4.75, primaryState.position.z));
          this.stagingRingTriggered = true;
        }

        const boosterTraj = computeBoosterSeparationPhysics(28.0, primaryState.elapsedTimeSec, 3.8);
        this.starshipRig.root.visible = boosterTraj.isVisible;
        this.starshipRig.root.position.set(primaryState.position.x, boosterTraj.boosterWorldY, primaryState.position.z);
        this.starshipRig.root.rotation.set(boosterTraj.boosterRoll, 0, boosterTraj.boosterPitch);
        this.starshipRig.boosterGroup.visible = true;
        this.starshipRig.boosterGroup.position.set(0, 0, 0);
        this.starshipRig.shipGroup.visible = false;

        if (boosterTraj.plumeOpacity > 0.02) {
          this.starshipRig.boosterPlume.visible = true;
          (this.starshipRig.boosterPlume.material as THREE.MeshBasicMaterial).opacity = boosterTraj.plumeOpacity;
        } else {
          this.starshipRig.boosterPlume.visible = false;
        }
        this.starshipRig.plumeLight.intensity = boosterTraj.plumeOpacity * 4.5;

        const rcsAct = (primaryThrusters.podRcsBottom ?? 0) + (primaryThrusters.podRcsLateral ?? 0);
        if (rcsAct > 0.05) {
          this.spacePlumeFX.spawnVacuumRcsPuff(this.orbitalPodRig.root.position, rcsAct);
        }
      } else {
        this.starshipRig.root.visible = true;
        this.starshipRig.root.position.set(primaryState.position.x, py, primaryState.position.z);
        this.starshipRig.root.rotation.set(
          primaryState.attitude.roll,
          primaryState.attitude.yaw,
          primaryState.attitude.pitch
        );
        this.starshipRig.boosterGroup.visible = true;
        this.starshipRig.boosterGroup.position.set(0, 0, 0);
        this.starshipRig.shipGroup.visible = false;
        this.starshipRig.updateStarship(
          primaryThrusters,
          true,
          primaryState.elapsedTimeSec,
          py,
          primaryState.attitude.pitch,
          0
        );
        updateStarbasePadAndCraneAnimation(this.starbaseRig, missionId, primaryState, primaryThrusters);
      }

      this.spacePlumeFX.update(
        dt,
        podY,
        isSeparated,
        primaryThrusters.raptorThrottle,
        this.orbitalPodRig.root.position,
        primaryState.elapsedTimeSec
      );
    } else if (isRoadster) {
      this.roadsterRig.root.position.set(
        primaryState.position.x,
        primaryState.position.y + (primaryState.crashed ? 0.12 : 0),
        primaryState.position.z
      );
      this.roadsterRig.root.rotation.set(
        primaryState.crashed ? Math.PI * 0.88 : primaryState.attitude.roll,
        primaryState.crashed ? 0.42 : primaryState.attitude.yaw,
        primaryState.crashed ? -0.28 : primaryState.attitude.pitch
      );
      this.roadsterRig.wheelsGroup.visible = !primaryState.crashed;
      this.roadsterRig.updateThrusters(
        primaryThrusters,
        primaryState.elapsedTimeSec,
        isRoadsterMidAir
      );
    } else {
      const isTwoStageMission =
        missionId === 'starship-launch' || missionId === 'starship-booster-catch';
      const stageSepTime = Math.max(0, -primaryState.velocity.z);
      this.starshipRig.root.position.set(primaryState.position.x, primaryState.position.y, primaryState.position.z);
      this.starshipRig.root.rotation.set(primaryState.attitude.roll, primaryState.attitude.yaw, primaryState.attitude.pitch);
      this.starshipRig.updateStarship(
        primaryThrusters,
        isTwoStageMission,
        primaryState.elapsedTimeSec,
        primaryState.position.y,
        primaryState.attitude.pitch,
        stageSepTime
      );

      updateStarbasePadAndCraneAnimation(this.starbaseRig, missionId, primaryState, primaryThrusters);
    }

    const nozzleEmitters = isRoadster ? this.roadsterRig.getActiveNozzleEmitters(primaryThrusters, isRoadsterMidAir) : [];
    this.smokeSystem.update(dt, vehicle, primaryState, primaryThrusters, nozzleEmitters);
    if (primaryState.weather) {
      this.weatherFX.update(
        dt,
        primaryState.weather,
        this.camera.position,
        this.scene.fog,
        isRoadster ? this.roadsterRig.root.position : undefined,
        Math.hypot(primaryState.velocity.x, primaryState.velocity.z),
        primaryState.isGrounded
      );
      this.weatherFX.updateMaterialWetness(this.wetMaterials, primaryState.weather.roadWetnessPct);
    }
    if (primaryState.crashed !== this.wasCrashed) {
      this.wasCrashed = primaryState.crashed;
      if (this.wasCrashed) this.debrisFX.triggerCrash(vehicle, primaryState.position, primaryState.debrisField ?? [], primaryState.impactEnergyJoules ?? 50000);
      else this.debrisFX.reset();
    }
    this.debrisFX.update(dt, primaryState.debrisField ?? []);

    const px = primaryState.position.x;
    const pz = isRoadster ? primaryState.position.z * 0.45 : 0;
    const desiredCam = new THREE.Vector3();
    const desiredLook = new THREE.Vector3(px, Math.max(1.4, py + 0.3), pz);

    if (isPodOrbit) {
      const podY = py + 4.75;
      if (py < 28.0) {
        desiredCam.set(px - 14.0, Math.max(3.2, py * 0.65 + 3.0), 18.0);
        desiredLook.set(px, py + 2.5, 0);
      } else if (py < 75.0) {
        desiredCam.set(px - 15.0, podY + 3.5, 15.0);
        desiredLook.set(px, podY + 0.5, 0);
      } else {
        this.orbitAngle += dt * 0.12;
        desiredCam.set(px * 0.35 + Math.sin(this.orbitAngle) * 9.5, podY + 2.2, Math.cos(this.orbitAngle) * 9.5);
        desiredLook.set(px, podY + 0.4, pz);
      }
    } else if (missionId === 'roadster-obstacle-race') {
      if (this.cameraMode === 'chase') {
        desiredCam.set(px - 14.0, Math.max(2.6, py + 3.2), pz * 0.4 + 5.5);
        desiredLook.set(px + 8.0, py + 0.6, pz);
      } else if (this.cameraMode === 'thruster-cam') {
        desiredCam.set(px - 3.2, Math.max(0.6, py + 0.5), pz + 3.5);
        desiredLook.set(px + 4.5, py + 0.2, pz);
      } else if (this.cameraMode === 'tower-cam') {
        desiredCam.set(px - 22.0, 14.0, pz + 18.0);
        desiredLook.set(px + 24.0, py, pz);
      } else {
        // Dynamic Orbit tracking along the 10km run
        this.orbitAngle += dt * 0.08;
        desiredCam.set(
          px - 16.0 + Math.sin(this.orbitAngle) * 5.0,
          Math.max(3.2, py + 3.5),
          pz + Math.cos(this.orbitAngle) * 14.0
        );
        desiredLook.set(px + 6.0, py + 0.6, pz);
      }
    } else if (this.cameraMode === 'orbit') {
      this.orbitAngle += dt * 0.1;
      const dist = missionId === 'roadster-wall-climb' ? 18.5 : isRoadster ? 13.0 : 17.0;
      desiredCam.set(
        px * 0.65 + Math.sin(this.orbitAngle) * dist * 0.25,
        Math.max(2.6, py * 0.75 + 2.4),
        dist
      );
    } else if (this.cameraMode === 'chase') {
      desiredCam.set(px - 7.5, Math.max(2.2, py + 2.5), 7.0);
      desiredLook.set(px + 1.5, py + 0.5, pz);
    } else if (this.cameraMode === 'thruster-cam') {
      desiredCam.set(px - 1.2, Math.max(0.6, py - 1.2), 6.2);
      desiredLook.set(px, py + 0.2, pz);
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
    this.weatherFX.dispose();
    this.debrisFX.reset();
    this.renderer.dispose();
  }
}
