import type { RefObject } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LunarEclipse } from '../types/LunarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { getTopographyTileUrl } from '../helpers/topographyTiles';
import { lunarEclipseVisibilityLinesColors } from '../constants';
import { ClickHandler, FlyToController, RecenterController, ZoomSlider, pinIcon } from './map/MapControls';
import { extractVisibilityLinesCoordinates, extractVisibilityPathsCoordinates, withLongitudeCopies } from './EclipseMap';
import CityVisibilityLayer from './CityVisibilityLayer';
import HorizonProfileLayer from './HorizonProfileLayer';

interface LunarEclipseMapProps {
  mapRef: RefObject<L.Map | null>;
  eclipse: LunarEclipse;
  selectedLocation: { lat: number; lng: number } | null;
  selectedLocationName: string;
  initialCenter: { lat: number; lng: number };
  flyToPosition: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  cities: TrackedCity[];
  onCityClick: (city: TrackedCity) => void;
  terrainProfile: HorizonSample[] | null;
  terrainTargetAltitude: number | undefined;
  terrainTargetAzimuth: number | undefined;
  showTopography: boolean;
}

export default function LunarEclipseMap({
  mapRef,
  eclipse,
  selectedLocation,
  selectedLocationName,
  initialCenter,
  flyToPosition,
  onMapClick,
  cities,
  onCityClick,
  terrainProfile,
  terrainTargetAltitude,
  terrainTargetAzimuth,
  showTopography,
}: LunarEclipseMapProps) {
  const topographyUrl = showTopography ? getTopographyTileUrl() : null;

  // Dégradé à 3 niveaux façon carte de visibilité (visible en entier / partiellement / pas du tout) :
  // deux polygones sombres empilés, chacun couvrant la région où la Lune est SOUS l'horizon à une des
  // deux bornes de l'éclipse (P1 = début pénombral, P2 = fin pénombral) — vérifié empiriquement contre
  // le point zénith renvoyé par l'API pour chaque évènement : il tombe hors de ce polygone, pas dedans,
  // donc l'intérieur du polygone est bien la zone SANS visibilité à cet instant, pas l'inverse. Là où
  // les deux polygones se recouvrent (invisible aux deux bornes), les deux s'additionnent : zone la
  // plus sombre. Là où un seul couvre (Lune qui se lève ou se couche pendant l'éclipse), une seule
  // épaisseur : zone intermédiaire. Là où aucun ne couvre (visible du début à la fin) : zone claire.
  const p1Path = eclipse.visibilityPaths?.features.find((path) => path.properties?.name === 'beginPenumbralEclipse');
  const p2Path = eclipse.visibilityPaths?.features.find((path) => path.properties?.name === 'endPenumbralEclipse');
  const p1NotVisible = p1Path ? extractVisibilityPathsCoordinates(p1Path.geometry) : null;
  const p2NotVisible = p2Path ? extractVisibilityPathsCoordinates(p2Path.geometry) : null;

  return (
    <MapContainer
      ref={mapRef}
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={4}
      zoomControl={false}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={180}
      // Sans ça, Polygon/Polyline sont rendus en SVG : html2canvas (utilisé par l'export PDF) ne
      // capture pas fiablement les tracés SVG transformés par Leaflet (lignes de visibilité
      // manquantes à l'export). Le rendu Canvas est, lui, capturé sans problème.
      preferCanvas
    >
      {topographyUrl ? (
        <TileLayer
          key="topography"
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OpenStreetMap contributors'
          url={topographyUrl}
          crossOrigin="anonymous"
        />
      ) : (
        <TileLayer
          key="dark"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          crossOrigin="anonymous"
        />
      )}

      {/* Calques empilés du dégradé de visibilité (voir le commentaire au-dessus du composant) —
          non interactifs pour laisser passer les clics de sélection vers la carte. Chacun est rendu
          en plusieurs exemplaires translatés de ±360° de longitude (voir withLongitudeCopies) : sans
          ça, le calque disparaît/semble décalé dès qu'on dézoome sur une copie répétée du monde,
          Leaflet ne dupliquant pas les calques vectoriels comme il le fait pour les tuiles. */}
      {p1NotVisible && (
        <Polygon
          positions={withLongitudeCopies(p1NotVisible).map((ring) => [ring])}
          pathOptions={{ stroke: false, fillColor: '#000000', fillOpacity: 0.35 }}
          interactive={false}
        />
      )}
      {p2NotVisible && (
        <Polygon
          positions={withLongitudeCopies(p2NotVisible).map((ring) => [ring])}
          pathOptions={{ stroke: false, fillColor: '#000000', fillOpacity: 0.35 }}
          interactive={false}
        />
      )}

      {/* Une seule ligne plutôt que les 7 limites de phase (P1/U1/U2/greatest/U3/U4/P2) : à l'image de
          l'IMCCE, qui n'affiche que celle du maximum de l'éclipse — les 7 lignes superposées
          rendaient la carte confuse sans apporter grand-chose de plus que le dégradé de zones. */}
      {eclipse.visibilityLines?.features
        .filter((feature) => feature.properties.name === 'maximumEclipse')
        .map((feature, featureIndex) =>
          extractVisibilityLinesCoordinates(feature.geometry.coordinates).map((coordSet, index) => (
            <Polyline
              key={`line-${featureIndex}-${index}-${feature.properties.name}`}
              positions={withLongitudeCopies(coordSet)}
              pathOptions={{ color: lunarEclipseVisibilityLinesColors[feature.properties.name], weight: 2 }}
            />
          )),
        )}

      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pinIcon}>
          {selectedLocationName && <Tooltip direction="top" offset={[0, -36]} permanent>{selectedLocationName}</Tooltip>}
        </Marker>
      )}

      <CityVisibilityLayer data={eclipse} cities={cities} onCityClick={onCityClick} />

      {selectedLocation && terrainProfile && terrainTargetAltitude != null && terrainTargetAzimuth != null && (
        <HorizonProfileLayer
          origin={selectedLocation}
          profile={terrainProfile}
          targetAltitudeDeg={terrainTargetAltitude}
          targetAzimuthDeg={terrainTargetAzimuth}
        />
      )}

      <ClickHandler onMapClick={onMapClick} />
      <FlyToController position={flyToPosition} />
      <RecenterController target={selectedLocation} />
      <ZoomSlider />
    </MapContainer>
  );
}
