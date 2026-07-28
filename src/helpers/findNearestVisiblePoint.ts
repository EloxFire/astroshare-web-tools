import { destinationPoint } from './geo';

export interface NearestVisiblePoint {
  lat: number;
  lng: number;
  distanceKm: number;
  bearingDeg: number;
}

// Anneaux croissants (l'éclipse n'étant "pas visible du tout" signifie généralement que ce point est
// du côté nuit de la Terre pendant l'événement : le point visible le plus proche peut donc être à
// plusieurs milliers de km, jusqu'à l'antipode du terminateur). 8 caps par anneau, comme pour
// findClearViewpoints, pour rester raisonnable en nombre de requêtes.
const SEARCH_RINGS_KM = [200, 500, 1000, 2000, 4000, 7000, 11000];
const SEARCH_BEARINGS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
// Dichotomie le long du cap gagnant entre le dernier anneau négatif et celui qui a matché, pour
// resserrer la distance sans multiplier les requêtes (4 étapes ≈ précision à quelques % près).
const REFINE_STEPS = 4;

// Cherche, en s'éloignant d'un point où l'éclipse n'est pas visible, le point visible le plus proche
// dans une direction donnée — usage explicitement déclenché par l'utilisateur (bouton), le nombre de
// requêtes pouvant être important si le point de départ est loin du terminateur.
export const findNearestVisiblePoint = async (
  lat: number,
  lng: number,
  checkVisible: (lat: number, lng: number) => Promise<boolean>,
): Promise<NearestVisiblePoint | null> => {
  let previousRingKm = 0;

  for (const ringKm of SEARCH_RINGS_KM) {
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
