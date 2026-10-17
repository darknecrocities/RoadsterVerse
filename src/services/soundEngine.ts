import type { RigidBodyState, ThrusterActivation, VehicleId } from '../types/simulation.ts';

export class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // 1. Cold-Gas Compressed Air Nozzle Expulsion (10,000 PSI COPV)
  private coldGasGain: GainNode | null = null;
  private coldGasFilter: BiquadFilterNode | null = null;

  // 2. Roadster Electric AWD Inverter & Motor Whine
  private motorOsc: OscillatorNode | null = null;
  private motorHarmonicOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;

  // 3. Roadster Tire Surface Roll Friction
  private roadGain: GainNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;

  // 4. Starship 33-Raptor Staged Combustion Engines
  private raptorOsc: OscillatorNode | null = null;
  private raptorSubOsc: OscillatorNode | null = null;
  private raptorGain: GainNode | null = null;
  private raptorNoiseGain: GainNode | null = null;
  private raptorFilter: BiquadFilterNode | null = null;

  private enabled = false;
  private lastCrashTime = 0;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  public isEnabled(): boolean {
    return this.enabled;
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn(this.enabled);
    }
  }

  public toggle(enable?: boolean): boolean {
    this.enabled = enable ?? !this.enabled;
    if (this.enabled && !this.ctx) {
      this.initAudioGraph();
    }
    if (this.ctx) {
      if (this.enabled && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      } else if (!this.enabled) {
        this.silenceAll();
      }
    }
    this.notify();
    return this.enabled;
  }

  private silenceAll(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.coldGasGain) this.coldGasGain.gain.setTargetAtTime(0, now, 0.04);
    if (this.motorGain) this.motorGain.gain.setTargetAtTime(0, now, 0.04);
    if (this.roadGain) this.roadGain.gain.setTargetAtTime(0, now, 0.04);
    if (this.raptorGain) this.raptorGain.gain.setTargetAtTime(0, now, 0.04);
    if (this.raptorNoiseGain) this.raptorNoiseGain.gain.setTargetAtTime(0, now, 0.04);
  }

  private initAudioGraph(): void {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(this.ctx.destination);

    // Shared 2-second white-noise loop buffer for jet turbulence & tire roll
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // 1. Cold-Gas Compressed Air Nozzle Expulsion (Bandpass 1400Hz)
    const coldGasSource = this.ctx.createBufferSource();
    coldGasSource.buffer = noiseBuffer;
    coldGasSource.loop = true;

    this.coldGasFilter = this.ctx.createBiquadFilter();
    this.coldGasFilter.type = 'bandpass';
    this.coldGasFilter.frequency.value = 1600;
    this.coldGasFilter.Q.value = 2.2;

    this.coldGasGain = this.ctx.createGain();
    this.coldGasGain.gain.value = 0;

    coldGasSource.connect(this.coldGasFilter);
    this.coldGasFilter.connect(this.coldGasGain);
    this.coldGasGain.connect(this.masterGain);
    coldGasSource.start();

    // 2. Roadster Electric Stator / Inverter Whine
    this.motorOsc = this.ctx.createOscillator();
    this.motorOsc.type = 'triangle';
    this.motorOsc.frequency.value = 240;

    this.motorHarmonicOsc = this.ctx.createOscillator();
    this.motorHarmonicOsc.type = 'sine';
    this.motorHarmonicOsc.frequency.value = 600;

    const motorFilter = this.ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 2800;

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.value = 0;

    this.motorOsc.connect(motorFilter);
    this.motorHarmonicOsc.connect(motorFilter);
    motorFilter.connect(this.motorGain);
    this.motorGain.connect(this.masterGain);
    this.motorOsc.start();
    this.motorHarmonicOsc.start();

    // 3. Roadster Tire Surface Roll Rumble
    const roadSource = this.ctx.createBufferSource();
    roadSource.buffer = noiseBuffer;
    roadSource.loop = true;

    this.roadFilter = this.ctx.createBiquadFilter();
    this.roadFilter.type = 'lowpass';
    this.roadFilter.frequency.value = 160;

    this.roadGain = this.ctx.createGain();
    this.roadGain.gain.value = 0;

    roadSource.connect(this.roadFilter);
    this.roadFilter.connect(this.roadGain);
    this.roadGain.connect(this.masterGain);
    roadSource.start();

    // 4. Starship 33 Raptor Engine Acoustic Rumble & Shockwave
    this.raptorOsc = this.ctx.createOscillator();
    this.raptorOsc.type = 'sawtooth';
    this.raptorOsc.frequency.value = 52;

    this.raptorSubOsc = this.ctx.createOscillator();
    this.raptorSubOsc.type = 'square';
    this.raptorSubOsc.frequency.value = 38;

    this.raptorFilter = this.ctx.createBiquadFilter();
    this.raptorFilter.type = 'lowpass';
    this.raptorFilter.frequency.value = 240;

    this.raptorGain = this.ctx.createGain();
    this.raptorGain.gain.value = 0;

    this.raptorOsc.connect(this.raptorFilter);
    this.raptorSubOsc.connect(this.raptorFilter);
    this.raptorFilter.connect(this.raptorGain);
    this.raptorGain.connect(this.masterGain);
    this.raptorOsc.start();
    this.raptorSubOsc.start();

    // Raptor atmospheric tearing shear noise
    const raptorNoiseSource = this.ctx.createBufferSource();
    raptorNoiseSource.buffer = noiseBuffer;
    raptorNoiseSource.loop = true;

    const raptorNoiseFilter = this.ctx.createBiquadFilter();
    raptorNoiseFilter.type = 'bandpass';
    raptorNoiseFilter.frequency.value = 520;
    raptorNoiseFilter.Q.value = 1.4;

    this.raptorNoiseGain = this.ctx.createGain();
    this.raptorNoiseGain.gain.value = 0;

    raptorNoiseSource.connect(raptorNoiseFilter);
    raptorNoiseFilter.connect(this.raptorNoiseGain);
    this.raptorNoiseGain.connect(this.masterGain);
    raptorNoiseSource.start();
  }

  public update(vehicle: VehicleId, thrusters: ThrusterActivation, state?: RigidBodyState): void {
    if (!this.enabled || !this.ctx || this.ctx.state === 'suspended') {
      return;
    }
    const now = this.ctx.currentTime;

    const speedMps = state
      ? Math.sqrt(
          state.velocity.x * state.velocity.x +
            state.velocity.y * state.velocity.y +
            state.velocity.z * state.velocity.z
        )
      : 0;

    if (vehicle === 'roadster') {
      // Roadster 10,000 PSI Cold-Gas Nozzle Expulsion (Lift + Rocker + Dual Rear Boosters)
      const totalColdGas =
        (thrusters.frontLeftLift +
          thrusters.frontRightLift +
          thrusters.rearLeftLift +
          thrusters.rearRightLift +
          thrusters.lateralLeft +
          thrusters.lateralRight +
          thrusters.rearBoost * 1.5) /
        5.5;
      const clampedGas = Math.min(1.0, Math.max(0, totalColdGas));

      if (this.coldGasFilter && this.coldGasGain) {
        this.coldGasFilter.frequency.setTargetAtTime(1200 + clampedGas * 1800, now, 0.04);
        this.coldGasGain.gain.setTargetAtTime(clampedGas * 0.22, now, 0.03);
      }

      // Roadster Electric AWD Inverter Whine
      if (this.motorOsc && this.motorHarmonicOsc && this.motorGain) {
        const motorFreq = 220 + Math.min(2200, speedMps * 34);
        this.motorOsc.frequency.setTargetAtTime(motorFreq, now, 0.05);
        this.motorHarmonicOsc.frequency.setTargetAtTime(motorFreq * 2.4, now, 0.05);
        const targetWhine = Math.min(0.12, (speedMps / 60) * 0.12);
        this.motorGain.gain.setTargetAtTime(targetWhine, now, 0.06);
      }

      // Roadster Tire Road Friction (Only when tires touch road or loop surface; silent in air!)
      if (this.roadGain && this.roadFilter && state) {
        const isTouchingSurface = (state.isGrounded || state.isOnWall) && !state.crashed;
        const targetRoad = isTouchingSurface ? Math.min(0.09, (speedMps / 55) * 0.09) : 0;
        this.roadFilter.frequency.setTargetAtTime(140 + Math.min(260, speedMps * 4), now, 0.06);
        this.roadGain.gain.setTargetAtTime(targetRoad, now, 0.04);
      }

      // Silence Starship Raptor nodes
      if (this.raptorGain) this.raptorGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.raptorNoiseGain) this.raptorNoiseGain.gain.setTargetAtTime(0, now, 0.05);
    } else {
      // Starship 33 Raptor Engine Throttle & Acoustic Shockwave
      const raptor = Math.max(0, Math.min(1.0, thrusters.raptorThrottle));

      if (this.raptorGain && this.raptorNoiseGain && this.raptorFilter && this.raptorOsc) {
        this.raptorOsc.frequency.setTargetAtTime(46 + raptor * 30, now, 0.05);
        this.raptorFilter.frequency.setTargetAtTime(220 + raptor * 640, now, 0.05);
        this.raptorGain.gain.setTargetAtTime(raptor * 0.24, now, 0.04);
        this.raptorNoiseGain.gain.setTargetAtTime(raptor * 0.18, now, 0.04);
      }

      // Starship Hot-Gas Attitude Jets
      const attitudeGas =
        (Math.abs(thrusters.gimbalPitch) +
          Math.abs(thrusters.gimbalYaw) +
          thrusters.flapFrontLeft * 0.4 +
          thrusters.flapFrontRight * 0.4) /
        2.0;
      const clampedAttitude = Math.min(0.5, attitudeGas);
      if (this.coldGasGain && this.coldGasFilter) {
        this.coldGasFilter.frequency.setTargetAtTime(900 + clampedAttitude * 1200, now, 0.05);
        this.coldGasGain.gain.setTargetAtTime(clampedAttitude * 0.08, now, 0.04);
      }

      // Silence Roadster motor and road nodes
      if (this.motorGain) this.motorGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.roadGain) this.roadGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  /**
   * Synthesizes physical impact crunch & explosion fireball roar on crash event
   */
  public triggerCrash(vehicle: VehicleId): void {
    if (!this.enabled || !this.ctx || this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    if (now - this.lastCrashTime < 1.0) return;
    this.lastCrashTime = now;

    // 1. Heavy Sub-Bass Impact Boom (rapid descending pitch)
    const boomOsc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(vehicle === 'starship' ? 180 : 140, now);
    boomOsc.frequency.exponentialRampToValueAtTime(26, now + 0.65);

    boomGain.gain.setValueAtTime(0.48, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    boomOsc.connect(boomGain);
    boomGain.connect(this.masterGain!);
    boomOsc.start(now);
    boomOsc.stop(now + 0.75);

    // 2. High-Energy Explosion Fireball Noise Burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.9);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const crashFilter = this.ctx.createBiquadFilter();
    crashFilter.type = 'lowpass';
    crashFilter.frequency.setValueAtTime(1200, now);
    crashFilter.frequency.exponentialRampToValueAtTime(180, now + 0.85);

    const crashNoiseGain = this.ctx.createGain();
    crashNoiseGain.gain.setValueAtTime(0.38, now);
    crashNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    noiseSource.connect(crashFilter);
    crashFilter.connect(crashNoiseGain);
    crashNoiseGain.connect(this.masterGain!);
    noiseSource.start(now);
    noiseSource.stop(now + 0.9);

    // 3. Composite Carbon / Metallic Shattering Crunch
    const crunchOsc = this.ctx.createOscillator();
    const crunchGain = this.ctx.createGain();
    crunchOsc.type = 'sawtooth';
    crunchOsc.frequency.setValueAtTime(vehicle === 'starship' ? 320 : 540, now);
    crunchOsc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

    crunchGain.gain.setValueAtTime(0.24, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    crunchOsc.connect(crunchGain);
    crunchGain.connect(this.masterGain!);
    crunchOsc.start(now);
    crunchOsc.stop(now + 0.4);
  }
}

export const soundEngine = new ProceduralSoundEngine();
