// Mêmes couleurs que VISIBILITY_SCALE (voir visibilityRating.ts) — une seule palette pour tout ce qui
// évalue "les conditions seront-elles bonnes" dans l'app, que ce soit le relief ou la météo.
export interface CloudCoverRating {
  // Verdict côté observation de l'éclipse, pas une simple redite de la description météo (déjà
  // affichée juste à côté, ex. "Ciel dégagé") — sans quoi le badge ne fait que répéter le même mot.
  verdict: string;
  color: string;
}

export const getCloudCoverRating = (cloudsPercent: number): CloudCoverRating => {
  if (cloudsPercent <= 20) return { verdict: "Idéal pour l'observation", color: '#43d17a' };
  if (cloudsPercent <= 60) return { verdict: 'Observation possible', color: '#f4c238' };
  return { verdict: 'Conditions difficiles', color: '#ff6b6b' };
};
