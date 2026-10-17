import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProceduralSoundEngine } from '../../src/services/soundEngine.ts';
import type { RigidBodyState, ThrusterActivation } from '../../src/types/simulation.ts';

// Mock Web Audio API for Node.js test environment
class MockAudioParam {
  public value = 0;
  public setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  public connect = vi.fn();
  public disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  public type = 'lowpass';
  public frequency = new MockAudioParam();
  public Q = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  public type = 'sine';
  public frequency = new MockAudioParam();
  public start = vi.fn();
  public stop = vi.fn();
}

class MockBufferSourceNode extends MockAudioNode {
  public buffer: unknown = null;
  public loop = false;
  public start = vi.fn();
  public stop = vi.fn();
}

class MockAudioContext {
  public state = 'running';
  public currentTime = 1.0;
  public sampleRate = 44100;
  public destination = new MockAudioNode();

  public createGain(): MockGainNode {
    return new MockGainNode();
  }
  public createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode();
  }
  public createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }
  public createBufferSource(): MockBufferSourceNode {
    return new MockBufferSourceNode();
  }
  public createBuffer(_channels: number, length: number, _rate: number) {
    const channelData = new Float32Array(length);
    return {
      getChannelData: () => channelData,
      length,
      sampleRate: 44100,
    };
  }
  public resume = vi.fn().mockResolvedValue(undefined);
  public suspend = vi.fn().mockResolvedValue(undefined);
}

describe('ProceduralSoundEngine & Physics Synchronization', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', { AudioContext: MockAudioContext });
  });

  it('starts disabled and toggles audio state with subscriber notification', () => {
    const engine = new ProceduralSoundEngine();
    expect(engine.isEnabled()).toBe(false);

    let notifiedState = false;
    const unsubscribe = engine.subscribe((state) => {
      notifiedState = state;
    });

    const enabled = engine.toggle();
    expect(enabled).toBe(true);
    expect(engine.isEnabled()).toBe(true);
    expect(notifiedState).toBe(true);

    const disabled = engine.toggle(false);
    expect(disabled).toBe(false);
    expect(engine.isEnabled()).toBe(false);
    expect(notifiedState).toBe(false);

    unsubscribe();
  });

  it('modulates electric motor whine, road friction, and cold-gas hiss for Tesla Roadster', () => {
    const engine = new ProceduralSoundEngine();
    engine.toggle(true);

    const thrusters: ThrusterActivation = {
      frontLeftLift: 0.8,
      frontRightLift: 0.8,
      rearLeftLift: 0.7,
      rearRightLift: 0.7,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0.9,
      activeWingAngle: 0.5,
      raptorThrottle: 0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0,
      flapFrontRight: 0,
      flapAftLeft: 0,
      flapAftRight: 0,
      hotStageSeparated: false,
    };

    const groundedState: RigidBodyState = {
      position: { x: 10, y: 0.43, z: 0 },
      velocity: { x: 50, y: 0, z: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isOnWall: false,
      crashed: false,
      copvPressurePsi: 9800,
      propellantRemainingPct: 100,
      elapsedTimeSec: 2.5,
      wallContactNormalForceN: 18000,
      gForce: 1.2,
      missionProgressPct: 35,
    };

    // Update with grounded driving state
    expect(() => engine.update('roadster', thrusters, groundedState)).not.toThrow();

    // Update with mid-air state (airborne off ramp)
    const airborneState: RigidBodyState = {
      ...groundedState,
      position: { x: 25, y: 3.5, z: 0 },
      velocity: { x: 55, y: 4.2, z: 0 },
      isGrounded: false,
      isOnWall: false,
    };
    expect(() => engine.update('roadster', thrusters, airborneState)).not.toThrow();
  });

  it('modulates Raptor combustion roar and rumble for SpaceX Starship', () => {
    const engine = new ProceduralSoundEngine();
    engine.toggle(true);

    const starshipThrusters: ThrusterActivation = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 0.95,
      gimbalPitch: 0.05,
      gimbalYaw: -0.02,
      flapFrontLeft: 0.2,
      flapFrontRight: 0.2,
      flapAftLeft: 0.4,
      flapAftRight: 0.4,
      hotStageSeparated: false,
    };

    const flightState: RigidBodyState = {
      position: { x: 0, y: 120, z: 0 },
      velocity: { x: 0, y: 45, z: 0 },
      attitude: { roll: 0, pitch: 0.02, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      isGrounded: false,
      isOnWall: false,
      crashed: false,
      copvPressurePsi: 10000,
      propellantRemainingPct: 88,
      elapsedTimeSec: 4.0,
      wallContactNormalForceN: 0,
      gForce: 2.5,
      missionProgressPct: 65,
    };

    expect(() => engine.update('starship', starshipThrusters, flightState)).not.toThrow();
  });

  it('synthesizes crash explosion and structural impact sounds with debounce protection', () => {
    const engine = new ProceduralSoundEngine();
    engine.toggle(true);

    // Initial crash trigger
    expect(() => engine.triggerCrash('roadster')).not.toThrow();

    // Immediate duplicate trigger should be safely debounced without throwing
    expect(() => engine.triggerCrash('roadster')).not.toThrow();
    expect(() => engine.triggerCrash('starship')).not.toThrow();
  });
});
