import { getAnonymousUserId } from '../helpers/anonymousUser';

export interface WebStatEclipseInfo {
  kind: 'solar' | 'lunar';
  date: string;
  type: string;
}

const WEB_STAT_URL = `${import.meta.env.VITE_ASTROSHARE_API_URL}/stats/web`;

// Mesure de flux anonymisée (ex: après une mention publique de l'outil) — voir DeepAstronomy pour le
// stockage (collection MongoDB "web_stats_v1"). `fetch` plutôt que l'instance axios `astroshareApi`
// utilisée ailleurs : reste volontairement indépendant de ses éventuels intercepteurs/config par
// défaut, et permet d'être explicite sur `credentials: 'omit'` (aucun cookie envoyé — sans objet de
// toute façon en cross-origin, mais explicite plutôt qu'implicite pour un endpoint anonyme par design).
// Jamais attendu par l'appelant, jamais de retry, jamais de remontée d'erreur visible : un échec
// (réseau, backend indisponible) est avalé silencieusement, ce suivi ne doit jamais gêner la navigation.
export const sendWebStat = (type: string, eclipse?: WebStatEclipseInfo) => {
  fetch(WEB_STAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      anonId: getAnonymousUserId(),
      type,
      timestamp: new Date().toISOString(),
      eclipse,
    }),
  }).catch(() => {
    // Silencieux par design.
  });
};
