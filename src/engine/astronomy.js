/**
 * AstroMoon — Astronomy Engine Wrapper
 * Re-exports astronomy-engine from npm package instead of the 431KB global script.
 */

export {
  Observer,
  AstroTime,
  Body,
  Libration,
  MoonPhase,
  Equator,
  RotationAxis,
  SiderealTime,
  DEG2RAD,
  RAD2DEG,
  HOUR2RAD
} from 'astronomy-engine';
