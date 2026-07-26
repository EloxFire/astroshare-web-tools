// Transformation équatoriale -> horizontale (RA/DEC -> altitude/azimut) pour un lieu et un instant donnés.
// Utilisé pour les éclipses lunaires : l'API renvoie les mêmes circonstances pour toute la Terre
// (contrairement au solaire), donc la visibilité locale (la Lune est-elle au-dessus de l'horizon ?)
// se calcule côté client à partir de la RA/DEC de la Lune à chaque phase.
// Formule GMST : approximation IAU standard (Meeus), largement suffisante pour une altitude au degré près.

const toJulianDate = (isoDateUtc: string): number => {
  const date = new Date(isoDateUtc.endsWith('Z') ? isoDateUtc : `${isoDateUtc}Z`);
  return date.getTime() / 86400000 + 2440587.5;
};

const gmstDegrees = (jd: number): number => {
  const T = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  gmst %= 360;
  if (gmst < 0) gmst += 360;
  return gmst;
};

/**
 * @param dateUtc date ISO (UTC, sans offset) de l'événement, ex "2026-03-03T08:44:25"
 * @param raHours ascension droite en heures (0-24)
 * @param decDeg déclinaison en degrés
 * @param lat latitude de l'observateur en degrés
 * @param lon longitude de l'observateur en degrés (est positif)
 */
export const equatorialToHorizontal = (dateUtc: string, raHours: number, decDeg: number, lat: number, lon: number) => {
  const jd = toJulianDate(dateUtc);
  const gmst = gmstDegrees(jd);
  const lst = (gmst + lon) % 360;
  let ha = lst - raHours * 15;
  ha = ((ha + 180) % 360 + 360) % 360 - 180;

  const haRad = (ha * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altitude = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;

  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * Math.sin((altitude * Math.PI) / 180)) /
    (Math.cos(latRad) * Math.cos((altitude * Math.PI) / 180));
  let azimuth = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (Math.sin(haRad) > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
};
