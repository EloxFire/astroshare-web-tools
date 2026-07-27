// Même formule que le contact "greatest" dans MoonPathDiagram : distance angulaire Soleil-Lune au
// maximum de l'éclipse, dérivée de la magnitude plutôt que d'un événement précis (utile ici car on
// n'a que les circonstances agrégées d'une ville, pas le point "greatest" détaillé).
interface BuildEclipseShapeSvgParams {
  magnitude: number;
  sunRadius: number;
  moonRadius: number;
  size?: number;
}

export const buildEclipseShapeSvg = ({ magnitude, sunRadius, moonRadius, size = 28 }: BuildEclipseShapeSvgParams) => {
  const sunRadiusPx = size / 2 - 1.5;
  const scale = sunRadius > 0 ? sunRadiusPx / sunRadius : 1;
  const moonRadiusPx = Math.max(1, moonRadius * scale);

  const rawSeparation = sunRadius + moonRadius - 2 * magnitude * sunRadius;
  const separationPx = Math.max(0, Math.min(sunRadius + moonRadius, rawSeparation)) * scale;

  const center = size / 2;
  const moonCx = (center + separationPx).toFixed(2);

  // Le disque lunaire est presque de la même couleur que le fond du badge : sans son propre
  // contour, il devient invisible et seul le croissant solaire reste perceptible.
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${center}" cy="${center}" r="${sunRadiusPx}" fill="#f4c238"/>
    <circle cx="${moonCx}" cy="${center}" r="${moonRadiusPx.toFixed(2)}" fill="#05060a" stroke="#ffffff55" stroke-width="1"/>
  </svg>`;
};
