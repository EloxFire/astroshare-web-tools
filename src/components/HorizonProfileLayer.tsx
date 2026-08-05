import { Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { bearingToParallelRotationDeg } from '../helpers/geo';
import './HorizonProfileLayer.css';

interface HorizonProfileLayerProps {
  origin: { lat: number; lng: number };
  profile: HorizonSample[];
  targetAltitudeDeg: number;
  targetAzimuthDeg: number;
}

// Fait tourner un point autour d'un centre (même convention que CSS `rotate()` : sens horaire pour un
// angle positif, dans un repère écran où Y pointe vers le bas).
const rotatePoint = (cx: number, cy: number, x: number, y: number, angleDeg: number): [number, number] => {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
};

export default function HorizonProfileLayer({
  origin,
  profile,
  targetAltitudeDeg,
  targetAzimuthDeg,
}: HorizonProfileLayerProps) {
  if (profile.length === 0) return null;

  const worst = profile.reduce((max, sample) => (sample.angleDeg > max.angleDeg ? sample : max));
  const linePositions: [number, number][] = [
    [origin.lat, origin.lng],
    ...profile.map((sample): [number, number] => [sample.lat, sample.lng]),
  ];

  // Décalé loin de l'origine : près du pin, sa boîte (largeur fixe en pixels) peut chevaucher
  // l'étiquette du lieu même quand le point géographique le plus proche est déjà à quelques km.
  const labelSample = profile[Math.min(profile.length - 1, 5)];
  const labelRotationDeg = bearingToParallelRotationDeg(targetAzimuthDeg);
  const labelIcon = L.divIcon({
    className: 'horizon-profile-label',
    html: `<span class="horizon-profile-label__text" style="transform: rotate(${labelRotationDeg.toFixed(1)}deg);">Direction de l'éclipse — relief testé</span>`,
    iconSize: [160, 20],
    iconAnchor: [80, 26],
  });

  const endSample = profile[profile.length - 1];
  // Deux triangles superposés (halo blanc épais dessous, contour noir fin dessus) plutôt qu'un seul
  // contour : à cette taille, une seule bordure se noie dans le trait déjà épais de la ligne juste
  // en dessous. Taille sensiblement plus grande que l'épaisseur du trait pour qu'elle se détache
  // clairement au lieu de se confondre avec l'embout arrondi de la ligne.
  //
  // La rotation est appliquée directement aux coordonnées du polygone plutôt que via une transform
  // CSS sur le <svg> : html2canvas (utilisé par l'export PDF) compose mal deux transformations
  // imbriquées (celle, interne, que Leaflet applique déjà pour positionner le marqueur, plus une
  // rotation CSS supplémentaire sur son contenu) — la flèche apparaissait déformée à l'export. Un
  // polygone déjà tourné dans ses propres coordonnées ne dépend plus que de cette seule transformation
  // de positionnement, comme n'importe quel autre marqueur de la carte qui s'exporte sans problème.
  const arrowPoints = ([[15, 2], [27, 27], [15, 20], [3, 27]] as const)
    .map(([x, y]) => rotatePoint(15, 15, x, y, targetAzimuthDeg))
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const arrowIcon = L.divIcon({
    className: 'horizon-profile-arrow',
    html: `<svg width="30" height="30" viewBox="0 0 30 30">
      <polygon points="${arrowPoints}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />
      <polygon points="${arrowPoints}" fill="#f4c238" stroke="#000000" stroke-width="1.5" stroke-linejoin="round" />
    </svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  return (
    <>
      {/* Triple liseré (noir puis blanc puis jaune) sous le tracé : garantit un contraste net que le
          fond de carte soit clair (relief topographique) ou sombre (thème par défaut). */}
      <Polyline positions={linePositions} pathOptions={{ color: '#000000', weight: 7, opacity: 0.8 }} />
      <Polyline positions={linePositions} pathOptions={{ color: '#ffffff', weight: 4, opacity: 0.9 }} />
      <Polyline positions={linePositions} pathOptions={{ color: '#f4c238', weight: 3, dashArray: '7 5', opacity: 1 }} />
      <Marker position={[labelSample.lat, labelSample.lng]} icon={labelIcon} interactive={false} />
      <Marker position={[endSample.lat, endSample.lng]} icon={arrowIcon} interactive={false} />
      {profile.map((sample) => {
        const blocking = sample.angleDeg >= targetAltitudeDeg;
        const isWorst = sample.distanceKm === worst.distanceKm;
        const size = isWorst ? 16 : 10;
        const icon = L.divIcon({
          className: 'horizon-profile-marker',
          html: `<div class="horizon-profile-marker__dot horizon-profile-marker__dot--${blocking ? 'blocking' : 'clear'}${isWorst ? ' horizon-profile-marker__dot--worst' : ''}"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        return (
          <Marker key={sample.distanceKm} position={[sample.lat, sample.lng]} icon={icon}>
            <Tooltip direction="top" offset={[0, -size / 2]}>
              {sample.distanceKm} km — {Math.round(sample.elevationM)} m — {sample.angleDeg.toFixed(1)}°
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
