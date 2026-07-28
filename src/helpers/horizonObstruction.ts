// Vérifie si le relief environnant peut masquer l'éclipse depuis un point donné : échantillonne
// l'altitude du terrain le long de l'azimut de l'éclipse et compare l'angle du relief le plus haut
// à la hauteur de l'éclipse.
//
// Décode directement les tuiles Terrain-RGB de Mapbox (format public documenté : élévation en
// mètres = -10000 + (R*256*256 + G*256 + B) * 0.1) plutôt que de passer par le plugin
// leaflet-topography — son bundle UMD compilé référence l'import "leaflet" brut au lieu de son
// wrapper d'interop par défaut pour L.GridLayer, ce qui plante au chargement sous le pré-bundler de
// Vite (`Cannot read properties of undefined (reading 'extend')`), pour une fonctionnalité (couche
// de visualisation + web workers) dont on n'a de toute façon pas besoin ici.
//
// Nécessite un token Mapbox (VITE_MAPBOX_TOKEN) — sans lui, isTerrainCheckAvailable() renvoie false
// et l'app se rabat sur la note basée uniquement sur l'altitude.
import { destinationPoint } from './geo';

const TILE_ZOOM = 12;
const TILE_SIZE = 256;

export const isTerrainCheckAvailable = (): boolean => Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

const lonLatToTile = (lat: number, lon: number, zoom: number) => {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return {
    tileX,
    tileY,
    pixelX: Math.min(TILE_SIZE - 1, Math.floor((x - tileX) * TILE_SIZE)),
    pixelY: Math.min(TILE_SIZE - 1, Math.floor((y - tileY) * TILE_SIZE)),
  };
};

const tileImageDataCache = new Map<string, Promise<ImageData | null>>();

const loadTileImageData = (tileX: number, tileY: number, token: string): Promise<ImageData | null> => {
  const key = `${tileX},${tileY}`;
  const cached = tileImageDataCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${TILE_ZOOM}/${tileX}/${tileY}.pngraw?access_token=${token}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    } catch {
      return null;
    }
  })();

  tileImageDataCache.set(key, promise);
  return promise;
};

const getElevation = async (lat: number, lon: number, token: string): Promise<number | null> => {
  const { tileX, tileY, pixelX, pixelY } = lonLatToTile(lat, lon, TILE_ZOOM);
  const imageData = await loadTileImageData(tileX, tileY, token);
  if (!imageData) return null;

  const index = (pixelY * TILE_SIZE + pixelX) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
};

// Distances resserrées près de l'observateur (un relief proche masque avec un angle bien plus
// important qu'un relief lointain de même hauteur) puis plus espacées au loin.
const SAMPLE_DISTANCES_KM = [1, 2, 4, 7, 12, 20, 35, 55];
// Coefficient empirique (courbure terrestre + réfraction atmosphérique standard) : abaissement de
// l'horizon en mètres = distance_km² * ce coefficient.
const CURVATURE_DROP_COEFFICIENT = 0.0675;

export interface HorizonSample {
  distanceKm: number;
  lat: number;
  lng: number;
  elevationM: number;
  angleDeg: number;
}

export interface HorizonObstructionResult {
  blocked: boolean;
  obstructionAngleDeg: number;
  obstructionDistanceKm: number | null;
}

// Échantillonne le relief le long de l'azimut donné. Renvoie le profil complet (un point par
// distance testée) pour permettre à la fois le calcul du verdict (summarizeObstruction) et une
// représentation visuelle sur la carte (ligne de direction + points d'obstruction potentiels).
export const getHorizonProfile = async (
  lat: number,
  lng: number,
  azimuthDeg: number,
): Promise<HorizonSample[] | null> => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const observerElevation = (await getElevation(lat, lng, token)) ?? 0;

    const samples = await Promise.all(
      SAMPLE_DISTANCES_KM.map(async (distanceKm) => {
        const point = destinationPoint(lat, lng, azimuthDeg, distanceKm);
        const elevationM = await getElevation(point.lat, point.lng, token);
        if (elevationM == null) return null;

        const dropM = distanceKm ** 2 * CURVATURE_DROP_COEFFICIENT;
        const heightDiffM = elevationM - observerElevation - dropM;
        const angleDeg = (Math.atan2(heightDiffM, distanceKm * 1000) * 180) / Math.PI;
        return { distanceKm, lat: point.lat, lng: point.lng, elevationM, angleDeg };
      }),
    );

    const valid = samples.filter((sample): sample is HorizonSample => sample != null);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
};

export const summarizeObstruction = (profile: HorizonSample[], targetAltitudeDeg: number): HorizonObstructionResult => {
  const worst = profile.reduce((max, sample) => (sample.angleDeg > max.angleDeg ? sample : max));
  return {
    blocked: worst.angleDeg >= targetAltitudeDeg,
    obstructionAngleDeg: worst.angleDeg,
    obstructionDistanceKm: worst.angleDeg > 0 ? worst.distanceKm : null,
  };
};

export interface ViewpointSuggestion {
  lat: number;
  lng: number;
  distanceKm: number;
  bearingFromOriginDeg: number;
}

// Bande resserrée (1-5 km) + deux distances plus lointaines, sur 8 directions : un compromis entre
// couverture et nombre de requêtes. Beaucoup de points d'échantillonnage retombent sur des tuiles
// déjà en cache (le point d'origine + les candidats voisins se recouvrent largement), donc le coût
// réel reste modéré malgré les ~24 candidats × 8 points chacun.
const CANDIDATE_DISTANCES_KM = [3, 10, 30];
const CANDIDATE_BEARINGS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

// Cherche, autour d'un point bloqué, des candidats proches d'où le même azimut/altitude
// resterait dégagé — usage explicitement déclenché par l'utilisateur (bouton), pas automatique,
// car le nombre de requêtes en fait une opération notablement plus longue qu'une simple vérification.
export const findClearViewpoints = async (
  lat: number,
  lng: number,
  targetAltitudeDeg: number,
  targetAzimuthDeg: number,
  maxResults = 5,
): Promise<ViewpointSuggestion[]> => {
  const candidates = CANDIDATE_DISTANCES_KM.flatMap((distanceKm) =>
    CANDIDATE_BEARINGS_DEG.map((bearingFromOriginDeg) => {
      const point = destinationPoint(lat, lng, bearingFromOriginDeg, distanceKm);
      return { ...point, distanceKm, bearingFromOriginDeg };
    }),
  );

  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const profile = await getHorizonProfile(candidate.lat, candidate.lng, targetAzimuthDeg);
      if (!profile) return null;
      const { blocked } = summarizeObstruction(profile, targetAltitudeDeg);
      return { ...candidate, blocked };
    }),
  );

  return results
    .filter((result): result is NonNullable<typeof result> => result != null && !result.blocked)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxResults)
    .map(({ lat: candidateLat, lng: candidateLng, distanceKm, bearingFromOriginDeg }) => ({
      lat: candidateLat,
      lng: candidateLng,
      distanceKm,
      bearingFromOriginDeg,
    }));
};
