// Simulation "time-lapse" de la trajectoire Soleil/Lune entre deux instants donnés (premier/dernier
// contact), à des pas de temps réguliers non fournis par l'API (qui ne donne que les points de
// contact nommés). Calculs basés sur `astronomia` (port TS/JS de "Astronomical Algorithms" de Meeus,
// MIT) plutôt que sur une interpolation naïve entre points connus — validé à la calibration contre de
// vraies données API (IMCCE) : séparation Soleil/Lune à ~4" près aux points de contact, angle de
// position à ~0.2° près. Un autre package (@observerly/astrometry) a été essayé en premier mais sa
// position lunaire présentait un biais systématique de ~0.9° en déclinaison — bien trop grand pour
// résoudre la géométrie d'une éclipse (rayons Soleil/Lune ~0.27°).
import { DateToJD, DateToJDE } from 'astronomia/julian';
import { J2000Century } from 'astronomia/base';
import { apparentEquatorial as sunApparentEquatorial, radius as sunDistanceAU } from 'astronomia/solar';
import { position as moonGeocentricPosition } from 'astronomia/moonposition';
import { meanObliquity } from 'astronomia/nutation';
import { Ecliptic, Equatorial } from 'astronomia/coord';
import { Coord as GlobeCoord, Earth76 } from 'astronomia/globe';
import { topocentric } from 'astronomia/parallax';
import { apparent as apparentSiderealTimeSeconds } from 'astronomia/sidereal';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { LunarEclipse } from '../types/LunarEclipse';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const AU_KM = 149597870.7;
const EARTH_RADIUS_KM = 6378.137;
const MOON_RADIUS_KM = 1737.4;

export interface Observer {
  lat: number;
  lng: number;
  elevation?: number;
}

interface SphericalPoint {
  theta: number; // angle latitudinal (déclinaison ou hauteur), en degrés
  phi: number; // angle longitudinal (ascension droite ou azimut), en degrés
}

// Séparation angulaire entre deux points sphériques (formule générique, valable aussi bien en
// coordonnées équatoriales qu'horizontales).
function angularSeparationDeg(a: SphericalPoint, b: SphericalPoint): number {
  const t1 = a.theta * D2R;
  const t2 = b.theta * D2R;
  const dPhi = (b.phi - a.phi) * D2R;
  const cos = Math.sin(t1) * Math.sin(t2) + Math.cos(t1) * Math.cos(t2) * Math.cos(dPhi);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * R2D;
}

// Angle de position (« bearing ») du point `b` vu depuis `a`, mesuré à partir du pôle (nord céleste
// ou zénith) vers l'est/l'azimut croissant — même formule, valable dans les deux repères.
function positionAngleDeg(a: SphericalPoint, b: SphericalPoint): number {
  const t1 = a.theta * D2R;
  const t2 = b.theta * D2R;
  const dPhi = (b.phi - a.phi) * D2R;
  const y = Math.sin(dPhi) * Math.cos(t2);
  const x = Math.cos(t1) * Math.sin(t2) - Math.sin(t1) * Math.cos(t2) * Math.cos(dPhi);
  const deg = Math.atan2(y, x) * R2D;
  return deg < 0 ? deg + 360 : deg;
}

// Angle parallactique q du point de déclinaison/ascension droite donné, à l'heure sidérale donnée —
// relie le repère céleste (p) au repère local/zénith (zenith = p - q), voir Meeus §14.
function parallacticAngleDeg(hourAngleRad: number, latRad: number, decRad: number): number {
  const y = Math.sin(hourAngleRad);
  const x = Math.tan(latRad) * Math.cos(decRad) - Math.sin(decRad) * Math.cos(hourAngleRad);
  const deg = Math.atan2(y, x) * R2D;
  return deg < 0 ? deg + 360 : deg;
}

function normalizeDeg(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export interface SolarSimulationFrame {
  time: Date;
  sunRadiusDeg: number;
  moonRadiusDeg: number;
  separationDeg: number;
  celestialAngleDeg: number; // repère céleste, équivalent du champ `p` des événements de l'API
  localAngleDeg: number; // repère local (zénith), équivalent du champ `zenith` des événements de l'API
}

interface SolarPhysicalData {
  Sun: { radius: number }; // km
  Moon: { radius: number }; // km
}

function computeSolarFrame(date: Date, observer: Observer, physicalData: SolarPhysicalData): SolarSimulationFrame {
  const jde = DateToJDE(date);
  const jd = DateToJD(date);
  const T = J2000Century(jde);

  // Convention `astronomia` : longitude positive vers l'ouest (opposée à la convention standard
  // est-positif utilisée partout ailleurs dans l'app) — vérifié empiriquement à la calibration.
  const lonAstro = -observer.lng * D2R;
  const latRad = observer.lat * D2R;

  const sunEq = sunApparentEquatorial(jde);
  const sunDistAu = sunDistanceAU(T);

  const moon = moonGeocentricPosition(jde);
  const obliquity = meanObliquity(jde);
  const moonEq = new Ecliptic(moon.lon, moon.lat).toEquatorial(obliquity);

  const [rhoSinPhi, rhoCosPhi] = Earth76.parallaxConstants(latRad, observer.elevation ?? 0);
  // L'heure sidérale (rotation terrestre) doit être calculée à partir du temps universel (jd), pas du
  // temps dynamique (jde) : une confusion des deux introduit un décalage systématique d'environ ΔT
  // (~69s en 2026, soit ~0.2° d'écart en azimut) — repéré et corrigé pendant la calibration.
  const sunTopo = topocentric({ ra: sunEq.ra, dec: sunEq.dec, range: sunDistAu }, rhoSinPhi, rhoCosPhi, lonAstro, jd);
  const moonTopo = topocentric(
    { ra: moonEq.ra, dec: moonEq.dec, range: moon.range / AU_KM },
    rhoSinPhi,
    rhoCosPhi,
    lonAstro,
    jd,
  );

  const stSeconds = apparentSiderealTimeSeconds(jd);
  const g = new GlobeCoord(latRad, lonAstro);
  const sunHz = new Equatorial(sunTopo.ra, sunTopo.dec).toHorizontal(g, stSeconds);
  const moonHz = new Equatorial(moonTopo.ra, moonTopo.dec).toHorizontal(g, stSeconds);

  // `astronomia` mesure l'azimut depuis le sud, positif vers l'ouest (convention Meeus 13.5) — on
  // repasse à la convention boussole standard (nord = 0°, est = 90°) pour rester cohérent avec le
  // reste de l'app (azimuth des événements de l'API).
  const sunAzDeg = normalizeDeg(sunHz.az * R2D + 180);
  const moonAzDeg = normalizeDeg(moonHz.az * R2D + 180);
  const sunAltDeg = sunHz.alt * R2D;
  const moonAltDeg = moonHz.alt * R2D;

  const sunRadiusDeg = Math.asin(physicalData.Sun.radius / (sunDistAu * AU_KM)) * R2D;
  const moonRadiusDeg = Math.asin(physicalData.Moon.radius / moon.range) * R2D;

  const separationDeg = angularSeparationDeg({ theta: sunAltDeg, phi: sunAzDeg }, { theta: moonAltDeg, phi: moonAzDeg });

  const celestialAngleDeg = positionAngleDeg(
    { theta: sunTopo.dec * R2D, phi: sunTopo.ra * R2D },
    { theta: moonTopo.dec * R2D, phi: moonTopo.ra * R2D },
  );

  const stRad = (stSeconds / 86400) * 2 * Math.PI;
  const moonHourAngleRad = ((((stRad - lonAstro - moonTopo.ra) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  const q = parallacticAngleDeg(moonHourAngleRad, latRad, moonTopo.dec);
  const localAngleDeg = normalizeDeg(celestialAngleDeg - q);

  return { time: date, sunRadiusDeg, moonRadiusDeg, separationDeg, celestialAngleDeg, localAngleDeg };
}

// Calcule la position réelle du Soleil et de la Lune à chacun des instants donnés (pas seulement les
// points de contact nommés que renvoie l'API).
export function simulateSolarPath(times: Date[], observer: Observer, physicalData: SolarPhysicalData): SolarSimulationFrame[] {
  return times.map((t) => computeSolarFrame(t, observer, physicalData));
}

export interface CityInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SolarCityFrame extends SolarSimulationFrame {
  id: string;
  name: string;
}

// La parallaxe fait vraiment varier la géométrie (séparation, angle) d'un lieu à l'autre — comparer
// le maximum de l'éclipse entre plusieurs villes suivies a donc un sens géométrique réel, contrairement
// au lunaire (géocentrique, voir plus bas). Un seul instant de référence (le maximum tel que calculé
// pour le lieu actuellement sélectionné) est réutilisé pour toutes les villes plutôt que de rechercher
// l'instant exact du maximum propre à chacune (qui diffère de quelques minutes tout au plus) — la
// géométrie varie lentement autour du maximum, l'approximation reste largement dans la marge d'un
// diagramme schématique.
export function computeSolarFramesForCities(time: Date, cities: CityInput[], physicalData: SolarPhysicalData): SolarCityFrame[] {
  return cities.map((city) => ({
    id: city.id,
    name: city.name,
    ...computeSolarFrame(time, { lat: city.lat, lng: city.lng }, physicalData),
  }));
}

const ANIMATION_PADDING_MS = 5 * 60 * 1000;

// Instants régulièrement espacés pour une animation continue, de 5 minutes avant le premier contact
// à 5 minutes après le dernier — au-delà de ces bornes le Soleil et la Lune ne se recouvrent plus du
// tout, une marge fixe suffit donc à montrer l'approche/l'éloignement sans avoir à ajuster son
// étendue selon la durée (très variable) de l'éclipse.
export function buildSolarAnimationTimes(data: SolarEclipse, frameCount = 90): Date[] | null {
  const p1 = data.events.P1?.date;
  const p4 = data.events.P4?.date;
  if (!p1 || !p4) return null;

  const startMs = new Date(`${p1}Z`).getTime() - ANIMATION_PADDING_MS;
  const endMs = new Date(`${p4}Z`).getTime() + ANIMATION_PADDING_MS;

  const times: Date[] = [];
  for (let i = 0; i < frameCount; i++) {
    times.push(new Date(startMs + ((endMs - startMs) * i) / (frameCount - 1)));
  }
  return times;
}

// --- Éclipses lunaires : géométrie géocentrique (Lune vs axe de l'ombre terrestre), contrairement au
// solaire qui est topocentrique — cohérent avec MoonShadowDiagram.tsx existant, qui n'utilise que
// `p` (pas de repère local/zénith : le champ `zenith` de l'API lunaire est un point géographique, pas
// un angle) et `axis`/`radius.penumbra`/`radius.umbra` (rayons d'ombre quasi constants sur la durée
// d'une éclipse, réutilisés tels quels depuis l'API plutôt que recalculés). ---

export interface LunarSimulationFrame {
  time: Date;
  axis: number; // distance du centre de la Lune à l'axe de l'ombre, même unité que radius.penumbra/umbra
  moonRadius: number; // même unité
  angleDeg: number; // équivalent du champ `p`
}

// Calibré contre de vraies données API (éclipse du 03/03/2026) : angle de position à ~0.3° près aux
// points bien séparés (P1/U1/U4/P2), la formule perd en précision près du maximum (jusqu'à ~1.4°) —
// attendu, l'angle devient mal défini quand la séparation Lune/axe tend vers zéro. La distance
// axe-Lune (`axis`) est une approximation géométrique (séparation angulaire Lune/point anti-solaire,
// convertie en rayons terrestres via la distance de la Lune) qui reste à ~5% de l'`axis` renvoyé par
// l'API — l'axe de l'ombre théorique (élément de Bessel complet, voir Meeus ch. 54) est plus précis
// mais demanderait de porter toute la série périodique P(t)/Q(t)/γ(t) ; à ce niveau d'approximation,
// suffisant pour un diagramme schématique (déjà présenté comme tel dans l'UI existante).
function computeLunarFrame(date: Date, moonPhysicalRadiusKm: number): LunarSimulationFrame {
  const jde = DateToJDE(date);

  const sunEq = sunApparentEquatorial(jde);
  const moon = moonGeocentricPosition(jde);
  const obliquity = meanObliquity(jde);
  const moonEq = new Ecliptic(moon.lon, moon.lat).toEquatorial(obliquity);

  const sunRaDeg = sunEq.ra * R2D;
  const sunDecDeg = sunEq.dec * R2D;
  // Direction opposée au Soleil vue depuis le centre de la Terre — axe de l'ombre.
  const shadowPoint: SphericalPoint = { theta: -sunDecDeg, phi: normalizeDeg(sunRaDeg + 180) };
  const moonPoint: SphericalPoint = { theta: moonEq.dec * R2D, phi: moonEq.ra * R2D };

  const moonDistEarthRadii = moon.range / EARTH_RADIUS_KM;

  const sepDeg = angularSeparationDeg(shadowPoint, moonPoint);
  const axis = moonDistEarthRadii * Math.sin(sepDeg * D2R);

  const moonAngularRadiusDeg = Math.asin(moonPhysicalRadiusKm / moon.range) * R2D;
  const moonRadius = moonDistEarthRadii * Math.sin(moonAngularRadiusDeg * D2R);

  // +180° : voir la note de calibration ci-dessus — la formule de bearing brute est à l'opposé exact
  // de la convention observée sur les données réelles (même nature de décalage que ANGLE_OFFSET_DEG
  // dans MoonShadowDiagram.tsx, mais uniforme ici plutôt que ponctuel puisque calculé, pas lu tel quel).
  const angleDeg = normalizeDeg(positionAngleDeg(shadowPoint, moonPoint) + 180);

  return { time: date, axis, moonRadius, angleDeg };
}

export function simulateLunarPath(times: Date[], moonPhysicalRadiusKm = MOON_RADIUS_KM): LunarSimulationFrame[] {
  return times.map((t) => computeLunarFrame(t, moonPhysicalRadiusKm));
}

export function buildLunarAnimationTimes(data: LunarEclipse, frameCount = 90): Date[] | null {
  const p1 = data.events.P1?.date;
  const p2 = data.events.P2?.date;
  if (!p1 || !p2) return null;

  const startMs = new Date(`${p1}Z`).getTime() - ANIMATION_PADDING_MS;
  const endMs = new Date(`${p2}Z`).getTime() + ANIMATION_PADDING_MS;

  const times: Date[] = [];
  for (let i = 0; i < frameCount; i++) {
    times.push(new Date(startMs + ((endMs - startMs) * i) / (frameCount - 1)));
  }
  return times;
}
