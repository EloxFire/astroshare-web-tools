const EARTH_RADIUS_KM = 6371;

// Formule de la destination (grand cercle) : point situé à `distanceKm` de (lat, lng) en suivant le
// cap `bearingDeg` (0° = nord, sens horaire).
export const destinationPoint = (lat: number, lng: number, bearingDeg: number, distanceKm: number) => {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = distanceKm / EARTH_RADIUS_KM;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const destLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad),
    );

  return { lat: (destLatRad * 180) / Math.PI, lng: (destLngRad * 180) / Math.PI };
};

// Angle de rotation CSS (degrés, sens horaire) pour qu'un texte horizontal apparaisse parallèle à
// une ligne de cap `bearingDeg` sur une carte nord en haut. `bearing - 90` donne l'angle écran brut
// (identité trigonométrique standard) ; le repli à ±90° évite que le texte soit rendu à l'envers, la
// ligne étant visuellement la même à 180° près.
export const bearingToParallelRotationDeg = (bearingDeg: number): number => {
  let angle = (((bearingDeg - 90) % 360) + 360) % 360;
  if (angle > 90 && angle < 270) angle -= 180;
  if (angle > 180) angle -= 360;
  return angle;
};
