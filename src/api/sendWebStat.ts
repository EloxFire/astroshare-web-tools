import { getAnonymousUserId } from '../helpers/anonymousUser';

export interface WebStatEclipseInfo {
  kind: 'solar' | 'lunar';
  date: string;
  type: string;
}

interface WebStatOptions {
  // Éclipse concernée, quand l'évènement a lieu sur un écran de détails — absent pour les évènements
  // hors contexte d'une éclipse précise (accueil, sélecteur d'année avant tout choix...).
  eclipse?: WebStatEclipseInfo;
  // Détails propres à un type d'évènement donné (ex: source d'une sélection de lieu, options cochées
  // à l'export...) — délibérément libre plutôt qu'un champ dédié par évènement, pour ne jamais avoir à
  // faire évoluer ce fichier à chaque nouvel évènement ajouté ailleurs dans l'app.
  meta?: Record<string, unknown>;
}

const WEB_STAT_URL = `${import.meta.env.VITE_ASTROSHARE_API_URL}/stats/web`;

// Mesure de flux anonymisée (ex: après une mention publique de l'outil) — voir DeepAstronomy pour le
// stockage (collection MongoDB "web_stats_v1"). `fetch` plutôt que l'instance axios `astroshareApi`
// utilisée ailleurs : reste volontairement indépendant de ses éventuels intercepteurs/config par
// défaut, et permet d'être explicite sur `credentials: 'omit'` (aucun cookie envoyé — sans objet de
// toute façon en cross-origin, mais explicite plutôt qu'implicite pour un endpoint anonyme par design).
// Jamais attendu par l'appelant, jamais de retry, jamais de remontée d'erreur visible : un échec
// (réseau, backend indisponible) est avalé silencieusement, ce suivi ne doit jamais gêner la navigation.
export const sendWebStat = (type: string, { eclipse, meta }: WebStatOptions = {}) => {
  fetch(WEB_STAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      anonId: getAnonymousUserId(),
      type,
      timestamp: new Date().toISOString(),
      eclipse,
      meta,
    }),
  }).catch(() => {
    // Silencieux par design.
  });
};
