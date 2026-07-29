type CelestialBody = {
  DEC: number;
  RA: number;
  azimuth: number;
  elevation: number;
  parallax: number;
  radius: number;
};

type EclipseEvent = {
  Moon: CelestialBody;
  Sun: CelestialBody;
  'UT1-TT': number;
  date: string;
  location: {
    geometry: {
      coordinates: [number, number, number];
      type: string;
    };
    properties: {
      coordinatesDMS: [string, string, string];
    };
    type: string;
  } | null;
  p: number | null;
  zenith: number | null;
};

type Duration = {
  penumbral: string;
  umbral: string | null;
};

export type PhysicalData = {
  Earth: {
    inverseFlattening: number;
    radius: number;
  };
  Moon: {
    radius: number;
  };
  Sun: {
    radius: number;
  };
};

export type VisibilityLine = {
  geometry: {
    coordinates: [number, number, number][][];
    type: string;
  };
  properties: {
    name: string;
  };
  type: string;
};

export type VisibilityPaths = {
  geometry: {
    coordinates: [number, number, number][];
    type: string;
  };
  // "umbra" (bande de totalité/annularité, éclipses centrales uniquement) ou "penumbra" (zone de
  // visibilité partielle, toujours présente).
  properties?: {
    name: string;
  };
};

export type SolarEclipse = {
  calendarDate: string;
  duration: Duration;
  events: {
    P1?: EclipseEvent;
    P4?: EclipseEvent;
    U1?: EclipseEvent;
    U2?: EclipseEvent;
    U3?: EclipseEvent;
    U4?: EclipseEvent;
    C1?: EclipseEvent;
    C2?: EclipseEvent;
    greatest?: EclipseEvent;
  };
  link: {
    image: string;
    self: string;
    video: string;
  };
  magnitude: number;
  obscuration: number | null;
  physicalData: PhysicalData;
  type: string;
  visibilityLines?: {
    features: VisibilityLine[];
    type: string;
  };
  visibilityPaths?: {
    features: VisibilityPaths[];
    type: string;
  };
};
