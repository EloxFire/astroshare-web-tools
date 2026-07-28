// Note de conditions de visibilité. Un premier niveau se base uniquement sur la hauteur de l'éclipse
// au-dessus de l'horizon (rapide, toujours disponible). Un second niveau, optionnel, affine ce
// résultat avec une vraie vérification du relief le long de cette direction (voir horizonObstruction.ts,
// qui nécessite un token Mapbox) pour distinguer un horizon dégagé d'un horizon bouché par une colline
// ou une montagne.

export type VisibilityLevel = 'excellent' | 'very-good' | 'good' | 'medium' | 'poor' | 'very-poor' | 'blocked';

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

// Une hauteur basse à l'est correspond généralement à un lever (l'astre monte vers son maximum), à
// l'ouest à un coucher (il redescend vers l'horizon) — précision utile pour comprendre pourquoi
// l'horizon compte autant à ce moment précis. Un azimut proche du nord/sud pur (marge de 15°) n'indique
// fiablement ni l'un ni l'autre, donc pas de précision ajoutée dans ce cas plutôt qu'une affirmation
// hasardeuse.
const riseSetPhrase = (azimuthDeg: number, body: 'Soleil' | 'Lune'): string | null => {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const bodyLabel = body === 'Soleil' ? 'du Soleil' : 'de la Lune';
  if (normalized > 15 && normalized < 165) return `lever ${bodyLabel}`;
  if (normalized > 195 && normalized < 345) return `coucher ${bodyLabel}`;
  return null;
};

// Seuils (hauteur au-dessus de l'horizon, en degrés) utilisés à la fois par getAltitudeVisibilityRating
// ci-dessous et par l'échelle affichée à l'utilisateur (voir VisibilityScale.tsx) — une seule source de
// vérité pour que l'échelle affichée corresponde toujours exactement au calcul réel.
export const VISIBILITY_SCALE: {
  level: VisibilityLevel;
  label: string;
  thresholdLabel: string;
  color: string;
}[] = [
  { level: 'excellent', label: 'Excellente', thresholdLabel: '≥ 60°', color: '#43d17a' },
  { level: 'very-good', label: 'Très bonne', thresholdLabel: '40° – 60°', color: '#8fd694' },
  { level: 'good', label: 'Bonne', thresholdLabel: '22° – 40°', color: '#c3e86b' },
  { level: 'medium', label: 'Moyenne', thresholdLabel: '10° – 22°', color: '#f4c238' },
  { level: 'poor', label: 'Difficile', thresholdLabel: '4° – 10°', color: '#ff9d4d' },
  { level: 'very-poor', label: 'Très difficile', thresholdLabel: '0° – 4°', color: '#ff6b6b' },
  { level: 'blocked', label: 'Masquée', thresholdLabel: 'Relief bloquant', color: '#ff3b3b' },
];

export const getAltitudeVisibilityRating = (
  altitudeDeg: number,
  azimuthDeg: number,
  body: 'Soleil' | 'Lune' = 'Soleil',
): VisibilityRating => {
  const direction = azimuthToCompass(azimuthDeg);
  const directionPhrase = azimuthToCompassPhrase(azimuthDeg);
  const altitudeLabel = `${altitudeDeg.toFixed(0)}°`;
  const riseSet = riseSetPhrase(azimuthDeg, body);
  // ", proche du lever du Soleil" / "" selon que l'azimut permette de trancher ou non.
  const riseSetClause = riseSet ? `, proche du ${riseSet}` : '';

  if (altitudeDeg >= 60) {
    return {
      level: 'excellent',
      label: 'Excellente',
      message: `Elle sera très haute dans le ciel (${altitudeLabel}) : le relief environnant ne devrait absolument pas gêner l'observation.`,
    };
  }
  if (altitudeDeg >= 40) {
    return {
      level: 'very-good',
      label: 'Très bonne',
      message: `Elle sera haute dans le ciel (${altitudeLabel}) : le relief environnant ne devrait pas gêner l'observation.`,
    };
  }
  if (altitudeDeg >= 22) {
    return {
      level: 'good',
      label: 'Bonne',
      message: `Elle restera assez haute (${altitudeLabel}) ${directionPhrase}${riseSetClause} : un horizon dégagé dans cette direction n'est pas indispensable, mais reste préférable.`,
    };
  }
  if (altitudeDeg >= 10) {
    return {
      level: 'medium',
      label: 'Moyenne',
      message: `Elle sera d'une hauteur modérée (${altitudeLabel}) ${directionPhrase}${riseSetClause} : privilégiez un point de vue sans collines, bâtiments ou arbres dans cette direction.`,
    };
  }
  if (altitudeDeg >= 4) {
    return {
      level: 'poor',
      label: 'Difficile',
      message: `Elle sera basse sur l'horizon (${altitudeLabel}) ${directionPhrase}${riseSetClause} : un horizon ${direction} bien dégagé est nécessaire, sans quoi le relief environnant risque de la masquer.`,
    };
  }
  return {
    level: 'very-poor',
    label: 'Très difficile',
    message: `Elle sera très basse sur l'horizon (${altitudeLabel}) ${directionPhrase}${riseSetClause} : un horizon ${direction} parfaitement dégagé est indispensable, sans quoi le relief environnant risque fortement de la masquer.`,
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
  body: 'Soleil' | 'Lune' = 'Soleil',
): VisibilityRating => {
  const directionPhrase = azimuthToCompassPhrase(azimuthDeg);
  const altitudeLabel = `${altitudeDeg.toFixed(0)}°`;
  const riseSet = riseSetPhrase(azimuthDeg, body);
  const riseSetClause = riseSet ? `, proche du ${riseSet}` : '';

  if (terrain.blocked) {
    const distancePhrase = terrain.obstructionDistanceKm != null ? ` (vers ${terrain.obstructionDistanceKm} km)` : '';
    return {
      level: 'blocked',
      label: 'Masquée',
      message: `Le relief ${directionPhrase}${distancePhrase} culmine à environ ${terrain.obstructionAngleDeg.toFixed(1)}°, plus haut que l'éclipse (${altitudeLabel}${riseSetClause}) : elle sera probablement masquée depuis ce point précis. Cherchez un point de vue plus dégagé ou en hauteur.`,
    };
  }

  return {
    ...base,
    message: `${base.message} Relief vérifié : rien ne devrait la masquer depuis ce point précis.`,
  };
};
