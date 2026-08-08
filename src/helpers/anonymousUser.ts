// Identifiant anonyme persistant (aucune donnée personnelle) — sert uniquement à distinguer les
// sessions d'une même personne dans les statistiques de fréquentation (voir sendWebStat.ts), jamais à
// l'identifier réellement. Lu/généré une seule fois au chargement de l'app (voir App.tsx) ; les appels
// suivants relisent simplement la même valeur persistée.
const STORAGE_KEY = 'as_anon_id';

export const getAnonymousUserId = (): string => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Stockage indisponible (navigation privée, quota, etc.) — un identifiant à usage unique pour
    // cette page vue plutôt que de faire échouer le suivi entièrement.
    return crypto.randomUUID();
  }
};
