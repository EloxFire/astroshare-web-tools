// `astronomia` (MIT, port of Meeus's "Astronomical Algorithms") ships no type declarations —
// this covers only the functions actually used by `moonPathSimulation.ts`, typed against the
// runtime shapes verified during development (see git history for the calibration scripts).

declare module 'astronomia/julian' {
  export function DateToJDE(date: Date): number;
  export function DateToJD(date: Date): number;
}

declare module 'astronomia/base' {
  export function J2000Century(jde: number): number;
}

declare module 'astronomia/solar' {
  export function apparentEquatorial(jde: number): { ra: number; dec: number };
  export function radius(t: number): number;
}

declare module 'astronomia/moonposition' {
  export function position(jde: number): { lon: number; lat: number; range: number };
}

declare module 'astronomia/nutation' {
  export function meanObliquity(jde: number): number;
}

declare module 'astronomia/coord' {
  import type { Coord as GlobeCoord } from 'astronomia/globe';

  export class Equatorial {
    constructor(ra: number, dec: number);
    ra: number;
    dec: number;
    toHorizontal(g: GlobeCoord, st: number): { az: number; alt: number };
  }
  export class Ecliptic {
    constructor(lon: number, lat: number);
    toEquatorial(epsilon: number): Equatorial;
  }
}

declare module 'astronomia/globe' {
  export class Coord {
    constructor(lat: number, lon: number);
  }
  export class Ellipsoid {
    parallaxConstants(lat: number, elevationMeters: number): [number, number];
  }
  export const Earth76: Ellipsoid;
}

declare module 'astronomia/parallax' {
  export function topocentric(
    c: { ra: number; dec: number; range: number },
    rhoSinPhi: number,
    rhoCosPhi: number,
    longitude: number,
    jd: number,
  ): { ra: number; dec: number };
}

declare module 'astronomia/sidereal' {
  export function apparent(jd: number): number;
}
