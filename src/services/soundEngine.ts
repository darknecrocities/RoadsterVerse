import type { ThrusterActivation, VehicleId } from '../types/simulation.ts';

export class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private enabled = false;

  public toggle(enable?: boolean): boolean {
    this.enabled = enable ?? !this.enabled;
    if (this.enabled && !this.ctx) {
      this.initAudioGraph();
    }
    if (this.ctx) {
      if (this.enabled && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      } else if (!this.enabled) {
        if (this.noiseGain) this.noiseGain.gain.value = 0;
        if (this.rumbleGain) this.rumbleGain.gain.value = 0;
      }
    }
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initAudioGraph(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // 1. White-noise buffer for 10,000 PSI Cold-Gas COPV supersonic hiss
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'bandpass';
    this.filterNode.frequency.value = 1400;
    this.filterNode.Q.value = 1.8;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;

    noiseSource.connect(this.filterNode);
    this.filterNode.connect(this.noiseGain);
    this.noiseGain.connect(this.ctx.destination);
    noiseSource.start();

    // 2. Low-frequency sawtooth oscillator for 33-Raptor acoustic crackle
    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'sawtooth';
    this.rumbleOsc.frequency.value = 52;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 140;

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;

    this.rumbleOsc.connect(lowpass);
    lowpass.connect(this.rumbleGain);
    this.rumbleGain.connect(this.ctx.destination);
    this.rumbleOsc.start();
  }

  public update(vehicle: VehicleId, thrusters: ThrusterActivation): void {
    if (!this.enabled || !this.ctx || !this.noiseGain || !this.rumbleGain || !this.filterNode) {
      return;
    }

    if (vehicle === 'roadster') {
      const totalColdGas =
        (thrusters.frontLeftLift +
          thrusters.frontRightLift +
          thrusters.rearLeftLift +
          thrusters.rearRightLift +
          thrusters.lateralLeft +
          thrusters.lateralRight +
          thrusters.rearBoost) /
        5;
      const clamped = Math.min(1, totalColdGas);
      this.filterNode.frequency.setTargetAtTime(1100 + clamped * 1600, this.ctx.currentTime, 0.05);
      this.noiseGain.gain.setTargetAtTime(clamped * 0.14, this.ctx.currentTime, 0.04);
      this.rumbleGain.gain.setTargetAtTime(clamped * 0.04, this.ctx.currentTime, 0.05);
    } else {
      const raptor = thrusters.raptorThrottle;
      this.filterNode.frequency.setTargetAtTime(420 + raptor * 680, this.ctx.currentTime, 0.05);
      this.noiseGain.gain.setTargetAtTime(raptor * 0.12, this.ctx.currentTime, 0.04);
      this.rumbleGain.gain.setTargetAtTime(raptor * 0.16, this.ctx.currentTime, 0.04);
    }
  }
}
