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
  const arrowIcon = L.divIcon({
    className: 'horizon-profile-arrow',
    html: `<svg width="30" height="30" viewBox="0 0 30 30" style="transform: rotate(${targetAzimuthDeg.toFixed(1)}deg);">
      <polygon points="15,2 27,27 15,20 3,27" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />
      <polygon points="15,2 27,27 15,20 3,27" fill="#f4c238" stroke="#000000" stroke-width="1.5" stroke-linejoin="round" />
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
