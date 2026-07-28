// Note de conditions de visibilité. Un premier niveau se base uniquement sur la hauteur de l'éclipse
// au-dessus de l'horizon (rapide, toujours disponible). Un second niveau, optionnel, affine ce
// résultat avec une vraie vérification du relief le long de cette direction (voir horizonObstruction.ts,
// qui nécessite un token Mapbox) pour distinguer un horizon dégagé d'un horizon bouché par une colline
// ou une montagne.

export type VisibilityLevel = 'excellent' | 'good' | 'medium' | 'poor' | 'blocked';

export interface VisibilityRating {
  level: VisibilityLevel;
  label: string;
  message: string;
}

const COMPASS_DIRECTIONS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
// Élision requise pour "est"/"ouest" ("à l'est", pas "au est").
const COMPASS_PHRASES = ['au nord', 'au nord-est', "à l'est", 'au sud-est', 'au sud', 'au sud-ouest', "à l'ouest", 'au nord-ouest'];

export const azimuthToCompass = (azimuthDeg: number): string => {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_DIRECTIONS[Math.round(normalized / 45) % 8];
};

export const azimuthToCompassPhrase = (azimuthDeg: number): string => {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_PHRASES[Math.round(normalized / 45) % 8];
};

export const getAltitudeVisibilityRating = (altitudeDeg: number, azimuthDeg: number): VisibilityRating => {
  const direction = azimuthToCompass(azimuthDeg);
  const directionPhrase = azimuthToCompassPhrase(azimuthDeg);
  const altitudeLabel = `${altitudeDeg.toFixed(0)}°`;

  if (altitudeDeg >= 45) {
    return {
      level: 'excellent',
      label: 'Excellente',
      message: `Elle sera haute dans le ciel (${altitudeLabel}) : le relief environnant ne devrait pas gêner l'observation.`,
    };
  }
  if (altitudeDeg >= 20) {
    return {
      level: 'good',
      label: 'Bonne',
      message: `Elle restera assez haute (${altitudeLabel}) ${directionPhrase} : un horizon dégagé dans cette direction n'est pas indispensable, mais reste préférable.`,
    };
  }
  if (altitudeDeg >= 8) {
    return {
      level: 'medium',
      label: 'Moyenne',
      message: `Elle sera basse sur l'horizon (${altitudeLabel}) ${directionPhrase} : privilégiez un point de vue sans collines, bâtiments ou arbres dans cette direction.`,
    };
  }
  return {
    level: 'poor',
    label: 'Difficile',
    message: `Elle sera très basse sur l'horizon (${altitudeLabel}) ${directionPhrase}, proche du lever/coucher du Soleil : un horizon ${direction} parfaitement dégagé est indispensable, sans quoi le relief environnant risque de la masquer.`,
  };
};

interface TerrainCheckResult {
  blocked: boolean;
  obstructionAngleDeg: number;
  obstructionDistanceKm: number | null;
}

// Affine la note basée sur l'altitude avec le résultat d'une vraie vérification du relief : soit
// pour confirmer qu'un horizon annoncé "difficile" est en fait dégagé depuis ce point précis, soit
// pour prévenir que le relief bloque la vue même quand l'altitude seule semblait suffisante.
export const applyTerrainObstruction = (
  base: VisibilityRating,
  terrain: TerrainCheckResult,
  altitudeDeg: number,
  azimuthDeg: number,
): VisibilityRating => {
  const directionPhrase = azimuthToCompassPhrase(azimuthDeg);
  const altitudeLabel = `${altitudeDeg.toFixed(0)}°`;

  if (terrain.blocked) {
    const distancePhrase = terrain.obstructionDistanceKm != null ? ` (vers ${terrain.obstructionDistanceKm} km)` : '';
    return {
      level: 'blocked',
      label: 'Masquée',
      message: `Le relief ${directionPhrase}${distancePhrase} culmine à environ ${terrain.obstructionAngleDeg.toFixed(1)}°, plus haut que l'éclipse (${altitudeLabel}) : elle sera probablement masquée depuis ce point précis. Cherchez un point de vue plus dégagé ou en hauteur.`,
    };
  }

  return {
    ...base,
    message: `${base.message} Relief vérifié : rien ne devrait la masquer depuis ce point précis.`,
  };
};
