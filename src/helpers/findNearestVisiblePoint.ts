import { destinationPoint } from './geo';

export interface NearestVisiblePoint {
  lat: number;
  lng: number;
  distanceKm: number;
  bearingDeg: number;
}

// Anneaux croissants jusqu'à la distance antipodale maximale sur Terre (~20 015 km, la moitié de la
// circonférence) : l'éclipse n'étant "pas visible du tout" signifie généralement que ce point est du
// côté nuit de la Terre pendant l'événement, donc le point visible le plus proche peut être à
// plusieurs milliers de km — mais l'éclipse est toujours visible depuis QUELQUE part sur le globe à
// un instant donné, la recherche ne doit donc jamais s'arrêter avant d'avoir couvert tout le globe.
// 8 caps par anneau, comme pour findClearViewpoints, pour rester raisonnable en nombre de requêtes.
const SEARCH_RINGS_KM = [200, 500, 1000, 2000, 4000, 7000, 11000, 15000, 20015];
// Exporté pour que l'UI (mini aperçu du rayon de recherche) puisse mettre sa barre de progression à
// la même échelle que la recherche réelle, sans dupliquer la borne.
export const MAX_SEARCH_KM = SEARCH_RINGS_KM[SEARCH_RINGS_KM.length - 1];
// Est/Ouest en premier, nord/sud en dernier recours : décaler la longitude change directement
// l'heure locale (donc la hauteur du Soleil) — à distance égale, un déplacement est/ouest gagne
// généralement bien plus d'altitude qu'un déplacement nord/sud, qui ne fait que suivre le même
// méridien sans rien changer à l'heure locale. En cas d'ex-æquo dans un même anneau (plusieurs caps
// visibles à la même distance), le premier trouvé dans ce tableau l'emporte — d'où cet ordre.
const SEARCH_BEARINGS_DEG = [90, 270, 45, 135, 225, 315, 0, 180];
// Dichotomie le long du cap gagnant entre le dernier anneau négatif et celui qui a matché, pour
// resserrer la distance sans multiplier les requêtes (4 étapes ≈ précision à quelques % près).
const REFINE_STEPS = 4;

// Cherche, en s'éloignant d'un point où l'éclipse n'est pas visible, le point visible le plus proche
// dans une direction donnée — usage explicitement déclenché par l'utilisateur (bouton), le nombre de
// requêtes pouvant être important si le point de départ est loin du terminateur. `onProgress` reçoit
// le rayon (km) de l'anneau en cours de sondage, pour afficher un retour en temps réel pendant une
// recherche qui peut prendre plusieurs secondes.
export const findNearestVisiblePoint = async (
  lat: number,
  lng: number,
  checkVisible: (lat: number, lng: number) => Promise<boolean>,
  onProgress?: (ringKm: number) => void,
): Promise<NearestVisiblePoint | null> => {
  let previousRingKm = 0;

  for (const ringKm of SEARCH_RINGS_KM) {
    onProgress?.(ringKm);
    const candidates = SEARCH_BEARINGS_DEG.map((bearingDeg) => ({
      bearingDeg,
      ...destinationPoint(lat, lng, bearingDeg, ringKm),
    }));

    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(
      candidates.map(async (candidate) => ({ ...candidate, visible: await checkVisible(candidate.lat, candidate.lng) })),
    );
    const hit = results.find((result) => result.visible);

    if (hit) {
      let low = previousRingKm;
      let high = ringKm;
      let best: NearestVisiblePoint = { lat: hit.lat, lng: hit.lng, distanceKm: ringKm, bearingDeg: hit.bearingDeg };

      for (let step = 0; step < REFINE_STEPS; step += 1) {
        const mid = (low + high) / 2;
        onProgress?.(mid);
        const point = destinationPoint(lat, lng, hit.bearingDeg, mid);
        // eslint-disable-next-line no-await-in-loop
        const visible = await checkVisible(point.lat, point.lng);
        if (visible) {
          high = mid;
          best = { lat: point.lat, lng: point.lng, distanceKm: mid, bearingDeg: hit.bearingDeg };
        } else {
          low = mid;
        }
      }

      return best;
    }

    previousRingKm = ringKm;
  }

  return null;
};
