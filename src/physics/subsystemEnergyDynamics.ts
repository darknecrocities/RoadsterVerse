import type {
  SubsystemHealthState,
  ThrusterActivation,
  VehicleEnergyState,
  VehicleId,
  Vector3D,
} from '../types/simulation.ts';

// 2026 Tesla Roadster Authentic Energy & Storage Parameters
export const ROADSTER_BATTERY_KWH = 200.0;
export const ROADSTER_BATTERY_VOLTAGE_NOMINAL = 800.0;
export const ROADSTER_BATTERY_MASS_KG = 820.0;
export const ROADSTER_DRY_MASS_KG = 1786.5; // Curb mass without gas propellant = 1,850 - 63.5 = 1,786.5 kg
export const ROADSTER_COPV_CAPACITY_LITERS = 140.0; // 2x 70L composite overwrapped pressure vessels
export const ROADSTER_COPV_MAX_PRESSURE_BAR = 700.0; // ~10,152 PSI
export const ROADSTER_COPV_MAX_PRESSURE_PSI = 10152.0;
export const ROADSTER_COPV_N2_MASS_KG = 63.5; // 140L of N2 at 700 bar ~ 63.5 kg
export const ROADSTER_MAX_MOTOR_KW = 1250.0; // Tri-motor AWD peak mechanical power (~1,675 hp)

// SpaceX Starship Authentic Energy & Storage Parameters
export const STARSHIP_LANDING_PROPELLANT_TONS = 30.0;
export const STARSHIP_AVIONICS_BATTERY_KWH = 400.0;

export function createInitialEnergyState(
  vehicle: VehicleId,
  initialCopvPsi = ROADSTER_COPV_MAX_PRESSURE_PSI
): VehicleEnergyState {
  if (vehicle === 'roadster') {
    const pressFraction = Math.min(1.0, Math.max(0.1, initialCopvPsi / ROADSTER_COPV_MAX_PRESSURE_PSI));
    const gasMass = ROADSTER_COPV_N2_MASS_KG * pressFraction;
    const bar = initialCopvPsi * 0.0689476;

    return {
      batteryKwhRemaining: ROADSTER_BATTERY_KWH,
      batterySocPct: 100.0,
      batteryVoltageV: ROADSTER_BATTERY_VOLTAGE_NOMINAL,
      batteryDrawKw: 0,
      batteryTempC: 30.0,
      copvPressureBar: Number(bar.toFixed(1)),
      copvPropellantMassKg: Number(gasMass.toFixed(2)),
      copvMassFlowKgS: 0,
      centerOfGravityOffsetXM: 0,
      totalVehicleMassKg: Number((ROADSTER_DRY_MASS_KG + gasMass).toFixed(2)),
    };
  }

  // Starship / Orbital Pod:
  return {
    batteryKwhRemaining: STARSHIP_AVIONICS_BATTERY_KWH,
    batterySocPct: 100.0,
    batteryVoltageV: 800.0,
    batteryDrawKw: 15.0,
    batteryTempC: 25.0,
    copvPressureBar: 350.0,
    copvPropellantMassKg: STARSHIP_LANDING_PROPELLANT_TONS * 1000.0,
    copvMassFlowKgS: 0,
    centerOfGravityOffsetXM: 0,
    totalVehicleMassKg: 100000.0 + STARSHIP_LANDING_PROPELLANT_TONS * 1000.0,
  };
}

export function createInitialSubsystemHealth(): SubsystemHealthState {
  return {
    batteryHealthPct: 100.0,
    copvHealthPct: 100.0,
    aeroControlHealthPct: 100.0,
    tractionHealthPct: 100.0,
    leakVentingRateKgS: 0,
    parasiticTorqueNm: { x: 0, y: 0, z: 0 },
    structuralStressG: 1.0,
  };
}

/**
 * Steps the authentic battery thermodynamics, high-pressure COPV blowdown,
 * and structural damage leak dynamics.
 */
export function stepSubsystemEnergyDynamics(
  energy: VehicleEnergyState,
  health: SubsystemHealthState,
  thrusters: ThrusterActivation,
  driveThrottle: number,
  vehicle: VehicleId,
  dt: number,
  isGrounded: boolean
): { nextEnergy: VehicleEnergyState; nextHealth: SubsystemHealthState } {
  const nextEnergy: VehicleEnergyState = { ...energy };
  const nextHealth: SubsystemHealthState = {
    ...health,
    parasiticTorqueNm: { ...health.parasiticTorqueNm },
  };

  if (vehicle === 'roadster') {
    // 1. Electric AWD Battery Draw & Thermodynamics:
    const baseDrawKw = 2.4; // Avionics, active cooling pumps, sensors
    const motorDrawKw = Math.max(0, driveThrottle) * ROADSTER_MAX_MOTOR_KW * (health.batteryHealthPct / 100);
    const thrusterSolenoidKw =
      (thrusters.frontLeftLift +
        thrusters.frontRightLift +
        thrusters.rearLeftLift +
        thrusters.rearRightLift +
        thrusters.lateralLeft +
        thrusters.lateralRight +
        thrusters.rearBoost) *
      1.8;

    const totalDrawKw = baseDrawKw + motorDrawKw + thrusterSolenoidKw;
    nextEnergy.batteryDrawKw = Number(totalDrawKw.toFixed(1));

    // Battery pack voltage sag under heavy amp draw:
    const currentAmps = (totalDrawKw * 1000) / Math.max(400, energy.batteryVoltageV);
    const internalResistanceOhms = 0.045 + (1.0 - health.batteryHealthPct / 100) * 0.12;
    const voltageSag = currentAmps * internalResistanceOhms;
    const ocv = 750 + (energy.batterySocPct / 100) * 80;
    nextEnergy.batteryVoltageV = Math.max(620, Number((ocv - voltageSag).toFixed(1)));

    // Energy drain in kWh:
    const kwhDrained = (totalDrawKw * (dt / 3600));
    nextEnergy.batteryKwhRemaining = Math.max(0, nextEnergy.batteryKwhRemaining - kwhDrained);
    nextEnergy.batterySocPct = Math.max(
      0,
      Number(((nextEnergy.batteryKwhRemaining / ROADSTER_BATTERY_KWH) * 100).toFixed(1))
    );

    // Battery Pack Thermodynamics: I^2 * R heating vs active chiller radiator cooling
    const heatGenWatts = currentAmps * currentAmps * internalResistanceOhms;
    const coolingPowerWatts = nextEnergy.batteryTempC > 45 ? 42000 : 12000;
    const netHeatWatts = heatGenWatts - coolingPowerWatts;
    // Thermal mass of 820 kg pack: c_p ~ 920 J/(kg*K)
    const deltaTempC = (netHeatWatts * dt) / (ROADSTER_BATTERY_MASS_KG * 920);
    nextEnergy.batteryTempC = Math.max(
      22.0,
      Math.min(135.0, Number((nextEnergy.batteryTempC + deltaTempC).toFixed(2)))
    );

    // 2. High-Pressure 700-Bar Cold-Gas COPV Tank Blowdown:
    const thrusterDuty =
      thrusters.frontLeftLift +
      thrusters.frontRightLift +
      thrusters.rearLeftLift +
      thrusters.rearRightLift +
      thrusters.lateralLeft * 1.5 +
      thrusters.lateralRight * 1.5 +
      thrusters.rearBoost * 2.2;

    const maxThrusterMassFlowKgS = 4.2; // Peak N2 mass flow when all nozzles wide open
    const intentionalMassFlow = (thrusterDuty / 7.0) * maxThrusterMassFlowKgS;

    // Puncture leak mass flow:
    const leakFactor = Math.max(0, (100 - health.copvHealthPct) / 100);
    const leakMassFlowKgS = leakFactor * 3.8 * (nextEnergy.copvPressureBar / ROADSTER_COPV_MAX_PRESSURE_BAR);
    nextHealth.leakVentingRateKgS = Number(leakMassFlowKgS.toFixed(2));

    const totalMassFlowKgS = intentionalMassFlow + leakMassFlowKgS;
    nextEnergy.copvMassFlowKgS = Number(totalMassFlowKgS.toFixed(2));

    const gasMassExpelledKg = totalMassFlowKgS * dt;
    nextEnergy.copvPropellantMassKg = Math.max(
      0,
      Number((nextEnergy.copvPropellantMassKg - gasMassExpelledKg).toFixed(3))
    );

    // Pressure scales with remaining mass via real-gas compressibility:
    const massFrac = nextEnergy.copvPropellantMassKg / ROADSTER_COPV_N2_MASS_KG;
    nextEnergy.copvPressureBar = Number((ROADSTER_COPV_MAX_PRESSURE_BAR * Math.pow(massFrac, 1.15)).toFixed(1));

    // Dynamic vehicle mass & center of gravity shift:
    nextEnergy.totalVehicleMassKg = Number((ROADSTER_DRY_MASS_KG + nextEnergy.copvPropellantMassKg).toFixed(2));
    // As rear tanks lose 63.5 kg, CoG shifts forward by up to 0.045m:
    const tankDistanceToCgM = 1.15;
    const deltaCgX = ((ROADSTER_COPV_N2_MASS_KG - nextEnergy.copvPropellantMassKg) / nextEnergy.totalVehicleMassKg) * tankDistanceToCgM;
    nextEnergy.centerOfGravityOffsetXM = Number(deltaCgX.toFixed(3));

    // Parasitic Blowdown Torque from Puncture Leak:
    if (leakMassFlowKgS > 0.05) {
      const leakThrustN = leakMassFlowKgS * 72 * 9.81; // Isp ~ 72s for cold N2
      // Asymmetric rear leak point creates roll and yaw torque:
      nextHealth.parasiticTorqueNm.x = leakThrustN * 0.42;
      nextHealth.parasiticTorqueNm.y = -leakThrustN * 0.65;
      nextHealth.parasiticTorqueNm.z = leakThrustN * 0.28;
    } else {
      nextHealth.parasiticTorqueNm.x = 0;
      nextHealth.parasiticTorqueNm.y = 0;
      nextHealth.parasiticTorqueNm.z = 0;
    }
  } else {
    // Starship Cryogenic Propellant & Avionics:
    const raptorFlowTonsS = thrusters.raptorThrottle * 1.85;
    const tonsDrained = raptorFlowTonsS * dt;
    nextEnergy.copvPropellantMassKg = Math.max(
      0,
      Number((nextEnergy.copvPropellantMassKg - tonsDrained * 1000).toFixed(1))
    );
    nextEnergy.totalVehicleMassKg = 100000.0 + nextEnergy.copvPropellantMassKg;
  }

  return { nextEnergy, nextHealth };
}
