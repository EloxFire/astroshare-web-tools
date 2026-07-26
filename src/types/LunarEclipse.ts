type CelestialBody = {
  DEC: number;
  RA: number; // heures (0-24), pas des degrés
  parallax: number;
  radius: number; // rayon angulaire, en degrés
};

type LunarEclipseEvent = {
  Moon: CelestialBody;
  Sun: CelestialBody;
  'UT1-TT': number;
  date: string;
  axis: number; // distance du centre de la Lune à l'axe de l'ombre, même unité que `radius.penumbra`/`radius.umbra`
  p: number | null; // angle de position (référence céleste)
  zenith: {
    geometry: {
      coordinates: [number, number, number];
      type: string;
    };
    properties: {
      coordinatesDMS: [string, string, string];
    };
    type: string;
  };
};

export type LunarVisibilityLine = {
  geometry: {
    coordinates: [number, number, number][][];
    type: string;
  };
  properties: {
    name: string;
  };
  type: string;
};

export type LunarVisibilityPaths = {
  geometry: {
    coordinates: any;
    type: string;
  };
};

export type LunarEclipse = {
  calendarDate: string;
  duration: {
    penumbral: string;
    partial?: string | null;
    total?: string | null;
  };
  events: {
    P1?: LunarEclipseEvent;
    P2?: LunarEclipseEvent;
    U1?: LunarEclipseEvent;
    U2?: LunarEclipseEvent;
    U3?: LunarEclipseEvent;
    U4?: LunarEclipseEvent;
    greatest?: LunarEclipseEvent;
  };
  link: {
    image: string;
    self: string;
    video: string;
  };
  magnitude: number;
  radius: {
    penumbra: number;
    umbra: number;
  };
  type: string;
  visibilityLines?: {
    features: LunarVisibilityLine[];
    type: string;
  };
  visibilityPaths?: {
    features: LunarVisibilityPaths[];
    type: string;
  };
};
